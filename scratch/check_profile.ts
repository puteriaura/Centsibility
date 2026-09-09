import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users?.users.find(u => u.email === 'test@centsibility.com');
  console.log('User:', user?.id);

  if (user) {
    const { data: profile, error } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle();
    console.log('Profile:', profile, error);
    if (!profile) {
      console.log('Inserting profile...');
      const { error: insertError } = await supabaseAdmin.from('profiles').insert({ id: user.id, email: user.email, display_name: 'Test Parent' });
      console.log('Insert Error:', insertError);
    }
  }
}

check();
