-- Migration: 20260928000000_penny_ai_quota.sql
-- Summary: Adds penny_ai_date and penny_ai_count columns to public.kids,
--          and atomic kid_consume_penny_quota function enforcing a daily AI message cap.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.kid_consume_penny_quota(uuid, int);
--   ALTER TABLE public.kids DROP COLUMN IF EXISTS penny_ai_count;
--   ALTER TABLE public.kids DROP COLUMN IF EXISTS penny_ai_date;

-- 1. Add quota tracking columns on kids
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS penny_ai_date date;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS penny_ai_count int NOT NULL DEFAULT 0;

-- 2. kid_consume_penny_quota(p_kid_id uuid, p_limit int) returns int (remaining messages)
CREATE OR REPLACE FUNCTION public.kid_consume_penny_quota(
  p_kid_id uuid,
  p_limit int DEFAULT 30
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_kid record;
  v_count int;
  v_remaining int;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

  SELECT id, penny_ai_date, coalesce(penny_ai_count, 0) AS penny_ai_count
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Reset count if new day in Asia/Kuala_Lumpur
  IF v_kid.penny_ai_date IS NULL OR v_kid.penny_ai_date <> v_today THEN
    v_count := 0;
  ELSE
    v_count := v_kid.penny_ai_count;
  END IF;

  -- Enforce quota
  IF v_count >= p_limit THEN
    RAISE EXCEPTION 'quota_exceeded';
  END IF;

  v_count := v_count + 1;
  v_remaining := p_limit - v_count;

  UPDATE public.kids
     SET penny_ai_date = v_today,
         penny_ai_count = v_count
   WHERE id = p_kid_id;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.kid_consume_penny_quota(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_consume_penny_quota(uuid, int) TO service_role;
