import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { insertAuditLog } from '@/utils/audit';

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { target, filterType, filterValue } = await request.json();

    if (!['students', 'classes'].includes(target)) {
      return NextResponse.json({ success: false, error: "Target tidak valid" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let query = supabaseAdmin.from(target).delete();

    if (filterType === 'all') {
      // Supabase requires a filter for delete, even if it's "all"
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    } else if (filterType === 'jenjang') {
      if (!filterValue) return NextResponse.json({ success: false, error: "Jenjang harus diisi" }, { status: 400 });
      query = query.eq('grade_level', filterValue);
    } else if (filterType === 'kelas' && target === 'students') {
      if (!filterValue) return NextResponse.json({ success: false, error: "Kelas harus diisi" }, { status: 400 });
      // filterValue should be class_name, since that's easier to pass from UI
      query = query.eq('class_name', filterValue); 
    } else {
       return NextResponse.json({ success: false, error: "Filter tidak valid" }, { status: 400 });
    }

    const { error } = await query;

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ success: false, error: "Gagal: Masih ada data yang bergantung pada data ini (Pastikan kelas yang ingin dihapus sudah kosong dari siswa)." }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await insertAuditLog(
      supabaseAdmin,
      user.id,
      "Hapus Data Masal",
      target,
      `Menghapus data ${target} dengan filter ${filterType} = ${filterValue || 'Semua'}`
    );
    
    // Fix audit log trigger's missing user_id for bulk deletes
    // We update all recent null user_ids for this table and action
    await supabaseAdmin.from('audit_logs').update({ user_id: user.id }).is('user_id', null).eq('table_name', target).eq('action', 'DELETE');

    return NextResponse.json({ success: true, message: `Data ${target} berhasil dihapus secara masal.` });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
