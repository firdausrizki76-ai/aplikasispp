import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // 1. Fetch payment_transactions (SPP & Rutin)
    let allSpp: any[] = [];
    let fromSpp = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('payment_transactions')
        .select(`
          id,
          receipt_id,
          amount,
          payment_date,
          jenis_tagihan,
          bill_id,
          admin_id,
          payment_method,
          student_id,
          students (id, name, grade_level, class_name, classes(class_name)),
          profiles (id, full_name),
          student_bills (bulan_tagihan, jenis_tagihan)
        `)
        .order('payment_date', { ascending: false })
        .range(fromSpp, fromSpp + step - 1);

      if (error) {
        console.error('Error fetching payment_transactions:', error);
        break;
      }
      if (data && data.length > 0) {
        allSpp = [...allSpp, ...data];
        if (data.length < step) break;
      } else {
        break;
      }
      fromSpp += step;
    }

    // 2. Fetch psb_installments (Cicilan PSB / Uang Masuk)
    const { data: psbData, error: psbErr } = await supabaseAdmin
      .from('psb_installments')
      .select(`
        id,
        receipt_no,
        installment_step,
        amount,
        payment_date,
        payment_method,
        notes,
        created_at,
        received_by,
        candidate:psb_candidates (
          id,
          full_name,
          registration_no,
          target_grade,
          academic_year
        ),
        profiles (
          id,
          full_name
        )
      `)
      .order('payment_date', { ascending: false });

    if (psbErr) {
      console.error('Error fetching psb_installments:', psbErr);
    }

    // 3. Fetch sales (Penjualan Seragam)
    const { data: salesData, error: salesErr } = await supabaseAdmin
      .from('sales')
      .select(`
        id,
        total_price,
        item_name,
        quantity,
        created_at,
        student_id,
        students (
          id,
          name,
          grade_level,
          class_name,
          classes (class_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (salesErr) {
      console.error('Error fetching sales:', salesErr);
    }

    // Normalize and unify all transactions
    const unifiedList: any[] = [];

    // Map SPP
    (allSpp || []).forEach((item: any) => {
      const studentClass = item.students?.classes?.class_name || item.students?.class_name || '-';
      const monthPart = item.student_bills?.bulan_tagihan ? ` (${item.student_bills.bulan_tagihan})` : '';
      unifiedList.push({
        id: item.id,
        sourceType: 'SPP',
        sourceLabel: 'SPP & Rutin',
        receipt_id: item.receipt_id,
        payment_date: item.payment_date,
        amount: Number(item.amount) || 0,
        student_name: item.students?.name || 'Siswa',
        grade_level: item.students?.grade_level || 'SD',
        class_name: studentClass,
        category_label: `${item.jenis_tagihan || 'SPP'}${monthPart}`,
        payment_method: item.payment_method || 'TUNAI',
        admin_name: item.profiles?.full_name || 'Admin',
        bill_id: item.bill_id,
        notes: item.student_bills?.bulan_tagihan || null,
        raw: item,
      });
    });

    // Map PSB
    (psbData || []).forEach((item: any) => {
      const candidateObj = Array.isArray(item.candidate) ? item.candidate[0] : item.candidate;
      const profilesObj = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      const candidateName = candidateObj?.full_name || 'Calon Siswa';
      const grade = candidateObj?.target_grade || 'SD';
      const reg = candidateObj?.registration_no || '';
      const year = candidateObj?.academic_year || '2027/2028';
      const adminName = profilesObj?.full_name || 'Admin';

      let paymentTimestamp = item.created_at || item.payment_date;
      if (item.payment_date && item.created_at) {
        const dateStr = item.payment_date.slice(0, 10);
        const timePart = item.created_at.includes('T')
          ? item.created_at.split('T')[1]
          : item.created_at.slice(11);
        paymentTimestamp = `${dateStr}T${timePart}`;
      }

      unifiedList.push({
        id: item.id,
        sourceType: 'PSB',
        sourceLabel: 'Uang Masuk PSB',
        receipt_id: item.receipt_no,
        payment_date: paymentTimestamp,
        amount: Number(item.amount) || 0,
        student_name: candidateName,
        grade_level: grade,
        class_name: `Calon Siswa (${reg})`,
        category_label: `PSB Cicilan Ke-${item.installment_step} (T.A. ${year})`,
        payment_method: item.payment_method || 'TUNAI',
        admin_name: adminName,
        notes: item.notes || `Pembayaran cicilan uang masuk PSB`,
        raw: item,
      });
    });

    // Map Seragam
    (salesData || []).forEach((item: any) => {
      const studentClass = item.students?.classes?.class_name || item.students?.class_name || '-';
      const studentName = item.students?.name || 'Umum / Siswa';
      const grade = item.students?.grade_level || '-';
      const saleDate = item.created_at || new Date().toISOString();
      unifiedList.push({
        id: item.id,
        sourceType: 'SERAGAM',
        sourceLabel: 'Seragam',
        receipt_id: `SRG-${item.id.slice(0, 8).toUpperCase()}`,
        payment_date: saleDate,
        amount: Number(item.total_price) || 0,
        student_name: studentName,
        grade_level: grade,
        class_name: studentClass,
        category_label: `Seragam: ${item.item_name || 'Item'}${item.quantity ? ` (${item.quantity} pcs)` : ''}`,
        payment_method: 'TUNAI',
        admin_name: 'Kasir Toko',
        notes: `${item.item_name} x ${item.quantity || 1}`,
        raw: item,
      });
    });

    // Sort all by payment_date descending
    unifiedList.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    // Summaries
    let sppTotal = 0;
    let sppCount = 0;
    let psbTotal = 0;
    let psbCount = 0;
    let seragamTotal = 0;
    let seragamCount = 0;

    unifiedList.forEach((t) => {
      if (t.sourceType === 'SPP') {
        sppTotal += t.amount;
        sppCount++;
      } else if (t.sourceType === 'PSB') {
        psbTotal += t.amount;
        psbCount++;
      } else if (t.sourceType === 'SERAGAM') {
        seragamTotal += t.amount;
        seragamCount++;
      }
    });

    const totalAmount = sppTotal + psbTotal + seragamTotal;

    return NextResponse.json({
      success: true,
      data: unifiedList,
      summary: {
        totalCount: unifiedList.length,
        totalAmount,
        sppTotal,
        sppCount,
        psbTotal,
        psbCount,
        seragamTotal,
        seragamCount,
      }
    });
  } catch (error: any) {
    console.error('Error in /api/harian:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat jurnal transaksi harian.' },
      { status: 500 }
    );
  }
}
