import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';
import { normalizePhone } from '@/utils/phone';
import { getDefaultPPDBAcademicYear } from '@/utils/academicYear';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get('academic_year') || getDefaultPPDBAcademicYear();
    const targetGrade = searchParams.get('target_grade');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('psb_candidates')
      .select(`
        *,
        synced_student:students (
          id,
          name,
          class_name,
          classes (
            class_name
          )
        ),
        installments:psb_installments (
          id,
          receipt_no,
          installment_step,
          amount,
          payment_date,
          payment_method,
          notes,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (academicYear && academicYear !== 'ALL') {
      query = query.eq('academic_year', academicYear);
    }
    if (targetGrade && targetGrade !== 'ALL') {
      query = query.eq('target_grade', targetGrade);
    }
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    if (search && search.trim() !== '') {
      query = query.or(`full_name.ilike.%${search.trim()}%,registration_no.ilike.%${search.trim()}%,parent_name.ilike.%${search.trim()}%`);
    }

    const { data: candidates, error } = await query;

    if (error) {
      throw error;
    }

    // Sort installments in-memory per candidate
    const processedCandidates = (candidates || []).map((c: any) => ({
      ...c,
      installments: (c.installments || []).sort((a: any, b: any) => a.installment_step - b.installment_step)
    }));

    // Calculate summaries
    let totalTarget = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let countLunas = 0;
    let countMencicil = 0;
    let countBelumBayar = 0;
    let countTerdaftarKelas = 0;

    processedCandidates.forEach((c: any) => {
      totalTarget += Number(c.total_amount) || 0;
      totalPaid += Number(c.total_paid) || 0;
      totalRemaining += Number(c.remaining_balance) || 0;
      if (c.status === 'LUNAS') countLunas++;
      else if (c.status === 'MENCICIL') countMencicil++;
      else if (c.status === 'BELUM_BAYAR') countBelumBayar++;
      else if (c.status === 'TERDAFTAR_KELAS') countTerdaftarKelas++;
    });

    return NextResponse.json({
      success: true,
      data: processedCandidates,
      summary: {
        totalCandidates: processedCandidates.length,
        totalTarget,
        totalPaid,
        totalRemaining,
        countLunas,
        countMencicil,
        countBelumBayar,
        countTerdaftarKelas,
      }
    });
  } catch (error: any) {
    console.error('Error fetching PSB candidates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat data calon siswa PSB.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      full_name,
      gender,
      pob,
      dob,
      parent_name,
      parent_phone,
      target_grade,
      academic_year = getDefaultPPDBAcademicYear(),
      base_amount = 6900000,
      discount_type = 'Tanpa Diskon',
      discount_amount = 0,
      discount_notes = '',
      initial_payment = 0,
      payment_method = 'TUNAI',
      notes = '',
      userId = null
    } = body;

    if (!full_name || !target_grade) {
      return NextResponse.json(
        { success: false, error: 'Nama calon siswa dan jenjang sekolah wajib diisi.' },
        { status: 400 }
      );
    }

    const numBase = Number(base_amount) || 0;
    const numDiscount = Math.min(numBase, Math.max(0, Number(discount_amount) || 0));
    const numTotal = Math.max(0, numBase - numDiscount);
    const numInitial = Math.min(numTotal, Math.max(0, Number(initial_payment) || 0));

    // Generate unique Registration Number
    // e.g. Year suffix: 2027/2028 -> 2728, 2028/2029 -> 2829
    const yearParts = (academic_year || '').split('/');
    const cleanYear = yearParts.length === 2
      ? `${yearParts[0].trim().slice(-2)}${yearParts[1].trim().slice(-2)}`
      : (academic_year || '').replace(/\D/g, '').slice(-4) || '2728';
    
    // Count existing candidates for this academic year to create sequential code
    const { count, error: countErr } = await supabaseAdmin
      .from('psb_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year', academic_year);

    const nextSeq = (count || 0) + 1;
    const regNo = `PSB-${cleanYear}-${String(nextSeq).padStart(3, '0')}`;

    // Insert Candidate
    const { data: candidate, error: insertErr } = await supabaseAdmin
      .from('psb_candidates')
      .insert({
        registration_no: regNo,
        full_name: full_name.trim(),
        gender: gender || null,
        pob: pob ? pob.trim() : null,
        dob: dob || null,
        parent_name: parent_name ? parent_name.trim() : null,
        parent_phone: normalizePhone(parent_phone),
        target_grade,
        academic_year,
        base_amount: numBase,
        discount_type,
        discount_amount: numDiscount,
        discount_notes: discount_notes ? discount_notes.trim() : null,
        total_amount: numTotal,
        total_paid: 0,
        remaining_balance: numTotal,
        status: 'BELUM_BAYAR',
        created_by: userId
      })
      .select()
      .single();

    if (insertErr || !candidate) {
      throw new Error(insertErr?.message || 'Gagal menyimpan calon siswa');
    }

    let installmentResult = null;
    if (numInitial > 0) {
      // Record initial installment via atomic RPC
      const { data: instData, error: instErr } = await supabaseAdmin.rpc('record_psb_installment', {
        p_candidate_id: candidate.id,
        p_amount: numInitial,
        p_payment_date: new Date().toISOString().split('T')[0],
        p_payment_method: payment_method || 'TUNAI',
        p_notes: notes || 'Pembayaran Cicilan 1 Uang Masuk',
        p_admin_id: userId
      });

      if (instErr) {
        console.error('Error recording initial installment:', instErr);
      } else {
        installmentResult = instData;
      }
    }

    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        'Pendaftaran PSB',
        'psb_candidates',
        `Mendaftarkan calon siswa ${candidate.full_name} (${regNo}) T.A. ${academic_year}${numInitial > 0 ? ` dengan uang muka Rp ${numInitial.toLocaleString('id-ID')}` : ''}`
      );
    }

    return NextResponse.json({
      success: true,
      candidate,
      installment: installmentResult,
      message: 'Calon siswa berhasil didaftarkan!'
    });
  } catch (error: any) {
    console.error('Error creating PSB candidate:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan calon siswa.' },
      { status: 500 }
    );
  }
}
