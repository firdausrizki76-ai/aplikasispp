const supabaseUrl = 'https://dgvfrbjtqukoqemgyofi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmZyYmp0cXVrb3FlbWd5b2ZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg3Njk3MywiZXhwIjoyMDk5NDUyOTczfQ.QzLFhAMcHo-39-QnJXn2uOcnqcMJrhhIVTjHkWHXWiQ';

async function check() {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };
  const masterRes = await fetch(`${supabaseUrl}/rest/v1/master_tagihan?select=*`, { headers });
  const masterData = await masterRes.json();
  console.log("MASTER TAGIHAN:", JSON.stringify(masterData, null, 2));
  
  const studentRes = await fetch(`${supabaseUrl}/rest/v1/students?name=eq.Fathan%20Al%20Fatih&select=*`, { headers });
  const studentData = await studentRes.json();
  console.log("STUDENT:", JSON.stringify(studentData, null, 2));

  if (studentData.length > 0) {
    const studentId = studentData[0].id;
    const billsRes = await fetch(`${supabaseUrl}/rest/v1/student_bills?student_id=eq.${studentId}&select=*`, { headers });
    const billsData = await billsRes.json();
    console.log("BILLS:", JSON.stringify(billsData, null, 2));
  }
}
check();
