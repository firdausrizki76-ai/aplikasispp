import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertAuditLog } from '@/utils/audit';

export async function POST(req: Request) {
  try {
    const { trx_id, bill_id, userId } = await req.json();
    
    if (!trx_id) {
      return NextResponse.json({ error: "ID Transaksi diperlukan" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch transaction amount securely
    const { data: trx } = await supabaseAdmin.from('payment_transactions').select('amount').eq('id', trx_id).single();
    if (!trx) throw new Error("Transaksi tidak ditemukan");

    // Revert bill status and nominal
    if (bill_id) {
      // Check if there are other transactions for this same bill (e.g. duplicate payments)
      const { data: otherTxs } = await supabaseAdmin
        .from('payment_transactions')
        .select('amount')
        .eq('bill_id', bill_id)
        .neq('id', trx_id);

      const totalOtherPaid = (otherTxs || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const { data: bill } = await supabaseAdmin
        .from('student_bills')
        .select('nominal, status, jenis_tagihan')
        .eq('id', bill_id)
        .single();

      if (bill) {
        if (totalOtherPaid > 0) {
          // If other transactions already covered the bill (like a duplicate transaction), keep it Lunas
          const { data: masterTagihan } = await supabaseAdmin
            .from('master_tagihan')
            .select('nominal_default')
            .eq('nama_tagihan', bill.jenis_tagihan)
            .single();

          const expectedTotal = masterTagihan ? Number(masterTagihan.nominal_default) : Number(trx.amount);
          if (totalOtherPaid >= expectedTotal) {
            await supabaseAdmin.from('student_bills').update({
              status: 'Lunas',
              nominal: 0
            }).eq('id', bill_id);
          } else {
            const restoredNominal = Math.max(0, expectedTotal - totalOtherPaid);
            await supabaseAdmin.from('student_bills').update({
              status: restoredNominal <= 0 ? 'Lunas' : 'Belum Lunas',
              nominal: restoredNominal
            }).eq('id', bill_id);
          }
        } else {
          // No other transactions exist, restore original nominal
          const currentNominal = Number(bill.nominal) || 0;
          const restoredNominal = currentNominal + Number(trx.amount);
          await supabaseAdmin.from('student_bills').update({ 
            status: 'Belum Lunas',
            nominal: restoredNominal
          }).eq('id', bill_id);
        }
      }
    }

    // Delete transaction
    const { error } = await supabaseAdmin.from('payment_transactions').delete().eq('id', trx_id);
    if (error) throw error;

    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        "Hapus Transaksi Harian",
        "payment_transactions",
        `Membatalkan/menghapus transaksi sebesar Rp ${trx.amount}`
      );
      
      // Fix the audit log trigger's missing user_id
      await supabaseAdmin.from('audit_logs').update({ user_id: userId }).eq('record_id', trx_id).is('user_id', null).eq('action', 'DELETE');
      if (bill_id) {
        await supabaseAdmin.from('audit_logs').update({ user_id: userId }).eq('record_id', bill_id).is('user_id', null).eq('action', 'UPDATE');
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
