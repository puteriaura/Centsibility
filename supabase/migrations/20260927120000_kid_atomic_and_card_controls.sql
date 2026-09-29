-- Migration: 20260927120000_kid_atomic_and_card_controls.sql
-- Summary: Adds card control columns to public.kids, GOAL_IN backfill,
--          card spend calculation, and atomic RPCs for kid-side financial actions.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.kid_claim_coins(uuid);
--   DROP FUNCTION IF EXISTS public.kid_contribute_goal(uuid, uuid, numeric);
--   DROP FUNCTION IF EXISTS public.kid_repay_loan(uuid, uuid, numeric);
--   DROP FUNCTION IF EXISTS public.kid_invest_settle(uuid, timestamptz, timestamptz, numeric, numeric, text);
--   DROP FUNCTION IF EXISTS public.kid_invest_transfer(uuid, text, numeric);
--   DROP FUNCTION IF EXISTS public.kid_request_withdrawal(uuid, numeric, text);
--   DROP FUNCTION IF EXISTS public.kid_give_sadaqah(uuid, numeric);
--   DROP FUNCTION IF EXISTS public.kid_set_card_controls(uuid, boolean, numeric, boolean);
--   DROP FUNCTION IF EXISTS public.kid_card_spent_today(uuid);
--   ALTER TABLE public.kids DROP CONSTRAINT IF EXISTS kids_card_daily_limit_range;
--   ALTER TABLE public.kids DROP COLUMN IF EXISTS card_online_enabled;
--   ALTER TABLE public.kids DROP COLUMN IF EXISTS card_daily_limit;
--   ALTER TABLE public.kids DROP COLUMN IF EXISTS card_frozen;

-- 1. Card columns on kids
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS card_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS card_daily_limit numeric NOT NULL DEFAULT 50;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS card_online_enabled boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kids_card_daily_limit_range'
  ) THEN
    ALTER TABLE public.kids ADD CONSTRAINT kids_card_daily_limit_range
      CHECK (card_daily_limit BETWEEN 10 AND 200);
  END IF;
END $$;

-- 2. Backfill goal contributions (N10)
UPDATE public.transactions t
   SET type = 'GOAL_IN'
  FROM public.goals g
 WHERE t.kid_id = g.kid_id
   AND t.type = 'DEPOSIT'
   AND t.label = 'Saved to ' || g.name;

