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

    // Revert bill status to Belum Lunas
    if (bill_id) {
      await supabaseAdmin.from('student_bills').update({ status: 'Belum Lunas' }).eq('id', bill_id);
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
