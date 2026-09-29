-- Migration: 20260927100000_parent_pin_hardening.sql
-- Purpose: Hardens parent PIN security:
--   1. Adds failed_attempts and locked_until to commander_pins.
--   2. Revokes client access (anon, authenticated) and drops direct RLS policies on commander_pins.
--   3. Wipes and drops legacy plaintext profiles.pin column.
--   4. Introduces parent_pin_begin_attempt and parent_pin_attempt_succeeded SECURITY DEFINER RPCs.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.parent_pin_begin_attempt(uuid);
--   DROP FUNCTION IF EXISTS public.parent_pin_attempt_succeeded(uuid, text);
--   ALTER TABLE public.commander_pins DROP COLUMN IF EXISTS failed_attempts;
--   ALTER TABLE public.commander_pins DROP COLUMN IF EXISTS locked_until;
--   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin text;
--   GRANT ALL ON TABLE public.commander_pins TO authenticated;
--   CREATE POLICY "own pin read" ON public.commander_pins FOR SELECT USING (auth.uid() = parent_id);
--   CREATE POLICY "own pin insert" ON public.commander_pins FOR INSERT WITH CHECK (auth.uid() = parent_id);
--   CREATE POLICY "own pin update" ON public.commander_pins FOR UPDATE USING (auth.uid() = parent_id);

ALTER TABLE public.commander_pins
  ADD COLUMN IF NOT EXISTS failed_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

DROP POLICY IF EXISTS "own pin read" ON public.commander_pins;
DROP POLICY IF EXISTS "own pin insert" ON public.commander_pins;
DROP POLICY IF EXISTS "own pin update" ON public.commander_pins;

REVOKE ALL ON TABLE public.commander_pins FROM anon, authenticated;
ALTER TABLE public.commander_pins ENABLE ROW LEVEL SECURITY;

-- Clear, then drop, legacy plaintext column
UPDATE public.profiles SET pin = null WHERE pin IS NOT NULL;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin;

CREATE OR REPLACE FUNCTION public.parent_pin_begin_attempt(p_parent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.commander_pins%ROWTYPE;
  v_retry_after integer;
BEGIN
  SELECT * INTO v_row FROM public.commander_pins WHERE parent_id = p_parent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_pin');
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_row.locked_until - now())))::integer;
    RETURN jsonb_build_object(
      'status', 'locked',
      'retry_after_seconds', GREATEST(1, v_retry_after)
    );
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    v_row.failed_attempts := 0;
    v_row.locked_until := null;
  END IF;

  v_row.failed_attempts := v_row.failed_attempts + 1;
  IF v_row.failed_attempts >= 5 THEN
    v_row.locked_until := now() + interval '15 minutes';
  END IF;

  UPDATE public.commander_pins
  SET failed_attempts = v_row.failed_attempts,
      locked_until = v_row.locked_until
  WHERE parent_id = p_parent_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pin_hash', v_row.pin_hash,
    'attempt', v_row.failed_attempts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.parent_pin_begin_attempt(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_pin_begin_attempt(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.parent_pin_attempt_succeeded(
  p_parent_id uuid,
  p_new_hash text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.commander_pins
  SET failed_attempts = 0,
      locked_until = null,
      pin_hash = coalesce(p_new_hash, pin_hash)
  WHERE parent_id = p_parent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.parent_pin_attempt_succeeded(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_pin_attempt_succeeded(uuid, text) TO service_role;
