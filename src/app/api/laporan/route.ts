import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    // 1. Fetch bills with pagination
    let allBills: any[] = [];
    let from = 0;
    const step = 1000;
    
    while (true) {
      const { data, error } = await supabaseAdmin.from('student_bills')
        .select('*, students(grade_level, name, classes(class_name, grade_level)), payment_transactions(payment_date)')
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`)
        .range(from, from + step - 1);
        
      if (error) break;
      if (data) {
        allBills = [...allBills, ...data];
        if (data.length < step) break;
      } else {
        break;
      }
      from += step;
    }

    // 2. Fetch sales
    const { data: sales } = await supabaseAdmin.from('sales')
      .select('*, students(name, grade_level)')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`);

    // 3. Fetch students for report generation
    const { data: students } = await supabaseAdmin.from('students')
      .select('id, name, class_name, grade_level, status, classes(class_name, grade_level)')
      .order('name');

    // Count SD and SMP students
    let countSD = 0;
    let countSMP = 0;
    (students || []).forEach(s => {
      if (s.status === 'aktif') {
        const gl = (s.classes as any)?.grade_level || s.grade_level || "";
        if (gl.toUpperCase().includes('SD')) countSD++;
        else if (gl.toUpperCase().includes('SMP')) countSMP++;
      }
    });

    // 4. Fetch master tagihan
    const { data: master_tagihan } = await supabaseAdmin.from('master_tagihan').select('nama_tagihan');

    return NextResponse.json({
      bills: allBills || [],
      sales: sales || [],
      students: students || [],
      master_tagihan: master_tagihan || [],
      counts: {
        SD: countSD || 0,
        SMP: countSMP || 0
      }
    });

  } catch (error: any) {
    console.error("Laporan API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
