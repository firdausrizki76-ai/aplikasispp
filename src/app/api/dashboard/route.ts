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

    // Optimize by running parallel requests
    const [
      { count: totalSiswa },
      { data: auditLogs }
    ] = await Promise.all([
      // Total Siswa
      supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("status", "aktif"),
      // Audit Logs
      supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5)
    ]);

    // Calculate total pembayaran (loop pagination)
    let totalPembayaran = 0;
    let paymentsFrom = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("amount")
        .range(paymentsFrom, paymentsFrom + step - 1);
        
      if (error || !data) break;
      totalPembayaran += data.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      if (data.length < step) break;
      paymentsFrom += step;
    }

    // Calculate total tunggakan (loop pagination)
    let totalTunggakan = 0;
    let tunggakanFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from("student_bills")
        .select("nominal")
        .eq("status", "Belum Lunas")
        .range(tunggakanFrom, tunggakanFrom + step - 1);
        
      if (error || !data) break;
      totalTunggakan += data.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
      if (data.length < step) break;
      tunggakanFrom += step;
    }

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
