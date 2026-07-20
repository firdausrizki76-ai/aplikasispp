import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { trx_id, bill_id } = await req.json();
    
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
      // Fetch current bill nominal
      const { data: bill } = await supabaseAdmin.from('student_bills').select('nominal').eq('id', bill_id).single();
      const currentNominal = bill ? Number(bill.nominal) : 0;
      const amountToRestore = Number(trx.amount);
      
      const restoredNominal = currentNominal + amountToRestore;
      
      const { error: updateError } = await supabaseAdmin.from('student_bills').update({ 
        status: 'Belum Lunas',
        nominal: restoredNominal
      }).eq('id', bill_id);
      
      if (updateError) {
        throw new Error("Gagal memulihkan tagihan: " + updateError.message);
      }
    }

    // Delete transaction
    const { error } = await supabaseAdmin.from('payment_transactions').delete().eq('id', trx_id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