-- 3. kid_card_spent_today(p_kid_id uuid) returns numeric
CREATE OR REPLACE FUNCTION public.kid_card_spent_today(p_kid_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sadaqah numeric;
  v_withdrawal numeric;
BEGIN
  SELECT coalesce(sum(amount), 0)
    INTO v_sadaqah
    FROM public.transactions
   WHERE kid_id = p_kid_id
     AND type = 'SADAQAH'
     AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

  SELECT coalesce(sum(amount), 0)
    INTO v_withdrawal
    FROM public.approvals
   WHERE kid_id = p_kid_id
     AND kind = 'WITHDRAWAL'
     AND status IN ('pending', 'approved')
     AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

  RETURN v_sadaqah + v_withdrawal;
END;
$$;

-- 4. kid_set_card_controls
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
  SELECT id, card_frozen, card_daily_limit, card_online_enabled
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

  UPDATE public.kids
     SET card_frozen = coalesce(p_frozen, card_frozen),
         card_daily_limit = coalesce(p_daily_limit, card_daily_limit),
         card_online_enabled = coalesce(p_online_enabled, card_online_enabled)
   WHERE id = p_kid_id
  RETURNING card_frozen, card_daily_limit, card_online_enabled
    INTO v_kid;

  RETURN jsonb_build_object(
    'card_frozen', v_kid.card_frozen,
    'card_daily_limit', v_kid.card_daily_limit,
    'card_online_enabled', v_kid.card_online_enabled
  );
END;
$$;

-- 5. kid_give_sadaqah
CREATE OR REPLACE FUNCTION public.kid_give_sadaqah(
  p_kid_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_coins_awarded int;
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id, balance, coins, card_frozen, card_daily_limit
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

  UPDATE public.kids
     SET balance = v_new_balance,
         coins = coalesce(coins, 0) + v_coins_awarded
   WHERE id = p_kid_id;

  INSERT INTO public.transactions (kid_id, type, amount, label)
  VALUES (p_kid_id, 'SADAQAH', p_amount, 'Sadaqah given');

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'coins_awarded', v_coins_awarded
  );
END;
$$;

-- 6. kid_request_withdrawal
CREATE OR REPLACE FUNCTION public.kid_request_withdrawal(
  p_kid_id uuid,
  p_amount numeric,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_approval_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id, card_frozen, card_daily_limit
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

  INSERT INTO public.approvals (kid_id, kind, amount, reason, status)
  VALUES (p_kid_id, 'WITHDRAWAL', p_amount, coalesce(p_reason, ''), 'pending')
  RETURNING id INTO v_approval_id;

  RETURN v_approval_id;
END;
$$;

-- 7. kid_invest_transfer
CREATE OR REPLACE FUNCTION public.kid_invest_transfer(
  p_kid_id uuid,
  p_direction text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_new_balance numeric;
  v_new_invest numeric;
BEGIN
  IF p_direction IS NULL OR p_direction NOT IN ('IN', 'OUT') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id, balance, invest_balance
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_direction = 'IN' THEN
    IF v_kid.balance < p_amount THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;
    v_new_balance := v_kid.balance - p_amount;
    v_new_invest := coalesce(v_kid.invest_balance, 0) + p_amount;

    UPDATE public.kids
       SET balance = v_new_balance,
           invest_balance = v_new_invest
     WHERE id = p_kid_id;

    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (p_kid_id, 'INVEST_IN', p_amount, 'Invested');
  ELSE
    IF coalesce(v_kid.invest_balance, 0) < p_amount THEN
      RAISE EXCEPTION 'insufficient_invested';
    END IF;
    v_new_balance := v_kid.balance + p_amount;
    v_new_invest := coalesce(v_kid.invest_balance, 0) - p_amount;

    UPDATE public.kids
       SET balance = v_new_balance,
           invest_balance = v_new_invest
     WHERE id = p_kid_id;

    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (p_kid_id, 'INVEST_OUT', p_amount, 'Withdrew investment');
  END IF;

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'invest_balance', v_new_invest
  );
END;
$$;

-- 8. kid_invest_settle
CREATE OR REPLACE FUNCTION public.kid_invest_settle(
  p_kid_id uuid,
  p_expected_last_paid timestamptz,
  p_new_last_paid timestamptz,
  p_new_invest_balance numeric,
  p_gain numeric,
  p_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
BEGIN
  SELECT id, invest_balance, invest_last_paid
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_kid.invest_last_paid IS DISTINCT FROM p_expected_last_paid THEN
    RAISE EXCEPTION 'settle_conflict';
  END IF;

  IF p_new_invest_balance < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.kids
     SET invest_balance = p_new_invest_balance,
         invest_last_paid = p_new_last_paid
   WHERE id = p_kid_id;

  IF abs(p_gain) > 0.01 THEN
    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (
      p_kid_id,
      CASE WHEN p_gain > 0 THEN 'HIBAH' ELSE 'INVEST_OUT' END,
      abs(p_gain),
      coalesce(p_label, CASE WHEN p_gain > 0 THEN 'Hibah payout' ELSE 'Investment loss' END)
    );
  END IF;

  RETURN jsonb_build_object(
    'paid', p_gain,
    'invest_balance', p_new_invest_balance
  );
END;
$$;

-- 9. kid_repay_loan
CREATE OR REPLACE FUNCTION public.kid_repay_loan(
  p_kid_id uuid,
  p_loan_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_loan record;
  v_pay numeric;
  v_new_repaid numeric;
  v_fully_repaid boolean;
  v_trust_delta int := 0;
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < 0.5 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id, balance, trust_score
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT id, kid_id, amount, repaid, status, due_date
    INTO v_loan
    FROM public.loans
   WHERE id = p_loan_id AND kid_id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_loan.status != 'active' OR (v_loan.amount - v_loan.repaid) <= 0 THEN
    RAISE EXCEPTION 'loan_closed';
  END IF;

  v_pay := least(p_amount, v_loan.amount - v_loan.repaid);

  IF v_kid.balance < v_pay THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_new_repaid := v_loan.repaid + v_pay;
  v_fully_repaid := (v_new_repaid >= v_loan.amount);
  v_new_balance := v_kid.balance - v_pay;

  IF v_fully_repaid THEN
    IF (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date <= v_loan.due_date THEN
      v_trust_delta := 25;
    ELSE
      v_trust_delta := -50;
    END IF;

    UPDATE public.kids
       SET balance = v_new_balance,
           trust_score = greatest(300, least(900, coalesce(trust_score, 700) + v_trust_delta))
     WHERE id = p_kid_id;

    UPDATE public.loans
       SET repaid = v_new_repaid,
           status = 'repaid'
     WHERE id = v_loan.id;
  ELSE
    UPDATE public.kids
       SET balance = v_new_balance
     WHERE id = p_kid_id;

    UPDATE public.loans
       SET repaid = v_new_repaid
     WHERE id = v_loan.id;
  END IF;

  INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
  VALUES (p_kid_id, 'QARD_REPAY', v_pay, 'Loan repayment', v_loan.id);

  RETURN jsonb_build_object(
    'paid', v_pay,
    'fullyRepaid', v_fully_repaid,
    'trustDelta', v_trust_delta
  );
END;
$$;

-- 10. kid_contribute_goal
CREATE OR REPLACE FUNCTION public.kid_contribute_goal(
  p_kid_id uuid,
  p_goal_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid record;
  v_goal record;
  v_add numeric;
  v_new_saved numeric;
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id, balance
    INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT id, kid_id, name, target, saved
    INTO v_goal
    FROM public.goals
   WHERE id = p_goal_id AND kid_id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF (v_goal.target - v_goal.saved) <= 0 THEN
    RAISE EXCEPTION 'goal_complete';
  END IF;

  v_add := least(p_amount, v_goal.target - v_goal.saved);

  IF v_kid.balance < v_add THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_new_saved := v_goal.saved + v_add;
  v_new_balance := v_kid.balance - v_add;

  UPDATE public.kids
     SET balance = v_new_balance
   WHERE id = p_kid_id;

  UPDATE public.goals
     SET saved = v_new_saved
   WHERE id = v_goal.id;

  INSERT INTO public.transactions (kid_id, type, amount, label)
  VALUES (p_kid_id, 'GOAL_IN', v_add, 'Saved to ' || v_goal.name);

  RETURN jsonb_build_object(
    'added', v_add,
    'saved', v_new_saved
  );
END;
$$;

-- 11. kid_claim_coins
CREATE OR REPLACE FUNCTION public.kid_claim_coins(p_kid_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim numeric;
BEGIN
  SELECT coalesce(unclaimed_coins, 0)
    INTO v_claim
    FROM public.kids
   WHERE id = p_kid_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_claim > 0 THEN
    UPDATE public.kids
       SET coins = coalesce(coins, 0) + v_claim,
           unclaimed_coins = 0
     WHERE id = p_kid_id;
  END IF;

  RETURN v_claim;
END;
$$;

-- 12. Security Grants
REVOKE EXECUTE ON FUNCTION public.kid_card_spent_today(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_card_spent_today(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_set_card_controls(uuid, boolean, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_set_card_controls(uuid, boolean, numeric, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_give_sadaqah(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_give_sadaqah(uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_request_withdrawal(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_request_withdrawal(uuid, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_invest_transfer(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_invest_transfer(uuid, text, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_invest_settle(uuid, timestamptz, timestamptz, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_invest_settle(uuid, timestamptz, timestamptz, numeric, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_repay_loan(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_repay_loan(uuid, uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_contribute_goal(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_contribute_goal(uuid, uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.kid_claim_coins(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_claim_coins(uuid) TO service_role;
