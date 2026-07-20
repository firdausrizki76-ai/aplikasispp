import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export async function DELETE() {
  try {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single();
    
    if (!profile || profile.role !== 'pimpinan') {
      return NextResponse.json({ success: false, error: "Forbidden: Only pimpinan can clear logs" }, { status: 403 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials in server");
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey);

    // Hapus semua log
    const { error } = await supabase
      .from("audit_logs")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Logs cleared" });

  } catch (error: any) {
    console.error("Clear Audit Logs Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
