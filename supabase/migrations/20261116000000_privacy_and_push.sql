-- V4: Push subscriptions (FC-28/P7) + Parent family data export & full account deletion (FC-05 part 2).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  kid_id uuid REFERENCES public.kids(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('parent', 'kid')),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_actor_chk CHECK (
    (role = 'parent' AND parent_id IS NOT NULL AND kid_id IS NULL)
    OR (role = 'kid' AND kid_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS push_subscriptions_parent_idx
  ON public.push_subscriptions (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS push_subscriptions_kid_idx
  ON public.push_subscriptions (kid_id)
  WHERE kid_id IS NOT NULL;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent reads own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "parent reads own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = parent_id AND role = 'parent');

DROP POLICY IF EXISTS "parent deletes own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "parent deletes own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = parent_id AND role = 'parent');

REVOKE ALL ON TABLE public.push_subscriptions FROM anon;
GRANT SELECT, DELETE ON TABLE public.push_subscriptions TO authenticated;

CREATE OR REPLACE FUNCTION public.parent_export_family_data(p_parent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent jsonb;
  v_kid_ids uuid[];
  v_children jsonb;
  v_goals jsonb;
  v_transactions jsonb;
  v_loans jsonb;
  v_approvals jsonb;
  v_rewards jsonb;
  v_hibahs jsonb;
  v_chores jsonb;
  v_investments jsonb;
  v_notifications jsonb;
  v_kid_notifications jsonb;
  v_quest_completions jsonb;
  v_quiz_attempts jsonb;
  v_push_count integer := 0;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'email', p.email,
    'child_privacy_consent_version', p.child_privacy_consent_version,
    'child_privacy_consent_at', p.child_privacy_consent_at,
    'created_at', p.created_at
  )
  INTO v_parent
  FROM public.profiles p
  WHERE p.id = p_parent_id;

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(k.id), ARRAY[]::uuid[])
  INTO v_kid_ids
  FROM public.kids k
  WHERE k.parent_id = p_parent_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', k.id,
      'name', k.name,
      'username', k.username,
      'birth_date', k.birth_date,
      'avatar', k.avatar,
      'balance', k.balance,
      'coins', k.coins,
      'streak', k.streak,
      'last_login_date', k.last_login_date,
      'quiz_total_correct', k.quiz_total_correct,
      'card_frozen', k.card_frozen,
      'card_daily_limit', k.card_daily_limit,
      'created_at', k.created_at
    )
    ORDER BY k.created_at ASC
  ), '[]'::jsonb)
  INTO v_children
  FROM public.kids k
  WHERE k.parent_id = p_parent_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.created_at ASC), '[]'::jsonb)
  INTO v_goals
  FROM public.goals g
  WHERE g.kid_id = ANY(v_kid_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_transactions
  FROM public.transactions t
  WHERE t.kid_id = ANY(v_kid_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_loans
  FROM public.loans l
  WHERE l.kid_id = ANY(v_kid_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_approvals
  FROM public.approvals a
  WHERE a.kid_id = ANY(v_kid_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_rewards
  FROM public.rewards r
  WHERE r.kid_id = ANY(v_kid_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.next_run_at ASC), '[]'::jsonb)
  INTO v_hibahs
  FROM public.scheduled_hibahs h
  WHERE h.parent_id = p_parent_id;

  IF to_regclass('public.chores') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC), '[]'::jsonb)
    INTO v_chores
    FROM public.chores c
    WHERE c.parent_id = p_parent_id;
  ELSE
    v_chores := '[]'::jsonb;
  END IF;

  IF to_regclass('public.investments') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC), '[]'::jsonb)
    INTO v_investments
    FROM public.investments i
    WHERE i.kid_id = ANY(v_kid_ids);
  ELSE
    v_investments := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_notifications
  FROM public.notifications n
  WHERE n.parent_id = p_parent_id;

  IF to_regclass('public.kid_notifications') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(kn) ORDER BY kn.created_at DESC), '[]'::jsonb)
    INTO v_kid_notifications
    FROM public.kid_notifications kn
    WHERE kn.kid_id = ANY(v_kid_ids);
  ELSE
    v_kid_notifications := '[]'::jsonb;
  END IF;

  IF to_regclass('public.quest_completions') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(qc)), '[]'::jsonb)
    INTO v_quest_completions
    FROM public.quest_completions qc
    WHERE qc.kid_id = ANY(v_kid_ids);
  ELSE
    v_quest_completions := '[]'::jsonb;
  END IF;

  IF to_regclass('public.quiz_attempts') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(qa)), '[]'::jsonb)
    INTO v_quiz_attempts
    FROM public.quiz_attempts qa
    WHERE qa.kid_id = ANY(v_kid_ids);
  ELSE
    v_quiz_attempts := '[]'::jsonb;
  END IF;

  SELECT count(*)::integer
  INTO v_push_count
  FROM public.push_subscriptions ps
  WHERE ps.parent_id = p_parent_id OR ps.kid_id = ANY(v_kid_ids);

  RETURN jsonb_build_object(
    'exported_at', now(),
    'retention_rule', 'Family records are kept while your account is active. Deleting a child or parent account removes associated records permanently.',
    'parent', v_parent,
    'children', v_children,
    'goals', v_goals,
    'transactions', v_transactions,
    'loans', v_loans,
    'approvals', v_approvals,
    'rewards', v_rewards,
    'scheduled_hibahs', v_hibahs,
    'chores', v_chores,
    'investments', v_investments,
    'notifications', v_notifications,
    'kid_notifications', v_kid_notifications,
    'quest_completions', v_quest_completions,
    'quiz_attempts', v_quiz_attempts,
    'push_subscriptions_count', v_push_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.parent_delete_account_data(p_parent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kid_ids uuid[];
  v_avatars text[];
  v_kid_count integer := 0;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_parent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(array_agg(k.id), ARRAY[]::uuid[]),
    COALESCE(array_agg(k.avatar) FILTER (WHERE k.avatar IS NOT NULL AND k.avatar <> ''), ARRAY[]::text[])
  INTO v_kid_ids, v_avatars
  FROM public.kids k
  WHERE k.parent_id = p_parent_id;

  v_kid_count := COALESCE(array_length(v_kid_ids, 1), 0);

  DELETE FROM public.push_subscriptions WHERE parent_id = p_parent_id OR kid_id = ANY(v_kid_ids);
  DELETE FROM public.notifications WHERE parent_id = p_parent_id OR kid_id = ANY(v_kid_ids);
  IF to_regclass('public.kid_notifications') IS NOT NULL THEN
    DELETE FROM public.kid_notifications WHERE kid_id = ANY(v_kid_ids);
  END IF;
  IF to_regclass('public.chores') IS NOT NULL THEN
    DELETE FROM public.chores WHERE parent_id = p_parent_id OR kid_id = ANY(v_kid_ids);
  END IF;
  IF to_regclass('public.quest_completions') IS NOT NULL THEN
    DELETE FROM public.quest_completions WHERE kid_id = ANY(v_kid_ids);
  END IF;
  IF to_regclass('public.quiz_attempts') IS NOT NULL THEN
    DELETE FROM public.quiz_attempts WHERE kid_id = ANY(v_kid_ids);
  END IF;
  IF to_regclass('public.investments') IS NOT NULL THEN
    DELETE FROM public.investments WHERE kid_id = ANY(v_kid_ids);
  END IF;
  DELETE FROM public.scheduled_hibahs WHERE parent_id = p_parent_id OR kid_id = ANY(v_kid_ids);
  DELETE FROM public.transactions WHERE kid_id = ANY(v_kid_ids);
  DELETE FROM public.approvals WHERE kid_id = ANY(v_kid_ids);
  DELETE FROM public.rewards WHERE kid_id = ANY(v_kid_ids);
  DELETE FROM public.goals WHERE kid_id = ANY(v_kid_ids);
  DELETE FROM public.loans WHERE kid_id = ANY(v_kid_ids);
  DELETE FROM public.kids WHERE parent_id = p_parent_id;

  IF to_regclass('public.parent_pin_sessions') IS NOT NULL THEN
    DELETE FROM public.parent_pin_sessions WHERE parent_id = p_parent_id;
  END IF;
  IF to_regclass('public.child_creation_keys') IS NOT NULL THEN
    DELETE FROM public.child_creation_keys WHERE parent_id = p_parent_id;
  END IF;
  IF to_regclass('public.commander_pins') IS NOT NULL THEN
    DELETE FROM public.commander_pins WHERE parent_id = p_parent_id;
  END IF;

  DELETE FROM public.profiles WHERE id = p_parent_id;

  RETURN jsonb_build_object(
    'deleted_parent_id', p_parent_id,
    'deleted_kids', v_kid_count,
    'avatar_urls', to_jsonb(v_avatars)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.parent_export_family_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_export_family_data(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.parent_delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_delete_account_data(uuid) TO service_role;
