import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  const synced = [];
  for (const u of users.users) {
    const fullName = u.user_metadata?.full_name || u.email;
    const role = u.user_metadata?.role || 'admin';
    const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert({
      id: u.id,
      email: u.email,
      full_name: fullName,
      role: role,
      status: 'aktif'
    }, { onConflict: 'id' });
    
    if (!upsertErr) {
      synced.push(u.email);
    }
  }

  return NextResponse.json({ success: true, synced });
}
