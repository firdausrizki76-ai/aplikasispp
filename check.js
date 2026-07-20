const https = require('https');

const supabaseUrl = new URL('https://dgvfrbjtqukoqemgyofi.supabase.co/rest/v1/student_bills?select=id&limit=10000');
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmZyYmp0cXVrb3FlbWd5b2ZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg3Njk3MywiZXhwIjoyMDk5NDUyOTczfQ.QzLFhAMcHo-39-QnJXn2uOcnqcMJrhhIVTjHkWHXWiQ';

const req = https.request({
  hostname: supabaseUrl.hostname,
  path: supabaseUrl.pathname + supabaseUrl.search,
  method: 'GET',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Fetched rows:', parsed.length);
    } catch(e) {
      console.log('Error parsing JSON');
    }
  });
});
req.end();
