-- V3 K5: Chores table, RLS, and atomic SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS public.chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kid_id uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  amount numeric(10,2) NOT NULL CHECK (amount > 0 AND amount <= 10000 AND amount = round(amount, 2)),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'APPROVED', 'DECLINED')),
  completed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chores_parent_status_idx
  ON public.chores (parent_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS chores_kid_status_idx
  ON public.chores (kid_id, status, created_at DESC);

ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent reads own chores" ON public.chores;
CREATE POLICY "parent reads own chores"
  ON public.chores
  FOR SELECT
  TO authenticated
  USING (auth.uid() = parent_id);

CREATE OR REPLACE FUNCTION public.parent_create_chore(
  p_parent_id uuid,
  p_kid_id uuid,
  p_title text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text := btrim(COALESCE(p_title, ''));
  v_amount numeric(10,2);
  v_kid_name text;
  v_row public.chores;
BEGIN
  IF char_length(v_title) < 1 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;
  v_amount := round(p_amount, 2);

  SELECT name INTO v_kid_name
  FROM public.kids
  WHERE id = p_kid_id AND parent_id = p_parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.chores (parent_id, kid_id, title, amount, status)
  VALUES (p_parent_id, p_kid_id, v_title, v_amount, 'OPEN')
  RETURNING * INTO v_row;

  INSERT INTO public.kid_notifications (kid_id, kind, message, link)
  VALUES (
    p_kid_id,
    'CHORE',
    'New chore: ' || v_title || ' (RM' || to_char(v_amount, 'FM999990.00') || ')',
    '/kid/missions'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'parent_id', v_row.parent_id,
    'kid_id', v_row.kid_id,
    'title', v_row.title,
    'amount', v_row.amount,
    'status', v_row.status,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kid_complete_chore(
  p_kid_id uuid,
  p_chore_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.chores;
  v_kid_name text;
BEGIN
  SELECT * INTO v_row
  FROM public.chores
  WHERE id = p_chore_id AND kid_id = p_kid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'OPEN' THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.chores
  SET status = 'DONE',
      completed_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  SELECT name INTO v_kid_name FROM public.kids WHERE id = p_kid_id;

  INSERT INTO public.notifications (parent_id, kid_id, kind, message, link)
  VALUES (
    v_row.parent_id,
    v_row.kid_id,
    'CHORE',
    COALESCE(v_kid_name, 'Your child') || ' finished chore: ' || v_row.title || ' (RM' || to_char(v_row.amount, 'FM999990.00') || ')',
    '/parent/approvals'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'kid_id', v_row.kid_id,
    'title', v_row.title,
    'amount', v_row.amount,
    'status', v_row.status,
    'completed_at', v_row.completed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.parent_resolve_chore(
  p_parent_id uuid,
  p_chore_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision text := upper(btrim(COALESCE(p_decision, '')));
  v_row public.chores;
  v_new_balance numeric(12,2);
BEGIN
  IF v_decision NOT IN ('APPROVED', 'DECLINED') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.chores
  WHERE id = p_chore_id AND parent_id = p_parent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'DONE' THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = 'P0001';
  END IF;

  IF v_decision = 'APPROVED' THEN
    UPDATE public.kids
    SET balance = round((balance + v_row.amount)::numeric, 2)
    WHERE id = v_row.kid_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.transactions (kid_id, type, label, amount)
    VALUES (v_row.kid_id, 'CHORE', v_row.title, v_row.amount);

    INSERT INTO public.kid_notifications (kid_id, kind, message, link)
    VALUES (
      v_row.kid_id,
      'CHORE',
      'Chore approved: ' || v_row.title || ' (+RM' || to_char(v_row.amount, 'FM999990.00') || ')',
      '/kid/history'
    );
  ELSE
    SELECT balance INTO v_new_balance FROM public.kids WHERE id = v_row.kid_id;

    INSERT INTO public.kid_notifications (kid_id, kind, message, link)
    VALUES (
      v_row.kid_id,
      'CHORE',
      'Chore not approved yet: ' || v_row.title,
      '/kid/missions'
    );
  END IF;

  UPDATE public.chores
  SET status = v_decision,
      resolved_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'kid_id', v_row.kid_id,
    'title', v_row.title,
    'amount', v_row.amount,
    'status', v_row.status,
    'resolved_at', v_row.resolved_at,
    'balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.parent_create_chore(uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_create_chore(uuid, uuid, text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.kid_complete_chore(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kid_complete_chore(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.parent_resolve_chore(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_resolve_chore(uuid, uuid, text) TO service_role;
