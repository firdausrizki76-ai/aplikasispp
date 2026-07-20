import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper function to increment class names (Arabic and Roman numerals)
function incrementClassName(className: string): string {
  // Regex for Roman numerals (1 to 8 only, since 6 and 9 graduate)
  const romanMap: Record<string, string> = {
    'I': 'II', 'II': 'III', 'III': 'IV', 'IV': 'V', 'V': 'VI',
    'VII': 'VIII', 'VIII': 'IX'
  };

  // Check Roman Numerals first (Word boundaries are important to not replace "I" inside "IPA")
  let updated = false;
  let newName = className.replace(/\b(VIII|VII|VI|IV|V|III|II|I)\b/g, (match) => {
    if (romanMap[match]) {
      updated = true;
      return romanMap[match];
    }
    return match;
  });

  if (updated) return newName;

  // If no Roman numeral, check Arabic digits
  newName = className.replace(/\d+/, (match) => {
    return (parseInt(match) + 1).toString();
  });

  return newName;
}

function isGraduating(className: string, gradeLevel: string): boolean {
  const upper = className.toUpperCase();
  if (gradeLevel === 'SD') {
    return upper.includes('6') || /\bVI\b/.test(upper);
  } else if (gradeLevel === 'SMP') {
    return upper.includes('9') || upper.includes('3') || /\bIX\b/.test(upper) || /\bIII\b/.test(upper);
  }
  return false;
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Kredensial database tidak lengkap.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch data
    const { data: students, error: studentsErr } = await supabase
      .from('students')
      .select('*, classes(class_name, grade_level)')
      .eq('status', 'aktif');

    if (studentsErr) throw new Error(studentsErr.message);

    const { data: classesList, error: classErr } = await supabase
      .from('classes')
      .select('*');

    if (classErr) throw new Error(classErr.message);

    let existingClasses = [...(classesList || [])];

    const studentUpdates = [];
    const newClassesToCreate = new Map<string, any>(); // key: class_name_grade_level

    // 2. Process each student
    for (const student of students || []) {
      const currentClass = student.classes;
      if (!currentClass) continue;

      const className = currentClass.class_name;
      const gradeLevel = currentClass.grade_level || student.grade_level;

      if (!className) continue;

      // Check Graduation
      if (isGraduating(className, gradeLevel)) {
        studentUpdates.push({
          id: student.id,
          status: 'lulus',
          class_id: null // Remove them from active class
        });
        continue;
      }

      // Increment Grade
      const nextClassName = incrementClassName(className);
      
      // Find matching class
      let nextClass = existingClasses.find(c => c.class_name === nextClassName && c.grade_level === gradeLevel);
      
      if (!nextClass) {
        // We need to create this class
        const key = `${nextClassName}_${gradeLevel}`;
        if (!newClassesToCreate.has(key)) {
          const newId = crypto.randomUUID();
          const newClassData = {
            id: newId,
            class_name: nextClassName,
            grade_level: gradeLevel,
            homeroom_teacher: 'Belum Ditentukan'
          };
          newClassesToCreate.set(key, newClassData);
          existingClasses.push(newClassData); // Add to local pool to avoid duplicates
          nextClass = newClassData;
        } else {
          nextClass = newClassesToCreate.get(key);
        }
      }

      studentUpdates.push({
        id: student.id,
        class_id: nextClass.id
      });
    }

    // 3. Create missing classes
    if (newClassesToCreate.size > 0) {
      const classesToInsert = Array.from(newClassesToCreate.values());
      const { error: insertErr } = await supabase.from('classes').insert(classesToInsert);
      if (insertErr) throw new Error('Gagal membuat kelas baru: ' + insertErr.message);
    }

    // 4. Update students
    if (studentUpdates.length > 0) {
      // Supabase doesn't support bulk updates natively with different values per row easily via standard API, 
      // but we can upsert if we provide all required fields. However, just updating what changed is better done by looping
      // Or we can just use `upsert` on the students table.
      for (const update of studentUpdates) {
        const { error: updateErr } = await supabase.from('students').update(update).eq('id', update.id);
        if (updateErr) {
          console.error("Failed to update student", update.id, updateErr);
        }
      }
    }

    // 5. Delete bills and transactions
    const { error: delTransErr } = await supabase.from('payment_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
    if (delTransErr) throw new Error('Gagal menghapus transaksi: ' + delTransErr.message);

    // Hanya hapus tagihan yang sudah lunas
    const { error: delBillsErr } = await supabase.from('student_bills').delete().eq('status', 'Lunas');
    if (delBillsErr) throw new Error('Gagal menghapus tagihan lunas: ' + delBillsErr.message);

    // Tandai tagihan yang belum lunas sebagai tagihan dari tahun ajaran sebelumnya
    let allUnpaidBills: any[] = [];
    let from = 0;
    const step = 1000;
    
    while (true) {
      const { data, error } = await supabase.from('student_bills')
        .select('*')
        .eq('status', 'Belum Lunas')
        .range(from, from + step - 1);
        
      if (error) break;
      if (data) {
        allUnpaidBills = [...allUnpaidBills, ...data];
        if (data.length < step) break;
      } else {
        break;
      }
      from += step;
    }

    if (allUnpaidBills.length > 0) {
      for (const bill of allUnpaidBills) {
        if (bill.bulan_tagihan && !bill.bulan_tagihan.includes('T.A. Lalu')) {
          await supabase.from('student_bills').update({
            bulan_tagihan: `${bill.bulan_tagihan} (T.A. Lalu)`
          }).eq('id', bill.id);
        }
      }
    }

    // Add Audit Log
    await supabase.from("audit_logs").insert({
      user_id: null,
      action: "Tutup Buku",
      table_name: "Tahun Ajaran",
      details: "Sistem telah memproses kenaikan kelas siswa dan mereset data keuangan untuk tahun ajaran baru."
    });

    return NextResponse.json({ success: true, message: "Proses tutup buku berhasil!" });

  } catch (error: any) {
    console.error("Tutup Buku Error:", error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
