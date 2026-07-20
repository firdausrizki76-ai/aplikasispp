const supabaseUrl = 'https://dgvfrbjtqukoqemgyofi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmZyYmp0cXVrb3FlbWd5b2ZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg3Njk3MywiZXhwIjoyMDk5NDUyOTczfQ.QzLFhAMcHo-39-QnJXn2uOcnqcMJrhhIVTjHkWHXWiQ';

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/payment_transactions?select=*&limit=5`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
