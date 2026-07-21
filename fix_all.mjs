import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: masterBills } = await supabase.from('master_tagihan').select('*');
  const masterMap = {};
  masterBills.forEach(m => {
    masterMap[m.nama_tagihan] = Number(m.nominal_default);
  });

  const { data: students } = await supabase.from('students').select('*').not('diskon', 'is', null);
  
  let updatedCount = 0;
  for (const student of students) {
    if (!student.diskon || Object.keys(student.diskon).length === 0) continue;
    
    const { data: bills } = await supabase.from('student_bills')
      .select('*')
      .eq('student_id', student.id)
      .eq('status', 'Belum Lunas');
      
    if (!bills) continue;
    
    for (const bill of bills) {
      if (student.diskon[bill.jenis_tagihan]) {
        const diskonNominal = student.diskon[bill.jenis_tagihan];
        const defaultNominal = masterMap[bill.jenis_tagihan] || 0;
        const newNominal = Math.max(0, defaultNominal - diskonNominal);
        
        if (newNominal !== Number(bill.nominal)) {
          console.log(`Fixing bill for ${student.name} (${bill.jenis_tagihan}): ${bill.nominal} -> ${newNominal}`);
          await supabase.from('student_bills').update({ nominal: newNominal }).eq('id', bill.id);
          updatedCount++;
        }
      }
    }
  }
  
  console.log(`Finished. Updated ${updatedCount} bills.`);
}

run();
