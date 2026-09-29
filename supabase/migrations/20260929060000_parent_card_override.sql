-- Migration: 20260929060000_parent_card_override.sql
-- Purpose:
--   1. Add card_controls_locked column to kids table (default false).
--   2. Provide parent_set_card_controls RPC to allow parents to override and lock card settings (limit, freeze, online).
--   3. Update kid_set_card_controls RPC to enforce card_controls_locked (tightening allowed, loosening raises 'card_locked').
-- Rollback:
--   DROP FUNCTION IF EXISTS public.parent_set_card_controls(uuid, uuid, boolean, numeric, boolean, boolean);
--   -- Restore earlier version of kid_set_card_controls from 20260927120000_kid_atomic_and_card_controls.sql
--   ALTER TABLE public.kids DROP COLUMN IF EXISTS card_controls_locked;

ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS card_controls_locked boolean NOT NULL DEFAULT false;

-- 1. parent_set_card_controls
CREATE OR REPLACE FUNCTION public.parent_set_card_controls(
  p_kid_id uuid,
  p_parent_id uuid,
  p_frozen boolean DEFAULT null,
  p_daily_limit numeric DEFAULT null,
  p_online_enabled boolean DEFAULT null,
  p_locked boolean DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
BEGIN
  SELECT id, parent_id, card_frozen, card_daily_limit, card_online_enabled, card_controls_locked
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND OR v_kid.parent_id <> p_parent_id THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_daily_limit IS NOT NULL AND (p_daily_limit < 10 OR p_daily_limit > 200) THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  UPDATE public.kids
     SET card_frozen = coalesce(p_frozen, card_frozen),
         card_daily_limit = coalesce(p_daily_limit, card_daily_limit),
         card_online_enabled = coalesce(p_online_enabled, card_online_enabled),
         card_controls_locked = coalesce(p_locked, card_controls_locked)
   WHERE id = p_kid_id
  RETURNING card_frozen, card_daily_limit, card_online_enabled, card_controls_locked
    INTO v_kid;

  RETURN jsonb_build_object(
    'card_frozen', v_kid.card_frozen,
    'card_daily_limit', v_kid.card_daily_limit,
    'card_online_enabled', v_kid.card_online_enabled,
    'card_controls_locked', v_kid.card_controls_locked
  );
END;
$$;

-- 2. kid_set_card_controls (with locking enforcement)
CREATE OR REPLACE FUNCTION public.kid_set_card_controls(
  p_kid_id uuid,
  p_frozen boolean DEFAULT null,
  p_daily_limit numeric DEFAULT null,
  p_online_enabled boolean DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
BEGIN
  SELECT id, card_frozen, card_daily_limit, card_online_enabled, card_controls_locked
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_daily_limit IS NOT NULL AND (p_daily_limit < 10 OR p_daily_limit > 200) THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  -- When card_controls_locked is true, loosening settings raises card_locked
  IF v_kid.card_controls_locked THEN
    IF (p_frozen IS NOT NULL AND p_frozen = false AND v_kid.card_frozen = true) OR
       (p_daily_limit IS NOT NULL AND p_daily_limit > v_kid.card_daily_limit) OR
       (p_online_enabled IS NOT NULL AND p_online_enabled = true AND v_kid.card_online_enabled = false) THEN
      RAISE EXCEPTION 'card_locked';
    END IF;
  END IF;

  UPDATE public.kids
     SET card_frozen = coalesce(p_frozen, card_frozen),
         card_daily_limit = coalesce(p_daily_limit, card_daily_limit),
         card_online_enabled = coalesce(p_online_enabled, card_online_enabled)
   WHERE id = p_kid_id
  RETURNING card_frozen, card_daily_limit, card_online_enabled, card_controls_locked
    INTO v_kid;

  RETURN jsonb_build_object(
    'card_frozen', v_kid.card_frozen,
    'card_daily_limit', v_kid.card_daily_limit,
    'card_online_enabled', v_kid.card_online_enabled,
    'card_controls_locked', v_kid.card_controls_locked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.parent_set_card_controls(uuid, uuid, boolean, numeric, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_set_card_controls(uuid, uuid, boolean, numeric, boolean, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.kid_set_card_controls(uuid, boolean, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_set_card_controls(uuid, boolean, numeric, boolean) TO service_role;
