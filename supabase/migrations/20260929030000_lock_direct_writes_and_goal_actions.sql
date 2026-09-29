-- Migration: 20260929030000_lock_direct_writes_and_goal_actions.sql
-- Purpose:
--   1. Revoke direct write permissions (INSERT, UPDATE, DELETE, TRUNCATE) on money tables
--      (kids, transactions, approvals, rewards, loans, goals, scheduled_hibahs) from anon, authenticated.
--   2. Replace FOR ALL / write RLS policies with SELECT-only policies.
--   3. Add check constraint on scheduled_hibahs: amount > 0.
--   4. Introduce atomic SECURITY DEFINER goal management RPCs:
--      - kid_create_goal (name 1-40 chars, target 1-100000, max 10 goals)
--      - kid_update_goal (refunds excess to wallet via GOAL_OUT if target < saved)
--      - kid_delete_goal (refunds saved amount to wallet via GOAL_OUT)
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.kid_create_goal(uuid, text, text, numeric);
--   DROP FUNCTION IF EXISTS public.kid_update_goal(uuid, uuid, text, text, numeric);
--   DROP FUNCTION IF EXISTS public.kid_delete_goal(uuid, uuid);
--   ALTER TABLE public.scheduled_hibahs DROP CONSTRAINT IF EXISTS scheduled_hibahs_amount_positive;
--   (Restore previous write/FOR ALL policies and grants if rolling back)

-- 1. Revoke direct write access from client roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.kids,
  public.transactions,
  public.approvals,
  public.rewards,
  public.loans,
  public.goals,
  public.scheduled_hibahs
FROM anon, authenticated;

-- 2. Drop write/FOR ALL policies and replace with SELECT-only policies

-- kids
DROP POLICY IF EXISTS "parent inserts kids" ON public.kids;
DROP POLICY IF EXISTS "parent updates kids" ON public.kids;
DROP POLICY IF EXISTS "parent deletes kids" ON public.kids;

-- transactions
DROP POLICY IF EXISTS "parent inserts tx" ON public.transactions;

-- approvals
DROP POLICY IF EXISTS "parent rw approvals" ON public.approvals;
CREATE POLICY "parent reads approvals" ON public.approvals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.parent_id = auth.uid()));

-- rewards
DROP POLICY IF EXISTS "parent rw rewards" ON public.rewards;
CREATE POLICY "parent reads rewards" ON public.rewards FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.parent_id = auth.uid()));

-- loans
DROP POLICY IF EXISTS "parent rw loans" ON public.loans;
CREATE POLICY "parent reads loans" ON public.loans FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.parent_id = auth.uid()));

-- goals
DROP POLICY IF EXISTS "parent rw goals" ON public.goals;
CREATE POLICY "parent reads goals" ON public.goals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.parent_id = auth.uid()));

-- scheduled_hibahs
DROP POLICY IF EXISTS "Parents can manage their scheduled hibahs" ON public.scheduled_hibahs;
DROP POLICY IF EXISTS "parent rw scheduled_hibahs" ON public.scheduled_hibahs;
CREATE POLICY "parent reads scheduled_hibahs" ON public.scheduled_hibahs FOR SELECT
  USING (parent_id = auth.uid());

-- 3. Constraint: scheduled hibah amount must be positive
ALTER TABLE public.scheduled_hibahs
  ADD CONSTRAINT scheduled_hibahs_amount_positive
  CHECK (amount > 0) NOT VALID;

-- 4. Goal functions

