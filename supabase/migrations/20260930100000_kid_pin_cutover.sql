-- Migration: 20260930100000_kid_pin_cutover.sql
-- Description: Cutover to mandatory 6-digit PINs for both kids and parents.
--
-- Why existing PINs are cleared:
-- Legacy 4-digit PINs are no longer accepted. For kids, existing hashed_pin and
-- session_token are cleared so each kid must redeem a fresh one-time access code
-- and set a secure 6-digit PIN. For parents, commander_pins and parent_pin_sessions
-- are cleared so each parent sets a 6-digit PIN during onboarding.
--
-- Rollback note:
-- To rollback, restore commander_pins and kids (hashed_pin, login_code) from the
-- predeploy backup, or drop the comfort_name column if needed:
-- ALTER TABLE public.kids DROP COLUMN IF EXISTS comfort_name;

-- 1. Add comfort_name to kids table with 1-30 char check
ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS comfort_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kids_comfort_name_check'
  ) THEN
    ALTER TABLE public.kids
      ADD CONSTRAINT kids_comfort_name_check
      CHECK (comfort_name IS NULL OR char_length(btrim(comfort_name)) BETWEEN 1 AND 30);
  END IF;
END $$;

-- 2. Reset every kid: clear PIN/session, assign fresh unique 6-character code
-- Alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (32 chars, excludes 0, 1, I, O)
DO $$
DECLARE
  v_kid record;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_collision boolean;
BEGIN
  FOR v_kid IN SELECT id FROM public.kids LOOP
    LOOP
      v_code := '';
      FOR v_i IN 1..6 LOOP
        v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
      END LOOP;

      SELECT EXISTS (
        SELECT 1 FROM public.kids WHERE login_code = v_code AND id <> v_kid.id
      ) INTO v_collision;

      EXIT WHEN NOT v_collision;
    END LOOP;

    UPDATE public.kids
       SET hashed_pin = NULL,
           session_token = NULL,
           login_code = v_code,
           failed_login_attempts = 0,
           locked_until = NULL
     WHERE id = v_kid.id;
  END LOOP;
END $$;

-- 3. Reset parent PINs and sessions so parents set 6-digit PIN on next login
DELETE FROM public.commander_pins;
DELETE FROM public.parent_pin_sessions;
