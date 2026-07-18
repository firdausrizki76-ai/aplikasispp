import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role } = await request.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Fitur terkunci. Tambahkan SUPABASE_SERVICE_ROLE_KEY di .env.local untuk mengaktifkan.' },
        { status: 500 }
      );
    }

    // Menggunakan Service Role Client (Bypass RLS, Admin Access)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Buat user di Supabase Auth (auth.users)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name,
        role: role
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (authData?.user) {
      // 2. Buat atau update row di public.profiles
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: email,
          full_name: full_name,
          role: role,
          status: 'aktif'
        });
        
      if (profileError) {
        console.error("Gagal mengupdate profile:", profileError);
      }
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, email, password, full_name, role, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID user wajib diisi' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Fitur terkunci. Tambahkan SUPABASE_SERVICE_ROLE_KEY di .env.local untuk mengaktifkan.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authUpdateData: any = {};
    if (email) authUpdateData.email = email;
    if (password) authUpdateData.password = password;
    if (full_name || role) {
      authUpdateData.user_metadata = {};
      if (full_name) authUpdateData.user_metadata.full_name = full_name;
      if (role) authUpdateData.user_metadata.role = role;
    }

    if (Object.keys(authUpdateData).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdateData);
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    const profileUpdateData: any = {};
    if (email) profileUpdateData.email = email;
    if (full_name) profileUpdateData.full_name = full_name;
    if (role) profileUpdateData.role = role;
    if (status) profileUpdateData.status = status;

    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdateData)
        .eq('id', id);
        
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

