-- Migration: 20260929040000_invest_settle_in_sql.sql
-- Purpose:
--   T14: Move investment settlement calculation entirely into SQL under the kid row lock.
--   Prevents race conditions where a settlement computed from a stale client balance would overwrite
--   a concurrent wallet deposit.
--   Records investment value changes as pot-only ledger types (INVEST_GAIN / INVEST_LOSS) instead of
--   wallet ledger movements (HIBAH / INVEST_OUT).
--   Backfills old investment growth and loss rows to the new types.
--
-- Rollback:
--   1. DROP FUNCTION IF EXISTS public.kid_invest_settle(uuid);
--   2. Recreate T4's version from 20260927120000_kid_atomic_and_card_controls.sql:
--      kid_invest_settle(uuid, timestamptz, timestamptz, numeric, numeric, text).
--   3. Reverse backfill:
--      UPDATE public.transactions SET type = 'HIBAH' WHERE type = 'INVEST_GAIN' AND label ~ '^Investment growth \(\d+w\)$';
--      UPDATE public.transactions SET type = 'INVEST_OUT' WHERE type = 'INVEST_LOSS' AND label ~ '^Investment loss \(\d+w\)$';

-- 1. Drop T4's version with multiple parameters
DROP FUNCTION IF EXISTS public.kid_invest_settle(uuid, timestamptz, timestamptz, numeric, numeric, text);

-- 2. New kid_invest_settle(p_kid_id uuid)
CREATE OR REPLACE FUNCTION public.kid_invest_settle(p_kid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_weeks integer;
  v_new_last timestamptz;
  v_principal numeric;
  v_rate numeric;
  v_min double precision;
  v_max double precision;
  v_grown double precision;
  v_gain numeric;
  v_new_balance numeric;
BEGIN
  -- Lock kid row
  SELECT id, invest_balance, invest_rate, invest_last_paid
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- If invest_last_paid is null, initialize to now() and return 0
  IF v_kid.invest_last_paid IS NULL THEN
    UPDATE public.kids
       SET invest_last_paid = now()
     WHERE id = p_kid_id;
    RETURN jsonb_build_object('paid', 0, 'invest_balance', coalesce(v_kid.invest_balance, 0));
  END IF;

  -- Weeks elapsed
  v_weeks := floor(extract(epoch from (now() - v_kid.invest_last_paid)) / 604800)::integer;
  IF v_weeks <= 0 THEN
    RETURN jsonb_build_object('paid', 0, 'invest_balance', coalesce(v_kid.invest_balance, 0));
  END IF;

  v_new_last := v_kid.invest_last_paid + (v_weeks * interval '7 days');

  v_principal := coalesce(v_kid.invest_balance, 0);
  v_rate := coalesce(v_kid.invest_rate, 0);

  -- Zero principal or zero rate: update last paid only
  IF v_principal <= 0 OR v_rate <= 0 THEN
    UPDATE public.kids
       SET invest_last_paid = v_new_last
     WHERE id = p_kid_id;
    RETURN jsonb_build_object('paid', 0, 'invest_balance', v_principal);
  END IF;

  -- Calculate investment growth factor bounds
  IF v_rate = 0.001 THEN
    v_min := -0.01;
    v_max := 0.03;
  ELSIF v_rate = 0.002 THEN
    v_min := -0.05;
    v_max := 0.08;
  ELSIF v_rate = 0.003 THEN
    v_min := -0.15;
    v_max := 0.20;
  ELSIF v_rate = 0.004 THEN
    v_min := -0.30;
    v_max := 0.50;
  ELSE
    v_min := 0;
    v_max := v_rate::double precision;
  END IF;

  v_grown := v_principal::double precision;
  FOR i IN 1..v_weeks LOOP
    v_grown := v_grown * (1.0 + v_min + (random() * (v_max - v_min)));
  END LOOP;

  -- Clamp to [0, principal * 2]
  IF v_grown < 0 THEN
    v_grown := 0;
  ELSIF v_grown > (v_principal::double precision * 2.0) THEN
    v_grown := v_principal::double precision * 2.0;
  END IF;

  -- Round the change to cents
  v_gain := round((v_grown - v_principal::double precision)::numeric, 2);
  v_new_balance := v_principal + v_gain;

  -- Update kid invest_balance and invest_last_paid
  UPDATE public.kids
     SET invest_balance = v_new_balance,
         invest_last_paid = v_new_last
   WHERE id = p_kid_id;

  -- Insert ledger row if abs(gain) >= 0.01
  IF v_gain >= 0.01 THEN
    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (
      p_kid_id,
      'INVEST_GAIN',
      v_gain,
      'Investment growth (' || v_weeks || 'w)'
    );
  ELSIF v_gain <= -0.01 THEN
    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (
      p_kid_id,
      'INVEST_LOSS',
      abs(v_gain),
      'Investment loss (' || v_weeks || 'w)'
    );
  END IF;

  RETURN jsonb_build_object('paid', v_gain, 'invest_balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.kid_invest_settle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_invest_settle(uuid) TO service_role;

-- 3. Backfill old rows
UPDATE public.transactions
   SET type = 'INVEST_GAIN'
 WHERE type = 'HIBAH'
   AND label ~ '^Investment growth \(\d+w\)$';

UPDATE public.transactions
   SET type = 'INVEST_LOSS'
 WHERE type = 'INVEST_OUT'
   AND label ~ '^Investment loss \(\d+w\)$';
