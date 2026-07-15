import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    // Gunakan Service Role Key untuk bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials in server");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Total Siswa
    const { count: totalSiswa } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("status", "aktif");

    // Total Pemasukan
    const { data: payments } = await supabase
      .from("payment_transactions")
      .select("amount");
    const totalPembayaran = (payments || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Total Tunggakan
    const { data: unpaidBills } = await supabase
      .from("student_bills")
      .select("nominal")
      .eq("status", "Belum Lunas");
    const totalTunggakan = (unpaidBills || []).reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);

    // Audit Logs
    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      totalSiswa: totalSiswa || 0,
      totalPembayaran,
      totalTunggakan,
      auditLogs: auditLogs || []
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
