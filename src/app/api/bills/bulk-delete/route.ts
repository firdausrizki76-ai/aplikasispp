import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

// Initialize Supabase Admin client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { jenis_tagihan, bulan_tagihan, tahun, userId } = await request.json();
    
    if (!jenis_tagihan || !bulan_tagihan) {
      return NextResponse.json({ success: false, error: 'Jenis tagihan dan bulan tagihan harus diisi' }, { status: 400 });
    }
      
    // Only delete 'Belum Lunas' to prevent deleting paid bills
    let deleteQuery = supabaseAdmin
      .from('student_bills')
      .delete()
      .eq('jenis_tagihan', jenis_tagihan)
      .eq('status', 'Belum Lunas');
      
    if (bulan_tagihan === 'all') {
      if (!tahun) return NextResponse.json({ success: false, error: 'Tahun harus diisi' }, { status: 400 });
      deleteQuery = deleteQuery.ilike('bulan_tagihan', `%${tahun}%`);
    } else {
      deleteQuery = deleteQuery.eq('bulan_tagihan', bulan_tagihan);
    }
      
    const { data: deletedBills, error: deleteError } = await deleteQuery.select('id');
      
    if (deleteError) {
      throw new Error(deleteError.message);
    }
    
    if (!deletedBills || deletedBills.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada tagihan Belum Lunas yang ditemukan untuk kriteria tersebut', count: 0 });
    }
    
    const count = deletedBills.length;
    
    if (userId) {
      const idsToDelete = deletedBills.map((b: any) => b.id);
      
      // Fix trigger audit logs
      if (idsToDelete.length > 0) {
        await supabaseAdmin
          .from('audit_logs')
          .update({ user_id: userId })
          .in('record_id', idsToDelete)
          .is('user_id', null)
          .eq('action', 'DELETE');
      }

      await insertAuditLog(
        supabaseAdmin, 
        userId, 
        "Hapus Tagihan Masal", 
        "student_bills", 
        `Menghapus ${count} tagihan ${jenis_tagihan} untuk ${bulan_tagihan === 'all' ? `Tahun ${tahun}` : bulan_tagihan}`
      );
    }

    return NextResponse.json({ success: true, message: `${count} tagihan berhasil dihapus`, count });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
