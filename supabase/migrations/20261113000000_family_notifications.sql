-- Deliver family notifications in the same transaction as the underlying action.

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
          coalesce(nullif(btrim(v_kid.comfort_name), ''), v_kid.name), 300),
        '/parent'
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

create or replace function public.resolve_reward(
  p_reward_id uuid,
  p_parent_id uuid,
  p_approve boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
  v_kid public.kids%rowtype;
begin
  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_kid from public.kids where id = v_reward.kid_id for update;
  if not found or v_kid.parent_id is distinct from p_parent_id then
    raise exception 'not_found';
  end if;

  if v_reward.status <> 'requested' then
    raise exception 'already_resolved';
  end if;

  if p_approve then
    if v_kid.coins < v_reward.cost then
      raise exception 'insufficient_coins';
    end if;
    update public.kids set coins = coins - v_reward.cost where id = v_kid.id;
    update public.rewards set status = 'approved' where id = v_reward.id;
  else
    update public.rewards set status = 'declined' where id = v_reward.id;
  end if;

  insert into public.kid_notifications (kid_id, kind, message, link)
    values (v_kid.id, 'REWARD',
      case when p_approve then 'Your reward request was approved' else 'Your reward request was declined' end,
      '/kid/missions');

  return jsonb_build_object('ok', true);
end;
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
