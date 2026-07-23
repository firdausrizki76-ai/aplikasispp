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

    // Calculate total pembayaran and breakdown (loop pagination)
    let totalPembayaran = 0;
    const rincianPemasukan: Record<string, Record<string, number>> = {};
    let paymentsFrom = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("amount, jenis_tagihan, student_bills(bulan_tagihan, jenis_tagihan)")
        .range(paymentsFrom, paymentsFrom + step - 1);
        
      if (error || !data) break;
      
      data.forEach((curr: any) => {
        const amount = Number(curr.amount) || 0;
        totalPembayaran += amount;

        // Use billed month and component if available from relation, fallback to parsing string
        let monthYear = '';
        let komponen = '';

        if (curr.student_bills) {
          monthYear = curr.student_bills.bulan_tagihan;
          komponen = curr.student_bills.jenis_tagihan;
        } else if (curr.jenis_tagihan) {
          // Fallback if relation is null for some reason
          komponen = curr.jenis_tagihan;
          monthYear = 'Lainnya'; 
        }

        if (monthYear && komponen) {
          if (!rincianPemasukan[monthYear]) {
            rincianPemasukan[monthYear] = {};
          }
          if (!rincianPemasukan[monthYear][komponen]) {
            rincianPemasukan[monthYear][komponen] = 0;
          }
          rincianPemasukan[monthYear][komponen] += amount;
        }
      });

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
      rincianPemasukan,
      auditLogs: auditLogs || []
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
