import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { billId, billIds, userId, actionDetails } = await request.json();
    
    const ids: string[] = Array.isArray(billIds) 
      ? billIds.filter(Boolean) 
      : (billId ? [billId] : []);
    
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Bill ID atau billIds diperlukan' }, { status: 400 });
    }
      
    const { error } = await supabaseAdmin
      .from('student_bills')
      .delete()
      .in('id', ids);
      
    if (error) {
      throw new Error(error.message);
    }

    if (userId) {
      // Fix trigger audit log
      await supabaseAdmin
        .from('audit_logs')
        .update({ user_id: userId })
        .in('record_id', ids)
        .is('user_id', null)
        .eq('action', 'DELETE');
        
      await insertAuditLog(
        supabaseAdmin, 
        userId, 
        "Hapus Tagihan", 
        "student_bills", 
        actionDetails || `Menghapus ${ids.length} tagihan secara permanen`
      );
    }

    return NextResponse.json({ success: true, count: ids.length, message: `${ids.length} tagihan berhasil dihapus` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
