import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: bills, error: err1 } = await supabaseAdmin.from('student_bills').select('*').limit(1);
    
    if (!bills || bills.length === 0) {
      return NextResponse.json({ success: false, error: 'No bills found' });
    }

    const bill = bills[0];
    
    const { error: err2 } = await supabaseAdmin.from('student_bills').update({
      status: 'Belum Lunas'
    }).eq('id', bill.id);

    return NextResponse.json({ success: true, bill, err1, err2 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
