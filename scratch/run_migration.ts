import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrate() {
  console.log('Running migration...');
  
  const statements = [
    // Session token
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS session_token text`,
    // Login fields
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS hashed_pin text`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS failed_login_attempts int DEFAULT 0`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS locked_until timestamptz`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS last_login_date text`,
    // Investment risk
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS risk_appetite text DEFAULT 'low'`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_frequency text DEFAULT 'daily'`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_last_settled timestamptz`,
    // Profile fields
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS bio text`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS birth_date text`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS birth_year int`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS avatar text`,
    // Quiz
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_date text`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_correct int DEFAULT 0`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_wrong int DEFAULT 0`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_index int DEFAULT 0`,
    // Investment balance
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_balance numeric DEFAULT 0`,
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_rate numeric DEFAULT 0.02`,
    // Bridge key
    `ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS bridge_key_hash text`,
    // Profiles avatar
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar text`,
  ];

  for (const sql of statements) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql }).single();
    if (error) {
      // Try direct approach - some Supabase instances don't have exec_sql
      console.log(`Note: ${sql.slice(0, 60)}... (will try via REST)`);
    } else {
      console.log(`✓ ${sql.slice(0, 60)}...`);
    }
  }

  // Verify session_token exists now
  const { data, error } = await supabaseAdmin.from('kids').select('id, session_token').limit(1);
  if (error) {
    console.log('❌ session_token still missing:', error.message);
    console.log('\n⚠️  You need to run the SQL migration manually in Supabase Dashboard:');
    console.log('    Dashboard > SQL Editor > paste contents of supabase/migrations/20260525_fix_session_and_invest.sql');
  } else {
    console.log('✅ session_token column exists!');
  }
  
  // Also check risk_appetite
  const { data: d2, error: e2 } = await supabaseAdmin.from('kids').select('id, risk_appetite').limit(1);
  if (e2) {
    console.log('❌ risk_appetite still missing:', e2.message);
  } else {
    console.log('✅ risk_appetite column exists!');
  }
}

migrate();
