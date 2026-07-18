const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dgvfrbjtqukoqemgyofi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmZyYmp0cXVrb3FlbWd5b2ZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg3Njk3MywiZXhwIjoyMDk5NDUyOTczfQ.QzLFhAMcHo-39-QnJXn2uOcnqcMJrhhIVTjHkWHXWiQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log("Nullifying foreign keys to avoid cascade errors...");
  const { error: txError } = await supabase.from('payment_transactions').update({ admin_id: null }).not('admin_id', 'is', null);
  if (txError) console.error("Error updating payment_transactions:", txError.message);
  
  const { error: auditError } = await supabase.from('audit_logs').update({ user_id: null }).not('user_id', 'is', null);
  if (auditError) console.error("Error updating audit_logs:", auditError.message);

  console.log("Fetching all users...");
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }
  
  const users = usersData.users;
  console.log(`Found ${users.length} users. Deleting...`);
  
  for (const user of users) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`Failed to delete user ${user.id}:`, delError);
    } else {
      console.log(`Deleted user ${user.email}`);
    }
  }

  console.log("Cleaning up public.profiles...");
  const { error: profileDelError } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (profileDelError) {
      console.log("Note:", profileDelError.message);
  }

  console.log("Creating new pimpinan account...");
  const email = "pimpinan@tarunaislam.sch.id"; // Using a more appropriate email
  const password = "password123";
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Pimpinan Yayasan',
      role: 'pimpinan'
    }
  });

  if (createError) {
    console.error("Error creating user:", createError);
    return;
  }

  console.log("User created in auth.users:", newUser.user.email);
  
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: newUser.user.id,
    email,
    full_name: 'Pimpinan Yayasan',
    role: 'pimpinan',
    status: 'aktif'
  });

  if (profileError) {
    console.error("Error creating profile:", profileError);
  } else {
    console.log("Profile created successfully!");
    console.log("--- NEW CREDENTIALS ---");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("-----------------------");
  }
}

main();
