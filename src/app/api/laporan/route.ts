import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const jenisTagihan = searchParams.get('jenisTagihan') || 'Semua';
    const jenisSekolah = searchParams.get('jenisSekolah') || 'Semua';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate dan endDate diperlukan" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    // Bypass RLS using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Call high-performance RPC function
    const { data, error } = await supabaseAdmin.rpc('get_laporan_data', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_jenis_tagihan: jenisTagihan,
      p_jenis_sekolah: jenisSekolah
    });

    if (error) {
      console.error("RPC get_laporan_data error:", error);
      throw error;
    }

    return NextResponse.json(data || {
      bills: [],
      sales: [],
      students: [],
      master_tagihan: [],
      counts: { SD: 0, SMP: 0 }
    });

  } catch (error: any) {
    console.error("Laporan API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

