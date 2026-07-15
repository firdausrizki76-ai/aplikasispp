import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials in server");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
