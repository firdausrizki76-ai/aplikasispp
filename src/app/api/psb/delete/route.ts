import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { candidateId, userId = null } = body;

    if (!candidateId) {
      return NextResponse.json(
        { success: false, error: 'ID calon siswa wajib disertakan.' },
        { status: 400 }
      );
    }

    const { data: candidate, error: fetchErr } = await supabaseAdmin
      .from('psb_candidates')
      .select('full_name, registration_no, total_paid')
      .eq('id', candidateId)
      .single();

    if (fetchErr || !candidate) {
      return NextResponse.json(
        { success: false, error: 'Data calon siswa tidak ditemukan.' },
        { status: 404 }
      );
    }

    const { error: delErr } = await supabaseAdmin
      .from('psb_candidates')
      .delete()
      .eq('id', candidateId);

    if (delErr) {
      throw delErr;
    }

    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        'Hapus Calon Siswa PSB',
        'psb_candidates',
        `Menghapus data pendaftaran calon siswa ${candidate.full_name} (${candidate.registration_no})`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Data calon siswa berhasil dihapus.'
    });
  } catch (error: any) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus data calon siswa.' },
      { status: 500 }
    );
  }
}
