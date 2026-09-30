-- ============================================================
-- Migration: Fix session_token + add investment risk columns
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- 1. Session token for kid auth
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS session_token text;
CREATE INDEX IF NOT EXISTS kids_session_token_idx ON public.kids(session_token);

-- 2. Username-based login fields
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS hashed_pin text;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS failed_login_attempts int DEFAULT 0;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS last_login_date text;

-- 3. Username index (for fast login lookups)
CREATE INDEX IF NOT EXISTS kids_username_idx ON public.kids(username);
CREATE INDEX IF NOT EXISTS kids_login_code_idx ON public.kids(login_code);

-- 4. Investment risk system (kid-controlled)
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS risk_appetite text DEFAULT 'low';
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_frequency text DEFAULT 'daily';
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_last_settled timestamptz;

-- 5. Kid profile fields
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS birth_date text;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS birth_year int;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS avatar text;

-- 6. Quiz tracking
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_date text;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_correct int DEFAULT 0;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_wrong int DEFAULT 0;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_index int DEFAULT 0;

-- 7. Investment balance
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_balance numeric DEFAULT 0;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_rate numeric DEFAULT 0.02;

-- 8. Bridge key hash (for kid registration flow)
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS bridge_key_hash text;

-- 9. Profiles avatar
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar text;

-- 10. Commander pins table (if not exists)
CREATE TABLE IF NOT EXISTS public.commander_pins (
  parent_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commander_pins ENABLE ROW LEVEL SECURITY;
-- Allow parents to read/write their own pin
DO $$ BEGIN
  CREATE POLICY "own pin read" ON public.commander_pins FOR SELECT USING (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own pin insert" ON public.commander_pins FOR INSERT WITH CHECK (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own pin update" ON public.commander_pins FOR UPDATE USING (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 11. Child creation keys (for kid self-registration)
CREATE TABLE IF NOT EXISTS public.child_creation_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hashed_key text NOT NULL,
  salt text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kid_id uuid REFERENCES public.kids(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "parent reads notifications" ON public.notifications FOR SELECT USING (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "parent updates notifications" ON public.notifications FOR UPDATE USING (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 13. Quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  question_index int NOT NULL,
  question_text text NOT NULL DEFAULT '',
  correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "parent reads quiz_attempts" ON public.quiz_attempts FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.parent_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 14. Scheduled hibahs table
CREATE TABLE IF NOT EXISTS public.scheduled_hibahs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kid_id uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  next_run_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_hibahs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "parent rw scheduled_hibahs" ON public.scheduled_hibahs FOR ALL
    USING (auth.uid() = parent_id) WITH CHECK (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Done! All columns and tables are now guaranteed to exist.
