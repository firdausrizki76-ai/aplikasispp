import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertAuditLog } from '@/utils/audit';

export async function POST(req: Request) {
  try {
    const { sale_id, item_name, quantity, userId } = await req.json();
    
    if (!sale_id || !item_name || !quantity) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Delete the sale transaction
    const { error } = await supabaseAdmin.from('sales').delete().eq('id', sale_id);
    if (error) throw error;

    // Get current stock by item_name
    const { data: item } = await supabaseAdmin.from('inventory').select('id, stock_quantity').eq('item_name', item_name).single();
    if (item) {
      const newStock = item.stock_quantity + parseInt(quantity);
      await supabaseAdmin.from('inventory').update({ stock_quantity: newStock }).eq('id', item.id);
    }
    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        "Hapus Transaksi Seragam",
        "sales",
        `Menghapus transaksi seragam sebesar Rp ${sale.total_price}`
      );
      
      // Fix audit log trigger's missing user_id
      await supabaseAdmin.from('audit_logs').update({ user_id: userId }).eq('record_id', sale_id).is('user_id', null).eq('action', 'DELETE');
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
