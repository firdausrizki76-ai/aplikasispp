import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { jenis_tagihan, bulan_tagihan, userId } = await request.json();
    
    if (!jenis_tagihan || !bulan_tagihan) {
      return NextResponse.json({ success: false, error: 'Jenis tagihan dan bulan tagihan harus diisi' }, { status: 400 });
    }
      
    // Only delete 'Belum Lunas' to prevent deleting paid bills
    const { data: billsToDelete, error: fetchError } = await supabaseAdmin
      .from('student_bills')
      .select('id')
      .eq('jenis_tagihan', jenis_tagihan)
      .eq('bulan_tagihan', bulan_tagihan)
      .eq('status', 'Belum Lunas');
      
    if (fetchError) throw new Error(fetchError.message);
    
    if (!billsToDelete || billsToDelete.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada tagihan Belum Lunas yang ditemukan untuk kriteria tersebut', count: 0 });
    }
    
    const idsToDelete = billsToDelete.map(b => b.id);
    
    // Delete in chunks if very large, but single delete is fine for thousands usually
    const { error: deleteError } = await supabaseAdmin
      .from('student_bills')
      .delete()
      .in('id', idsToDelete);
      
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (userId) {
      await insertAuditLog(
        supabaseAdmin, 
        userId, 
        "Hapus Tagihan Masal", 
        "student_bills", 
        `Menghapus ${idsToDelete.length} tagihan ${jenis_tagihan} untuk ${bulan_tagihan}`
      );
    }

    return NextResponse.json({ success: true, message: `${idsToDelete.length} tagihan berhasil dihapus`, count: idsToDelete.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
