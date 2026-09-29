-- Migration: 20260927110000_ledger_links_and_parent_atomic.sql
-- Purpose:
--   1. Link transactions to loans via loan_id.
--   2. Backfill legacy QARD repayments to QARD_REPAY.
--   3. Redefine resolve_approval to record gross loan credit plus separate FEE debits.
--   4. Introduce parent_move_money for atomic parent deposits and withdrawals.
--   5. Introduce execute_due_hibahs for atomic and idempotent scheduled hibah processing.
--   6. Introduce delete_kid for atomic deletion of kid data across all tables.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.delete_kid(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.execute_due_hibahs(timestamptz);
--   DROP FUNCTION IF EXISTS public.parent_move_money(uuid, uuid, text, numeric, text);
--   -- Revert resolve_approval to migration 20260927000000 version
--   UPDATE public.transactions SET type = 'QARD' WHERE type = 'QARD_REPAY';
--   DROP INDEX IF EXISTS public.transactions_loan_id_idx;
--   ALTER TABLE public.transactions DROP COLUMN IF EXISTS loan_id;

-- 1. Link ledger rows to loans
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_loan_id_idx ON public.transactions (loan_id);

-- 2. Backfill legacy repayments
UPDATE public.transactions
  SET type = 'QARD_REPAY'
  WHERE type = 'QARD' AND label = 'Loan repayment';

-- 3. Redefine resolve_approval to fix loan-fee double count
CREATE OR REPLACE FUNCTION public.resolve_approval(
  p_approval_id uuid,
  p_parent_id uuid,
  p_approve boolean,
  p_loan_due_date date default null,
  p_loan_reason text default null,
  p_loan_signature text default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Existing loan fee schedule, unchanged from the edge function it replaces.
  -- keep in sync with QARD_FEES in src/lib/qard.ts
  c_service_fee constant numeric := 3.0;
  c_processing_fee constant numeric := 2.5;
  v_ap public.approvals%rowtype;
  v_kid public.kids%rowtype;
  v_loan_id uuid := null;
  v_service numeric;
  v_processing numeric;
BEGIN
  SELECT * INTO v_ap FROM public.approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT * INTO v_kid FROM public.kids WHERE id = v_ap.kid_id FOR UPDATE;
  IF NOT FOUND OR v_kid.parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_ap.status <> 'pending' THEN
    RAISE EXCEPTION 'already_resolved';
  END IF;

  IF p_approve THEN
    IF v_ap.kind = 'WITHDRAWAL' THEN
      IF v_ap.amount > v_kid.balance THEN
        RAISE EXCEPTION 'insufficient_balance';
      END IF;
      UPDATE public.kids SET balance = balance - v_ap.amount WHERE id = v_kid.id;
      INSERT INTO public.transactions (kid_id, type, amount, label)
        VALUES (v_kid.id, 'WITHDRAWAL', v_ap.amount, v_ap.reason);

    ELSIF v_ap.kind = 'DEPOSIT' THEN
      UPDATE public.kids SET balance = balance + v_ap.amount WHERE id = v_kid.id;
      INSERT INTO public.transactions (kid_id, type, amount, label)
        VALUES (v_kid.id, 'DEPOSIT', v_ap.amount, v_ap.reason);

    ELSIF v_ap.kind = 'QARD' THEN
      IF p_loan_due_date IS NULL OR p_loan_reason IS NULL THEN
        RAISE EXCEPTION 'missing_loan_terms';
      END IF;

      INSERT INTO public.loans (kid_id, amount, due_date, reason, signature_data_url, signed_at)
        VALUES (v_kid.id, v_ap.amount, p_loan_due_date, p_loan_reason, p_loan_signature, now())
        RETURNING id INTO v_loan_id;

      v_service := LEAST(c_service_fee, v_ap.amount);
      v_processing := LEAST(c_processing_fee, v_ap.amount - v_service);

      UPDATE public.kids
        SET balance = balance + v_ap.amount - v_service - v_processing
        WHERE id = v_kid.id;

      INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
        VALUES (v_kid.id, 'QARD', v_ap.amount, 'Qard approved: ' || p_loan_reason, v_loan_id);

      IF v_service > 0 THEN
        INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
          VALUES (v_kid.id, 'FEE', v_service, 'Loan service fee', v_loan_id);
      END IF;

      IF v_processing > 0 THEN
        INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
          VALUES (v_kid.id, 'FEE', v_processing, 'Loan processing fee', v_loan_id);
      END IF;

    ELSE
      RAISE EXCEPTION 'unknown_kind';
    END IF;
  END IF;

  UPDATE public.approvals
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         resolved_at = now()
   WHERE id = v_ap.id;

  RETURN jsonb_build_object('ok', true, 'loan_id', v_loan_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_approval(uuid, uuid, boolean, date, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_approval(uuid, uuid, boolean, date, text, text) TO service_role;

-- 4. Atomic parent money movements
CREATE OR REPLACE FUNCTION public.parent_move_money(
  p_kid_id uuid,
  p_parent_id uuid,
  p_type text,
  p_amount numeric,
  p_label text default null
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid public.kids%rowtype;
  v_new_balance numeric;
  v_label text;
BEGIN
  IF p_type IS NULL OR p_type NOT IN ('DEPOSIT', 'WITHDRAWAL') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT * INTO v_kid FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND OR v_kid.parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_type = 'WITHDRAWAL' THEN
    IF p_amount > v_kid.balance THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;
    v_new_balance := v_kid.balance - p_amount;
  ELSE
    v_new_balance := v_kid.balance + p_amount;
  END IF;

  UPDATE public.kids SET balance = v_new_balance WHERE id = v_kid.id;

  v_label := coalesce(nullif(btrim(p_label), ''), p_type);
  INSERT INTO public.transactions (kid_id, type, amount, label)
    VALUES (v_kid.id, p_type, p_amount, v_label);

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.parent_move_money(uuid, uuid, text, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_move_money(uuid, uuid, text, numeric, text) TO service_role;

-- 5. Atomic and idempotent execution of due scheduled hibahs
CREATE OR REPLACE FUNCTION public.execute_due_hibahs(
  p_now timestamptz default now()
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sh public.scheduled_hibahs%rowtype;
  v_kid public.kids%rowtype;
  v_processed integer := 0;
  v_next timestamptz;
  v_is_active boolean;
BEGIN
  FOR v_sh IN
    SELECT * FROM public.scheduled_hibahs
    WHERE is_active AND next_run_at <= p_now
    ORDER BY next_run_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_kid FROM public.kids WHERE id = v_sh.kid_id FOR UPDATE;
    IF NOT FOUND THEN
      UPDATE public.scheduled_hibahs SET is_active = false WHERE id = v_sh.id;
      CONTINUE;
    END IF;

    UPDATE public.kids SET balance = balance + v_sh.amount WHERE id = v_kid.id;

    INSERT INTO public.transactions (kid_id, type, amount, label)
      VALUES (v_kid.id, 'HIBAH', v_sh.amount, 'Scheduled Auto-Hibah (' || v_sh.frequency || ')');

    INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
      VALUES (
        v_kid.parent_id,
        v_kid.id,
        'HIBAH',
        'You received RM ' || to_char(v_sh.amount, 'FM999999990.00') || ' from your scheduled Hibah!',
        '/kid'
      );

    v_next := CASE v_sh.frequency
      WHEN 'daily' THEN v_sh.next_run_at + interval '1 day'
      WHEN 'weekly' THEN v_sh.next_run_at + interval '7 days'
      WHEN 'bi-weekly' THEN v_sh.next_run_at + interval '14 days'
      WHEN 'monthly' THEN v_sh.next_run_at + interval '1 month'
      WHEN 'quarterly' THEN v_sh.next_run_at + interval '3 months'
      WHEN 'annually' THEN v_sh.next_run_at + interval '1 year'
      ELSE v_sh.next_run_at + interval '1 month'
    END;

    v_is_active := (v_sh.end_date IS NULL OR v_next <= v_sh.end_date);

    UPDATE public.scheduled_hibahs
    SET next_run_at = v_next,
        is_active = v_is_active
    WHERE id = v_sh.id;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_due_hibahs(timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_due_hibahs(timestamptz) TO service_role;

-- 6. Atomic deletion of kid and all associated records
CREATE OR REPLACE FUNCTION public.delete_kid(
  p_kid_id uuid,
  p_parent_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid public.kids%rowtype;
BEGIN
  SELECT * INTO v_kid FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND OR v_kid.parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  DELETE FROM public.notifications WHERE kid_id = p_kid_id;
  DELETE FROM public.quiz_attempts WHERE kid_id = p_kid_id;
  DELETE FROM public.scheduled_hibahs WHERE kid_id = p_kid_id;
  DELETE FROM public.transactions WHERE kid_id = p_kid_id;
  DELETE FROM public.approvals WHERE kid_id = p_kid_id;
  DELETE FROM public.rewards WHERE kid_id = p_kid_id;
  DELETE FROM public.goals WHERE kid_id = p_kid_id;
  DELETE FROM public.loans WHERE kid_id = p_kid_id;
  DELETE FROM public.kids WHERE id = p_kid_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_kid(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_kid(uuid, uuid) TO service_role;
