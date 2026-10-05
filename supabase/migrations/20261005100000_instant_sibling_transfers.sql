-- supabase/migrations/20261005100000_instant_sibling_transfers.sql
-- T32: Sibling transfers arrive immediately without parent approval.

CREATE OR REPLACE FUNCTION public.kid_send_to_sibling(
  p_kid_id uuid,
  p_to_kid_id uuid,
  p_amount numeric,
  p_note text
) RETURNS jsonb
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
  v_sender_new_balance numeric;
  v_tx_label text;
BEGIN
  -- 1. Amount validation
  IF p_amount IS NULL OR p_amount < c_min OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- 2. Self transfer check
  IF p_to_kid_id = p_kid_id THEN
    RAISE EXCEPTION 'self_transfer';
  END IF;

  IF p_to_kid_id IS NULL THEN
    RAISE EXCEPTION 'not_family';
  END IF;

  -- 3. Locking both kid rows in ascending UUID order to prevent deadlocks
  IF p_kid_id < p_to_kid_id THEN
    SELECT * INTO v_sender FROM public.kids WHERE id = p_kid_id FOR UPDATE;
    SELECT * INTO v_recipient FROM public.kids WHERE id = p_to_kid_id FOR UPDATE;
  ELSE
    SELECT * INTO v_recipient FROM public.kids WHERE id = p_to_kid_id FOR UPDATE;
    SELECT * INTO v_sender FROM public.kids WHERE id = p_kid_id FOR UPDATE;
  END IF;

  IF v_sender.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_recipient.id IS NULL OR v_recipient.parent_id IS DISTINCT FROM v_sender.parent_id THEN
    RAISE EXCEPTION 'not_family';
  END IF;

  -- 4. Note validation
  IF p_note IS NOT NULL THEN
    v_clean_note := btrim(p_note);
    IF v_clean_note = '' OR char_length(v_clean_note) > 40 THEN
      RAISE EXCEPTION 'invalid_note';
    END IF;
  END IF;

  -- 5. Balance check
  IF v_sender.balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- 6. Daily limit check
  IF public.kid_transfer_out_today(p_kid_id) + p_amount > c_kid_daily THEN
    RAISE EXCEPTION 'transfer_limit_exceeded';
  END IF;

  -- 7. Execute ledger updates
  UPDATE public.kids
     SET balance = balance - p_amount
   WHERE id = v_sender.id
  RETURNING balance INTO v_sender_new_balance;

  UPDATE public.kids
     SET balance = balance + p_amount
   WHERE id = v_recipient.id;

  v_sender_name := coalesce(nullif(btrim(v_sender.comfort_name), ''), v_sender.name);
  v_recipient_name := coalesce(nullif(btrim(v_recipient.comfort_name), ''), v_recipient.name);
  v_amt_str := 'RM' || to_char(p_amount, 'FM999999990.00');

  IF v_clean_note IS NOT NULL AND v_clean_note <> '' THEN
    v_tx_label := 'Sent to ' || v_recipient_name || ': ' || v_clean_note;
  ELSE
    v_tx_label := 'Sent to ' || v_recipient_name;
  END IF;

  -- Sender transaction: TRANSFER_OUT
  INSERT INTO public.transactions (kid_id, type, amount, label)
  VALUES (
    v_sender.id,
    'TRANSFER_OUT',
    p_amount,
    v_tx_label
  );

  -- Recipient transaction: TRANSFER_IN
  INSERT INTO public.transactions (kid_id, type, amount, label)
  VALUES (
    v_recipient.id,
    'TRANSFER_IN',
    p_amount,
    'From ' || v_sender_name
  );

  -- 8. Notifications
  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
  VALUES (
    v_sender.id,
    'TRANSFER',
    'You sent ' || v_amt_str || ' to ' || v_recipient_name || '.',
    '/kid/history'
  );

  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
  VALUES (
    v_recipient.id,
    'TRANSFER',
    v_sender_name || ' sent you ' || v_amt_str || '.',
    '/kid/history'
  );

  INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
  VALUES (
    v_sender.parent_id,
    v_sender.id,
    'TRANSFER',
    v_sender_name || ' sent ' || v_amt_str || ' to ' || v_recipient_name || '.',
    '/parent'
  );

  RETURN jsonb_build_object(
    'balance', v_sender_new_balance,
    'toKidId', v_recipient.id,
    'amount', p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kid_send_to_sibling(uuid, uuid, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_send_to_sibling(uuid, uuid, numeric, text) TO service_role;

DROP FUNCTION IF EXISTS public.kid_request_transfer(uuid, uuid, numeric, text);
