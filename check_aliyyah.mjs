import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('students').select('id, name, diskon').ilike('name', '%Aliyyah%');
  console.log("Aliyyah Data:", JSON.stringify(data, null, 2));

  if (data && data.length > 0) {
    const aliyyahId = data[0].id;
    const { data: bills } = await supabase.from('student_bills').select('id, jenis_tagihan, nominal').eq('student_id', aliyyahId);
    console.log("Bills:", JSON.stringify(bills, null, 2));
  }
}

run();
