-- Migration: 20260930110000_kid_notifications_and_sadaqah_cause.sql
-- Description: Add kid_notifications table and upgrade kid_give_sadaqah to support causes and two notifications.
-- Rollback:
--   DROP FUNCTION IF EXISTS public.kid_give_sadaqah(uuid, numeric, text);
--   DROP TABLE IF EXISTS public.kid_notifications CASCADE;
--   -- Re-create original 2-arg kid_give_sadaqah from 20260927120000_kid_atomic_and_card_controls.sql

-- 1. Create kid_notifications table
CREATE TABLE IF NOT EXISTS public.kid_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 300),
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kid_notifications_kid_created_idx
  ON public.kid_notifications (kid_id, created_at DESC);

ALTER TABLE public.kid_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kid_notifications FROM PUBLIC, anon, authenticated;
-- No policies on purpose: kids have no Supabase session, so only service_role uses this table.

-- 2. Upgrade kid_give_sadaqah with cause and dual notifications
DROP FUNCTION IF EXISTS public.kid_give_sadaqah(uuid, numeric);

CREATE OR REPLACE FUNCTION public.kid_give_sadaqah(
  p_kid_id uuid,
  p_amount numeric,
  p_cause text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_cause text := null;
  v_coins_awarded int;
  v_new_balance numeric;
  v_kid_name text;
  v_formatted_amount text;
  v_label text;
  v_kid_msg text;
  v_parent_msg text;
BEGIN
  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_cause IS NOT NULL THEN
    v_cause := btrim(p_cause);
    IF v_cause = '' OR char_length(v_cause) > 40 THEN
      RAISE EXCEPTION 'invalid_cause';
    END IF;
  END IF;

  SELECT id, parent_id, name, comfort_name, balance, coins, card_frozen, card_daily_limit
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_kid.card_frozen THEN
    RAISE EXCEPTION 'card_frozen';
  END IF;

  IF public.kid_card_spent_today(p_kid_id) + p_amount > v_kid.card_daily_limit THEN
    RAISE EXCEPTION 'card_limit_exceeded';
  END IF;

  IF v_kid.balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_coins_awarded := floor(p_amount * 2)::int;
  v_new_balance := v_kid.balance - p_amount;
  v_kid_name := coalesce(nullif(btrim(v_kid.comfort_name), ''), v_kid.name);
  v_formatted_amount := 'RM' || to_char(p_amount, 'FM999999990.00');

  UPDATE public.kids
     SET balance = v_new_balance,
         coins = coalesce(coins, 0) + v_coins_awarded
   WHERE id = p_kid_id;

  IF v_cause IS NOT NULL THEN
    v_label := 'Sadaqah to ' || v_cause;
  ELSE
    v_label := 'Sadaqah given';
  END IF;

  INSERT INTO public.transactions (kid_id, type, amount, label)
  VALUES (p_kid_id, 'SADAQAH', p_amount, v_label);

  -- Two notifications in the same transaction
  IF v_cause IS NOT NULL THEN
    v_kid_msg := 'You gave ' || v_formatted_amount || ' to ' || v_cause || '. +' || v_coins_awarded || ' points';
    v_parent_msg := v_kid_name || ' gave ' || v_formatted_amount || ' sadaqah to ' || v_cause;
  ELSE
    v_kid_msg := 'You gave ' || v_formatted_amount || '. +' || v_coins_awarded || ' points';
    v_parent_msg := v_kid_name || ' gave ' || v_formatted_amount || ' sadaqah';
  END IF;

  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
  VALUES (p_kid_id, 'SADAQAH', v_kid_msg, '/kid/sadaqah');

  IF v_kid.parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
    VALUES (v_kid.parent_id, p_kid_id, 'SADAQAH', v_parent_msg, '/parent');
  END IF;

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'coins_awarded', v_coins_awarded,
    'cause', v_cause
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kid_give_sadaqah(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_give_sadaqah(uuid, numeric, text) TO service_role;
