import { SupabaseClient } from '@supabase/supabase-js';

export async function insertAuditLog(
  supabaseAdmin: SupabaseClient,
  userId: string | null,
  action: string,
  tableName: string,
  details: string
) {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      table_name: tableName,
      details,
    });
    
    if (error) {
      console.error('Failed to insert audit log:', error);
    }
  } catch (err) {
    console.error('Error inserting audit log:', err);
  }
}
