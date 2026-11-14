-- Final check V1: trust and correctness.

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
  v_period interval;
  v_skipped integer;
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

    v_period := CASE v_sh.frequency
      WHEN 'daily' THEN interval '1 day'
      WHEN 'weekly' THEN interval '7 days'
      WHEN 'bi-weekly' THEN interval '14 days'
      WHEN 'quarterly' THEN interval '3 months'
      WHEN 'annually' THEN interval '1 year'
      ELSE interval '1 month'
    END;
    v_next := v_sh.next_run_at + v_period;
    v_skipped := 0;
    WHILE v_next <= p_now LOOP
      IF v_sh.end_date IS NULL OR v_next <= v_sh.end_date THEN
        v_skipped := v_skipped + 1;
      END IF;
      v_next := v_next + v_period;
    END LOOP;

    UPDATE public.kids SET balance = balance + v_sh.amount WHERE id = v_kid.id;

    INSERT INTO public.transactions (kid_id, type, amount, label)
      VALUES (v_kid.id, 'HIBAH', v_sh.amount, 'Scheduled Auto-Hibah (' || v_sh.frequency || ')');

    INSERT INTO public.kid_notifications (kid_id, kind, message, link)
      VALUES (v_kid.id, 'HIBAH',
        'You received RM' || to_char(v_sh.amount, 'FM999999990.00') || ' Hibah',
        '/kid/history');

    INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
      VALUES (
        v_kid.parent_id,
        v_kid.id,
        'HIBAH',
        left('RM' || to_char(v_sh.amount, 'FM999999990.00') || ' Hibah paid to ' ||
          coalesce(nullif(btrim(v_kid.comfort_name), ''), v_kid.name) || CASE WHEN v_skipped > 0 THEN
          '. Skipped ' || v_skipped || ' missed Hibah payment(s).' ELSE '' END, 300),
        '/parent'
      );

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
  v_ap public.approvals%rowtype;
  v_kid public.kids%rowtype;
  v_to_kid public.kids%rowtype;
  v_sender_name text;
  v_recipient_name text;
  v_amt_str text;
  v_loan_id uuid := NULL;
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
    IF v_ap.amount IS NULL OR v_ap.amount <= 0 OR v_ap.amount > 100000
      OR v_ap.amount <> round(v_ap.amount, 2) THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;
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

      UPDATE public.kids
        SET balance = balance + v_ap.amount
        WHERE id = v_kid.id;

      INSERT INTO public.transactions (kid_id, type, amount, label, loan_id)
        VALUES (v_kid.id, 'QARD', v_ap.amount, 'Qard approved: ' || p_loan_reason, v_loan_id);

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

  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
    SELECT v_kid.id, v_ap.kind,
      'Your ' || CASE WHEN v_ap.kind = 'QARD' THEN 'loan request' ELSE lower(v_ap.kind) END ||
      ' of RM' || to_char(v_ap.amount, 'FM999999990.00') ||
      CASE WHEN p_approve THEN ' was approved' ELSE ' was declined' END,
      CASE WHEN v_ap.kind = 'QARD' THEN '/kid/loans' ELSE '/kid/wallet' END
    WHERE v_ap.kind IN ('WITHDRAWAL', 'DEPOSIT', 'QARD');

  UPDATE public.approvals
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         resolved_at = now()
   WHERE id = v_ap.id;

  RETURN jsonb_build_object('ok', true, 'loan_id', v_loan_id);
END;
$$;

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

  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 100000 OR p_amount <> round(p_amount, 2) THEN
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

  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
    VALUES (v_kid.id, p_type,
      CASE WHEN p_type = 'DEPOSIT' THEN 'Your parent added RM' ELSE 'Your parent took out RM' END ||
      to_char(p_amount, 'FM999999990.00'), '/kid/wallet');

  RETURN v_new_balance;
END;
$$;

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
  IF p_amount IS NULL OR p_amount < 0.5 OR p_amount > 100000 OR p_amount <> round(p_amount, 2) THEN
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

  INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
    SELECT parent_id, id, 'QARD',
      left(coalesce(nullif(btrim(comfort_name), ''), name), 240) ||
      ' repaid RM' || to_char(v_pay, 'FM999999990.00') || ' of a loan',
      '/parent'
    FROM public.kids WHERE id = p_kid_id;

  RETURN jsonb_build_object(
    'paid', v_pay,
    'fullyRepaid', v_fully_repaid,
    'trustDelta', v_trust_delta
  );
END;
$$;

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
  v_new_balance numeric;
  v_kid_name text;
  v_formatted_amount text;
  v_label text;
  v_kid_msg text;
  v_parent_msg text;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 10000 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_cause IS NOT NULL THEN
    v_cause := btrim(p_cause);
    IF v_cause NOT IN ('Local Masjid', 'Orphan Relief', 'Clean Water Wells') THEN
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

  v_new_balance := v_kid.balance - p_amount;
  v_kid_name := coalesce(nullif(btrim(v_kid.comfort_name), ''), v_kid.name);
  v_formatted_amount := 'RM' || to_char(p_amount, 'FM999999990.00');

  UPDATE public.kids
     SET balance = v_new_balance
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
    v_kid_msg := 'You pledged ' || v_formatted_amount || ' to ' || v_cause || '.';
    v_parent_msg := v_kid_name || ' pledged ' || v_formatted_amount || ' sadaqah to ' || v_cause;
  ELSE
    v_kid_msg := 'You pledged ' || v_formatted_amount || '.';
    v_parent_msg := v_kid_name || ' pledged ' || v_formatted_amount || ' sadaqah';
  END IF;

  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
  VALUES (p_kid_id, 'SADAQAH', v_kid_msg, '/kid/sadaqah');

  IF v_kid.parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
    VALUES (v_kid.parent_id, p_kid_id, 'SADAQAH', left(v_parent_msg || '. Please pass this pledge on to the cause.', 300), '/parent');
  END IF;

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'coins_awarded', 0,
    'cause', v_cause
  );
END;
$$;

create or replace function public.investment_fund_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'tiers', jsonb_build_object(
      'low', jsonb_build_object('name', 'Low', 'min_rate', 0.001, 'max_rate', 0.010, 'label', 'Practice savings grow slowly and never fall'),
      'medium', jsonb_build_object('name', 'Medium', 'min_rate', 0.001, 'max_rate', 0.030, 'label', 'Practice savings grow slowly and never fall'),
      'high', jsonb_build_object('name', 'High', 'min_rate', 0.000, 'max_rate', 0.050, 'label', 'Practice savings grow slowly and never fall')
    ),
    'frequencies', jsonb_build_object(
      'minute', jsonb_build_object('name', 'Every minute', 'interval_seconds', 60, 'lengths', jsonb_build_array(5, 10, 15), 'min_amount', 1.00, 'max_amount', 10.00, 'max_open', 1, 'daily_limit', 3),
      'day', jsonb_build_object('name', 'Daily', 'interval_seconds', 86400, 'lengths', jsonb_build_array(3, 7, 14), 'min_amount', 1.00, 'max_amount', 50.00, 'max_open', 5),
      'week', jsonb_build_object('name', 'Weekly', 'interval_seconds', 604800, 'lengths', jsonb_build_array(2, 4, 8), 'min_amount', 1.00, 'max_amount', 50.00, 'max_open', 5)
    ),
    'max_open_funds', 5
  );
end;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_quiz_total_correct() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS child_privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS child_privacy_consent_version text;
