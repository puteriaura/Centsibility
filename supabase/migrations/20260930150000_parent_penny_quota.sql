-- Migration: 20260930150000_parent_penny_quota.sql
-- Summary: Adds penny_ai_date and penny_ai_count columns to public.profiles,
--          and atomic parent_consume_penny_quota function enforcing a daily AI message cap.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.parent_consume_penny_quota(uuid, int);
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS penny_ai_count;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS penny_ai_date;

-- 1. Add quota tracking columns on profiles (parents)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS penny_ai_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS penny_ai_count int NOT NULL DEFAULT 0;

-- 2. parent_consume_penny_quota(p_parent_id uuid, p_limit int) returns int (remaining messages)
CREATE OR REPLACE FUNCTION public.parent_consume_penny_quota(
  p_parent_id uuid,
  p_limit int DEFAULT 30
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_parent record;
  v_count int;
  v_remaining int;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

  SELECT id, penny_ai_date, coalesce(penny_ai_count, 0) AS penny_ai_count
    INTO v_parent
    FROM public.profiles
   WHERE id = p_parent_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Reset count if new day in Asia/Kuala_Lumpur
  IF v_parent.penny_ai_date IS NULL OR v_parent.penny_ai_date <> v_today THEN
    v_count := 0;
  ELSE
    v_count := v_parent.penny_ai_count;
  END IF;

  -- Enforce quota
  IF v_count >= p_limit THEN
    RAISE EXCEPTION 'quota_exceeded';
  END IF;

  v_count := v_count + 1;
  v_remaining := p_limit - v_count;

  UPDATE public.profiles
     SET penny_ai_date = v_today,
         penny_ai_count = v_count
   WHERE id = p_parent_id;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.parent_consume_penny_quota(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_consume_penny_quota(uuid, int) TO service_role;