-- kid_create_goal
CREATE OR REPLACE FUNCTION public.kid_create_goal(
  p_kid_id uuid,
  p_name text,
  p_emoji text,
  p_target numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed_name text;
  v_count int;
  v_goal_id uuid;
BEGIN
  -- Validate name (1-40 characters after trimming)
  v_trimmed_name := trim(coalesce(p_name, ''));
  IF length(v_trimmed_name) < 1 OR length(v_trimmed_name) > 40 THEN
    RAISE EXCEPTION 'invalid_goal';
  END IF;

  -- Validate target (between 1 and 100000)
  IF p_target IS NULL OR p_target < 1 OR p_target > 100000 THEN
    RAISE EXCEPTION 'invalid_goal';
  END IF;

  -- Lock kid row
  PERFORM 1 FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Check limit: at most 10 goals per kid
  SELECT count(*) INTO v_count FROM public.goals WHERE kid_id = p_kid_id;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'invalid_goal';
  END IF;

  INSERT INTO public.goals (kid_id, name, emoji, target, saved)
  VALUES (
    p_kid_id,
    v_trimmed_name,
    coalesce(nullif(trim(p_emoji), ''), '🎯'),
    round(p_target, 2),
    0
  )
  RETURNING id INTO v_goal_id;

  RETURN v_goal_id;
END;
$$;

-- kid_update_goal
CREATE OR REPLACE FUNCTION public.kid_update_goal(
  p_kid_id uuid,
  p_goal_id uuid,
  p_name text,
  p_emoji text,
  p_target numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed_name text;
  v_goal record;
  v_excess numeric;
  v_new_saved numeric;
  v_refunded numeric := 0;
BEGIN
  -- Validate name (1-40 characters after trimming)
  v_trimmed_name := trim(coalesce(p_name, ''));
  IF length(v_trimmed_name) < 1 OR length(v_trimmed_name) > 40 THEN
    RAISE EXCEPTION 'invalid_goal';
  END IF;

  -- Validate target (between 1 and 100000)
  IF p_target IS NULL OR p_target < 1 OR p_target > 100000 THEN
    RAISE EXCEPTION 'invalid_goal';
  END IF;

  -- Lock kid row
  PERFORM 1 FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Lock goal row
  SELECT id, kid_id, name, emoji, target, saved
    INTO v_goal
    FROM public.goals
   WHERE id = p_goal_id AND kid_id = p_kid_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- If target is lowered below saved, refund excess to wallet
  IF round(p_target, 2) < v_goal.saved THEN
    v_excess := round(v_goal.saved - round(p_target, 2), 2);
    v_new_saved := round(p_target, 2);
    v_refunded := v_excess;

    UPDATE public.kids
       SET balance = balance + v_excess
     WHERE id = p_kid_id;

    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (
      p_kid_id,
      'GOAL_OUT',
      v_excess,
      'Moved back from ' || v_trimmed_name
    );

    UPDATE public.goals
       SET name = v_trimmed_name,
           emoji = coalesce(nullif(trim(p_emoji), ''), '🎯'),
           target = round(p_target, 2),
           saved = v_new_saved
     WHERE id = p_goal_id;
  ELSE
    v_new_saved := v_goal.saved;
    v_refunded := 0;

    UPDATE public.goals
       SET name = v_trimmed_name,
           emoji = coalesce(nullif(trim(p_emoji), ''), '🎯'),
           target = round(p_target, 2)
     WHERE id = p_goal_id;
  END IF;

  RETURN jsonb_build_object('saved', v_new_saved, 'refunded', v_refunded);
END;
$$;

-- kid_delete_goal
CREATE OR REPLACE FUNCTION public.kid_delete_goal(
  p_kid_id uuid,
  p_goal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal record;
  v_refunded numeric := 0;
BEGIN
  -- Lock kid row
  PERFORM 1 FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Lock goal row
  SELECT id, kid_id, name, saved
    INTO v_goal
    FROM public.goals
   WHERE id = p_goal_id AND kid_id = p_kid_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- If saved > 0, move back to wallet first
  IF v_goal.saved > 0 THEN
    v_refunded := round(v_goal.saved, 2);

    UPDATE public.kids
       SET balance = balance + v_refunded
     WHERE id = p_kid_id;

    INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (
      p_kid_id,
      'GOAL_OUT',
      v_refunded,
      'Moved back from ' || v_goal.name
    );
  END IF;

  DELETE FROM public.goals WHERE id = p_goal_id;

  RETURN jsonb_build_object('refunded', v_refunded);
END;
$$;

REVOKE ALL ON FUNCTION public.kid_create_goal(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_create_goal(uuid, text, text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.kid_update_goal(uuid, uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_update_goal(uuid, uuid, text, text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.kid_delete_goal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_delete_goal(uuid, uuid) TO service_role;
