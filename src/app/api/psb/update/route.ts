import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';
import { normalizePhone } from '@/utils/phone';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      candidateId,
      full_name,
      gender,
      pob,
      dob,
      parent_name,
      parent_phone,
      target_grade,
      academic_year,
      base_amount,
      discount_type,
      discount_amount,
      discount_notes,
      userId = null
    } = body;

    if (!candidateId) {
      return NextResponse.json(
        { success: false, error: 'ID calon siswa wajib disertakan.' },
        { status: 400 }
      );
    }

    if (!full_name || !target_grade) {
      return NextResponse.json(
        { success: false, error: 'Nama calon siswa dan jenjang sekolah wajib diisi.' },
        { status: 400 }
      );
    }

    // Get current candidate
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('psb_candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json(
        { success: false, error: 'Data calon siswa tidak ditemukan.' },
        { status: 404 }
      );
    }

    const numBase = Number(base_amount) >= 0 ? Number(base_amount) : Number(current.base_amount || 0);
    const numDiscount = Math.min(numBase, Math.max(0, Number(discount_amount) || 0));
    const numTotal = Math.max(0, numBase - numDiscount);
    const totalPaid = Number(current.total_paid || 0);
    const remainingBalance = Math.max(0, numTotal - totalPaid);

    let status = current.status;
    if (current.synced_student_id) {
      status = 'TERDAFTAR_KELAS';
    } else if (remainingBalance <= 0 && totalPaid > 0) {
      status = 'LUNAS';
    } else if (totalPaid > 0) {
      status = 'MENCICIL';
    } else {
      status = 'BELUM_BAYAR';
    }

    const updatePayload: any = {
      full_name: full_name.trim(),
      gender: gender || null,
      pob: pob ? pob.trim() : null,
      dob: dob || null,
      parent_name: parent_name ? parent_name.trim() : null,
      parent_phone: parent_phone ? normalizePhone(parent_phone) : null,
      target_grade,
      academic_year: academic_year || current.academic_year,
      base_amount: numBase,
      discount_type: discount_type || 'Tanpa Diskon',
      discount_amount: numDiscount,
      discount_notes: discount_notes ? discount_notes.trim() : null,
      total_amount: numTotal,
      remaining_balance: remainingBalance,
      status,
      updated_at: new Date().toISOString()
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('psb_candidates')
      .update(updatePayload)
      .eq('id', candidateId)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    // If synced to a student, keep students table record in sync as well
    if (current.synced_student_id) {
      await supabaseAdmin
        .from('students')
        .update({
          name: full_name.trim(),
          gender: gender || null,
          pob: pob ? pob.trim() : null,
          dob: dob || null,
          parent_name: parent_name ? parent_name.trim() : null,
          parent_phone: parent_phone ? normalizePhone(parent_phone) : null,
        })
        .eq('id', current.synced_student_id);
    }

    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        'Edit Calon Siswa PSB',
        'psb_candidates',
        `Memperbarui profil calon siswa ${updated.full_name} (${updated.registration_no})`
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Data calon siswa berhasil diperbarui.'
    });
  } catch (error: any) {
    console.error('Error updating candidate:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui data calon siswa.' },
      { status: 500 }
    );
  }
}
