-- Migration: 20260930120000_family_transfers.sql
-- Description: Family transfers (kid to sibling, kid to parent, parent to kid), atomic ledger operations
-- Rollback:
--   DROP FUNCTION IF EXISTS public.parent_send_to_kid(uuid, uuid, numeric, text, text);
--   DROP FUNCTION IF EXISTS public.kid_send_to_parent(uuid, numeric, text, text);
--   DROP FUNCTION IF EXISTS public.kid_request_transfer(uuid, uuid, numeric, text);
--   DROP FUNCTION IF EXISTS public.kid_transfer_out_today(uuid);
--   Restore resolve_approval from 20260929070000_qard_admin_fee_and_limits.sql;
--   ALTER TABLE public.approvals DROP COLUMN IF EXISTS to_kid_id;

-- 1. Recipient column on approvals for sibling transfers
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS to_kid_id uuid REFERENCES public.kids(id) ON DELETE CASCADE;

-- 2. Daily transfer out tracker (stable)
-- Sums today's executed TRANSFER_OUT rows and today's pending TRANSFER approval requests
CREATE OR REPLACE FUNCTION public.kid_transfer_out_today(p_kid_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
  v_tx_sum numeric := 0;
  v_ap_sum numeric := 0;
BEGIN
  SELECT coalesce(sum(amount), 0)
    INTO v_tx_sum
    FROM public.transactions
   WHERE kid_id = p_kid_id
     AND type = 'TRANSFER_OUT'
     AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = v_today;

  SELECT coalesce(sum(amount), 0)
    INTO v_ap_sum
    FROM public.approvals
   WHERE kid_id = p_kid_id
     AND kind = 'TRANSFER'
     AND status = 'pending'
     AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = v_today;

  RETURN v_tx_sum + v_ap_sum;
END;
$$;

REVOKE ALL ON FUNCTION public.kid_transfer_out_today(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_transfer_out_today(uuid) TO service_role;

-- 3. Kid requests a transfer to a sibling (requires parent approval)
CREATE OR REPLACE FUNCTION public.kid_request_transfer(
  p_kid_id uuid,
  p_to_kid_id uuid,
  p_amount numeric,
  p_note text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min CONSTANT numeric := 1.00;
  c_kid_daily CONSTANT numeric := 50.00;
  v_sender public.kids%rowtype;
  v_recipient public.kids%rowtype;
  v_sender_name text;
  v_recipient_name text;
  v_amt_str text;
  v_clean_note text;
  v_approval_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount < c_min OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_to_kid_id = p_kid_id THEN
    RAISE EXCEPTION 'self_transfer';
  END IF;

  SELECT * INTO v_sender FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_to_kid_id IS NULL THEN
    RAISE EXCEPTION 'not_family';
  END IF;

  SELECT * INTO v_recipient FROM public.kids WHERE id = p_to_kid_id;
  IF NOT FOUND OR v_recipient.parent_id IS DISTINCT FROM v_sender.parent_id THEN
    RAISE EXCEPTION 'not_family';
  END IF;

  IF p_note IS NOT NULL THEN
    v_clean_note := btrim(p_note);
    IF v_clean_note = '' OR char_length(v_clean_note) > 40 THEN
      RAISE EXCEPTION 'invalid_note';
    END IF;
  END IF;

  IF v_sender.balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  IF public.kid_transfer_out_today(p_kid_id) + p_amount > c_kid_daily THEN
    RAISE EXCEPTION 'transfer_limit_exceeded';
  END IF;

  v_sender_name := coalesce(nullif(btrim(v_sender.comfort_name), ''), v_sender.name);
  v_recipient_name := coalesce(nullif(btrim(v_recipient.comfort_name), ''), v_recipient.name);
  v_amt_str := 'RM' || to_char(p_amount, 'FM999999990.00');

  INSERT INTO public.approvals (
    kid_id,
    to_kid_id,
    kind,
    amount,
    reason,
    status
  ) VALUES (
    v_sender.id,
    v_recipient.id,
    'TRANSFER',
    p_amount,
    coalesce(v_clean_note, ''),
    'pending'
  ) RETURNING id INTO v_approval_id;

  INSERT INTO public.notifications (
    parent_id,
    kid_id,
    kind,
    message,
    link
  ) VALUES (
    v_sender.parent_id,
    v_sender.id,
    'TRANSFER',
    v_sender_name || ' wants to send ' || v_amt_str || ' to ' || v_recipient_name,
    '/parent/approvals'
  );

  INSERT INTO public.kid_notifications (
    kid_id,
    kind,
    message,
    link
  ) VALUES (
    v_sender.id,
    'TRANSFER',
    'Your ' || v_amt_str || ' to ' || v_recipient_name || ' is waiting for approval.',
    '/kid'
  );

  RETURN v_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kid_request_transfer(uuid, uuid, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_request_transfer(uuid, uuid, numeric, text) TO service_role;

-- 4. Kid sends money directly to parent (immediate, no approval required)
CREATE OR REPLACE FUNCTION public.kid_send_to_parent(
  p_kid_id uuid,
  p_amount numeric,
  p_note text,
  p_parent_label text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min CONSTANT numeric := 1.00;
  c_kid_daily CONSTANT numeric := 50.00;
  v_kid public.kids%rowtype;
  v_kid_name text;
  v_label text;
  v_clean_note text;
  v_amt_str text;
  v_tx_label text;
  v_parent_msg text;
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < c_min OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT * INTO v_kid FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_note IS NOT NULL THEN
    v_clean_note := btrim(p_note);
    IF v_clean_note = '' OR char_length(v_clean_note) > 40 THEN
      RAISE EXCEPTION 'invalid_note';
    END IF;
  END IF;

  IF v_kid.balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  IF public.kid_transfer_out_today(p_kid_id) + p_amount > c_kid_daily THEN
    RAISE EXCEPTION 'transfer_limit_exceeded';
  END IF;

  v_label := coalesce(nullif(btrim(p_parent_label), ''), 'Parent');
  IF char_length(v_label) > 40 THEN
    v_label := substr(v_label, 1, 40);
  END IF;

  v_kid_name := coalesce(nullif(btrim(v_kid.comfort_name), ''), v_kid.name);
  v_amt_str := 'RM' || to_char(p_amount, 'FM999999990.00');

  UPDATE public.kids
     SET balance = balance - p_amount
   WHERE id = v_kid.id
  RETURNING balance INTO v_new_balance;

  IF v_clean_note IS NOT NULL AND v_clean_note <> '' THEN
    v_tx_label := 'Sent to ' || v_label || ': ' || v_clean_note;
    v_parent_msg := v_kid_name || ' sent you ' || v_amt_str || ': ' || v_clean_note;
  ELSE
    v_tx_label := 'Sent to ' || v_label;
    v_parent_msg := v_kid_name || ' sent you ' || v_amt_str;
  END IF;

  INSERT INTO public.transactions (
    kid_id,
    type,
    amount,
    label
  ) VALUES (
    v_kid.id,
    'TRANSFER_OUT',
    p_amount,
    v_tx_label
  );

  INSERT INTO public.notifications (
    parent_id,
    kid_id,
    kind,
    message,
    link
  ) VALUES (
    v_kid.parent_id,
    v_kid.id,
    'TRANSFER',
    v_parent_msg,
    '/parent'
  );

  INSERT INTO public.kid_notifications (
    kid_id,
    kind,
    message,
    link
  ) VALUES (
    v_kid.id,
    'TRANSFER',
    'You sent ' || v_amt_str || ' to ' || v_label || '.',
    '/kid/history'
  );

  RETURN jsonb_build_object('balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.kid_send_to_parent(uuid, numeric, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_send_to_parent(uuid, numeric, text, text) TO service_role;

-- 5. Parent sends money to child (immediate)
CREATE OR REPLACE FUNCTION public.parent_send_to_kid(
  p_parent_id uuid,
  p_kid_id uuid,
  p_amount numeric,
  p_note text,
  p_parent_label text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid public.kids%rowtype;
  v_label text;
  v_clean_note text;
  v_amt_str text;
  v_tx_label text;
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < 1.00 OR p_amount > 1000.00 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT * INTO v_kid FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND OR v_kid.parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF p_note IS NOT NULL THEN
    v_clean_note := btrim(p_note);
    IF v_clean_note = '' OR char_length(v_clean_note) > 40 THEN
      RAISE EXCEPTION 'invalid_note';
    END IF;
  END IF;

  v_label := coalesce(nullif(btrim(p_parent_label), ''), 'Parent');
  IF char_length(v_label) > 40 THEN
    v_label := substr(v_label, 1, 40);
  END IF;

  v_amt_str := 'RM' || to_char(p_amount, 'FM999999990.00');

  UPDATE public.kids
     SET balance = balance + p_amount
   WHERE id = v_kid.id
  RETURNING balance INTO v_new_balance;

  IF v_clean_note IS NOT NULL AND v_clean_note <> '' THEN
    v_tx_label := 'From ' || v_label || ': ' || v_clean_note;
  ELSE
    v_tx_label := 'From ' || v_label;
  END IF;

  INSERT INTO public.transactions (
    kid_id,
    type,
    amount,
    label
  ) VALUES (
    v_kid.id,
    'TRANSFER_IN',
    p_amount,
    v_tx_label
  );

  INSERT INTO public.kid_notifications (
    kid_id,
    kind,
    message,
    link
  ) VALUES (
    v_kid.id,
    'TRANSFER',
    v_label || ' sent you ' || v_amt_str || '.',
    '/kid/history'
  );

  RETURN jsonb_build_object('balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.parent_send_to_kid(uuid, uuid, numeric, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_send_to_kid(uuid, uuid, numeric, text, text) TO service_role;

-- 6. Upgraded resolve_approval with TRANSFER branch
-- Note: Two opposite requests approved at the same moment can deadlock; Postgres aborts one and it can be retried without money loss.
CREATE OR REPLACE FUNCTION public.resolve_approval(
  p_approval_id uuid,
  p_parent_id uuid,
  p_approve boolean,
  p_loan_due_date date DEFAULT NULL,
  p_loan_reason text DEFAULT NULL,
  p_loan_signature text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_admin_fee CONSTANT numeric := 1.00;
  v_ap public.approvals%rowtype;
  v_kid public.kids%rowtype;
  v_to_kid public.kids%rowtype;
  v_sender_name text;
  v_recipient_name text;
  v_amt_str text;
  v_loan_id uuid := NULL;
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

    ELSIF v_ap.kind = 'TRANSFER' THEN
      SELECT * INTO v_to_kid FROM public.kids WHERE id = v_ap.to_kid_id FOR UPDATE;
      IF NOT FOUND OR v_to_kid.parent_id IS DISTINCT FROM p_parent_id THEN
        RAISE EXCEPTION 'not_found';
      END IF;

      IF v_kid.balance < v_ap.amount THEN
        RAISE EXCEPTION 'insufficient_balance';
      END IF;

      UPDATE public.kids SET balance = balance - v_ap.amount WHERE id = v_kid.id;
      UPDATE public.kids SET balance = balance + v_ap.amount WHERE id = v_to_kid.id;

      v_sender_name := coalesce(nullif(btrim(v_kid.comfort_name), ''), v_kid.name);
      v_recipient_name := coalesce(nullif(btrim(v_to_kid.comfort_name), ''), v_to_kid.name);
      v_amt_str := 'RM' || to_char(v_ap.amount, 'FM999999990.00');

      INSERT INTO public.transactions (kid_id, type, amount, label)
        VALUES (
          v_kid.id,
          'TRANSFER_OUT',
          v_ap.amount,
          CASE WHEN nullif(btrim(v_ap.reason), '') IS NOT NULL
               THEN 'Sent to ' || v_recipient_name || ': ' || btrim(v_ap.reason)
               ELSE 'Sent to ' || v_recipient_name
          END
        );

      INSERT INTO public.transactions (kid_id, type, amount, label)
        VALUES (
          v_to_kid.id,
          'TRANSFER_IN',
          v_ap.amount,
          'From ' || v_sender_name
        );

      INSERT INTO public.kid_notifications (kid_id, kind, message, link)
        VALUES (
          v_kid.id,
          'TRANSFER',
          'Your ' || v_amt_str || ' to ' || v_recipient_name || ' was approved and sent.',
          '/kid/history'
        );

      INSERT INTO public.kid_notifications (kid_id, kind, message, link)
        VALUES (
          v_to_kid.id,
          'TRANSFER',
          v_sender_name || ' sent you ' || v_amt_str || '.',
          '/kid/history'
        );

    ELSE
      RAISE EXCEPTION 'unknown_kind';
    END IF;
  ELSE
    -- Declined branch
    IF v_ap.kind = 'TRANSFER' THEN
      SELECT * INTO v_to_kid FROM public.kids WHERE id = v_ap.to_kid_id;
      v_recipient_name := coalesce(nullif(btrim(v_to_kid.comfort_name), ''), v_to_kid.name, 'Recipient');
      v_amt_str := 'RM' || to_char(v_ap.amount, 'FM999999990.00');

      INSERT INTO public.kid_notifications (kid_id, kind, message, link)
        VALUES (
          v_kid.id,
          'TRANSFER',
          'Your ' || v_amt_str || ' to ' || v_recipient_name || ' was not approved.',
          '/kid'
        );
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
