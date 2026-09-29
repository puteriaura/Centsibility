-- Migration: 20260929010000_parent_pin_sessions.sql
-- Purpose:
--   Add parent_pin_sessions table and management functions for server-verified PIN sessions.
--   Restricts financial and structural parent mutations behind a verified 30-minute PIN session token.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.parent_pin_sessions_clear(uuid);
--   DROP FUNCTION IF EXISTS public.parent_pin_session_valid(uuid, text);
--   DROP FUNCTION IF EXISTS public.parent_pin_session_create(uuid, text, int);
--   DROP TABLE IF EXISTS public.parent_pin_sessions CASCADE;

-- 1. Table: parent_pin_sessions
CREATE TABLE IF NOT EXISTS public.parent_pin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_pin_sessions_parent_id_idx
  ON public.parent_pin_sessions(parent_id);

ALTER TABLE public.parent_pin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.parent_pin_sessions FROM public, anon, authenticated;

-- 2. Function: parent_pin_session_create
CREATE OR REPLACE FUNCTION public.parent_pin_session_create(
  p_parent_id uuid,
  p_token_hash text,
  p_ttl_minutes int DEFAULT 30
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz;
BEGIN
  -- Clean up expired sessions for this parent
  DELETE FROM public.parent_pin_sessions
   WHERE parent_id = p_parent_id
     AND expires_at <= now();

  v_expires_at := now() + (COALESCE(p_ttl_minutes, 30) || ' minutes')::interval;

  INSERT INTO public.parent_pin_sessions (parent_id, token_hash, expires_at)
  VALUES (p_parent_id, p_token_hash, v_expires_at);

  RETURN v_expires_at;
END;
$$;

-- 3. Function: parent_pin_session_valid
CREATE OR REPLACE FUNCTION public.parent_pin_session_valid(
  p_parent_id uuid,
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.parent_pin_sessions
     WHERE parent_id = p_parent_id
       AND token_hash = p_token_hash
       AND expires_at > now()
  );
END;
$$;

-- 4. Function: parent_pin_sessions_clear
CREATE OR REPLACE FUNCTION public.parent_pin_sessions_clear(
  p_parent_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.parent_pin_sessions
   WHERE parent_id = p_parent_id;
END;
$$;

-- 5. Revoke/Grant permissions (service_role only)
REVOKE ALL ON FUNCTION public.parent_pin_session_create(uuid, text, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_pin_session_create(uuid, text, int) TO service_role;

REVOKE ALL ON FUNCTION public.parent_pin_session_valid(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_pin_session_valid(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.parent_pin_sessions_clear(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_pin_sessions_clear(uuid) TO service_role;
