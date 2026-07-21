import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { billId, userId, actionDetails } = await request.json();
    
    if (!billId) {
      return NextResponse.json({ success: false, error: 'Bill ID is required' }, { status: 400 });
    }
      
    const { error } = await supabaseAdmin
      .from('student_bills')
      .delete()
      .eq('id', billId);
      
    if (error) {
      throw new Error(error.message);
    }

    if (userId) {
      // Fix trigger audit log
      await supabaseAdmin
        .from('audit_logs')
        .update({ user_id: userId })
        .eq('record_id', billId)
        .is('user_id', null)
        .eq('action', 'DELETE');
        
      await insertAuditLog(
        supabaseAdmin, 
        userId, 
        "Hapus Tagihan", 
        "student_bills", 
        actionDetails || `Menghapus tagihan secara permanen`
      );
    }

    return NextResponse.json({ success: true, message: 'Tagihan berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
