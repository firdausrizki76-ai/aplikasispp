import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/utils/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      candidateId,
      classId,
      nis = null,
      userId = null
    } = body;

    if (!candidateId || !classId) {
      return NextResponse.json(
        { success: false, error: 'ID calon siswa dan pilihan kelas wajib diisi.' },
        { status: 400 }
      );
    }

    // Call stored procedure
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('sync_psb_candidate_to_student', {
      p_candidate_id: candidateId,
      p_class_id: classId,
      p_nis: nis && nis.trim() !== '' ? nis.trim() : null,
      p_admin_id: userId
    });

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 400 }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      return NextResponse.json(
        { success: false, error: rpcResult?.error || 'Gagal menyinkronkan siswa ke kelas.' },
        { status: 400 }
      );
    }

    if (userId) {
      await insertAuditLog(
        supabaseAdmin,
        userId,
        'Sinkronisasi PSB ke Siswa Aktif',
        'students',
        `Memasukkan calon siswa ${rpcResult.student_name} ke kelas ${rpcResult.class_name} (${rpcResult.grade_level})`
      );
    }

    return NextResponse.json({
      success: true,
      studentId: rpcResult.student_id,
      studentName: rpcResult.student_name,
      className: rpcResult.class_name,
      gradeLevel: rpcResult.grade_level,
      message: `Berhasil menempatkan ${rpcResult.student_name} ke kelas ${rpcResult.class_name}!`
    });
  } catch (error: any) {
    console.error('Error in /api/psb/sync:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan server saat sinkronisasi siswa.' },
      { status: 500 }
    );
  }
}
