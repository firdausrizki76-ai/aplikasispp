import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      candidateId,
      amount,
      paymentDate,
      paymentMethod = 'TUNAI',
      notes = '',
      userId = null
    } = body;

    if (!candidateId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID calon siswa dan nominal pembayaran harus valid.' },
        { status: 400 }
      );
    }

    // Call stored procedure
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('record_psb_installment', {
      p_candidate_id: candidateId,
      p_amount: Number(amount),
      p_payment_date: paymentDate || new Date().toISOString().split('T')[0],
      p_payment_method: paymentMethod,
      p_notes: notes || null,
      p_admin_id: userId
    });

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 400 }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      return NextResponse.json(
        { success: false, error: rpcResult?.error || 'Gagal memproses pembayaran cicilan PSB.' },
        { status: 400 }
      );
    }

    // Fetch candidate name for audit log
    const { data: candidate } = await supabaseAdmin
      .from('psb_candidates')
      .select('full_name, registration_no, parent_phone')
      .eq('id', candidateId)
      .single();

    if (userId && candidate) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        'Cicilan PSB',
        'psb_installments',
        `Menerima cicilan ke-${rpcResult.installment_step} sebesar Rp ${Number(amount).toLocaleString('id-ID')} untuk ${candidate.full_name} (${candidate.registration_no}) - No. Kwitansi: ${rpcResult.receipt_no}`
      );
    }

    return NextResponse.json({
      success: true,
      receiptNo: rpcResult.receipt_no,
      installmentStep: rpcResult.installment_step,
      amount: rpcResult.amount,
      totalPaid: rpcResult.total_paid,
      remainingBalance: rpcResult.remaining_balance,
      status: rpcResult.status,
      candidate: candidate || null,
      message: 'Pembayaran cicilan PSB berhasil dicatat!'
    });
  } catch (error: any) {
    console.error('Error in /api/psb/pay:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan server saat mencatat cicilan PSB.' },
      { status: 500 }
    );
  }
}
