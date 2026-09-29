import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, studentName, bills, userId } = body;

    if (!studentId || !bills || !Array.isArray(bills) || bills.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Data pembayaran tidak lengkap (minimal 1 tagihan).' },
        { status: 400 }
      );
    }

    const receiptId = `TRX-${Date.now()}`;

    // Call atomic PostgreSQL function with row-locking (FOR UPDATE)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('pay_student_bills', {
      p_student_id: studentId,
      p_bills: bills,
      p_admin_id: userId || null,
      p_receipt_id: receiptId
    });

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 400 }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      return NextResponse.json(
        { success: false, error: rpcResult?.error || 'Gagal memproses pembayaran' },
        { status: 400 }
      );
    }

    // Insert audit log
    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        'Menerima Pembayaran',
        'payment_transactions',
        `Menerima pembayaran ${rpcResult.count} tagihan untuk siswa ${studentName || studentId} (No. Resi: ${receiptId})`
      );
    }

    return NextResponse.json({
      success: true,
      receiptId: rpcResult.receiptId || receiptId,
      count: rpcResult.count,
      message: 'Pembayaran berhasil dicatat!'
    });
  } catch (error: any) {
    console.error('Error in /api/payments/pay:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan server saat mencatat pembayaran.' },
      { status: 500 }
    );
  }
}
