import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Support for multiple bill updates or a single update
    const { updates: payloadUpdates, userId, actionDetails } = body;
    const updates = Array.isArray(body) ? body : (payloadUpdates || [body]);

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada tagihan yang diupdate' });
    }

    for (const update of updates) {
      const { billId, nominal, status } = update;
      
      if (!billId) continue;
      
      const { error } = await supabaseAdmin
        .from('student_bills')
        .update({ nominal, status })
        .eq('id', billId);
        
      if (error) {
        throw new Error(error.message);
      }

      if (userId) {
        // Fix the audit log trigger's missing user_id due to service_role bypass
        await supabaseAdmin
          .from('audit_logs')
          .update({ user_id: userId })
          .eq('record_id', billId)
          .is('user_id', null)
          .eq('action', 'UPDATE');
      }
    }

    if (userId) {
      await insertAuditLog(
        supabaseAdmin, 
        userId, 
        "Update Tagihan", 
        "student_bills", 
        actionDetails || `Mengubah ${updates.length} tagihan`
      );
    }

    return NextResponse.json({ success: true, message: 'Tagihan berhasil diupdate' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
