-- Migration: 20260929070000_qard_admin_fee_and_limits.sql
-- Description: Replace service + processing fees with a single flat RM1.00 admin fee for Qard loans
-- Rollback: Restore resolve_approval definition from 20260927110000_ledger_links_and_parent_atomic.sql

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
  -- Single flat admin fee per Qard loan.
  -- keep in sync with QARD_FEES in src/lib/qard.ts
  c_admin_fee constant numeric := 1.00;
  v_ap public.approvals%rowtype;
  v_kid public.kids%rowtype;
  v_loan_id uuid := null;
  v_fee numeric;
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

      v_fee := LEAST(c_admin_fee, v_ap.amount);

      UPDATE public.kids
        SET balance = balance + v_ap.amount - v_fee
        WHERE id = v_kid.id;

      INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
        VALUES (v_kid.id, 'QARD', v_ap.amount, 'Qard approved: ' || p_loan_reason, v_loan_id);

      IF v_fee > 0 THEN
        INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
          VALUES (v_kid.id, 'FEE', v_fee, 'Loan admin fee', v_loan_id);
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
