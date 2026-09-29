-- One-time, atomic resolution of parent approvals and reward requests.
--
-- Each function locks the request row and the child's row, checks the request
-- is still open, then applies every balance, ledger and status change inside
-- the function's single transaction. Any failure rolls everything back, and a
-- second approval of the same request fails with 'already_resolved' instead of
-- charging twice.
--
-- Only the service role (the parent-finance edge function) may execute them.
-- Errors are raised with stable messages the edge function maps to HTTP codes:
--   not_found, already_resolved, insufficient_balance, insufficient_coins,
--   missing_loan_terms, unknown_kind.
--
-- Rollback: DROP FUNCTION public.resolve_approval(uuid, uuid, boolean, date, text, text);
--           DROP FUNCTION public.resolve_reward(uuid, uuid, boolean);
--           and redeploy the previous parent-finance function.

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

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.resolve_approval(
  p_approval_id uuid,
  p_parent_id uuid,
  p_approve boolean,
  p_loan_due_date date default null,
  p_loan_reason text default null,
  p_loan_signature text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Existing loan fee schedule, unchanged from the edge function it replaces.
  c_service_fee constant numeric := 3.0;
  c_processing_fee constant numeric := 2.5;
  v_ap public.approvals%rowtype;
  v_kid public.kids%rowtype;
  v_net numeric;
begin
  select * into v_ap from public.approvals where id = p_approval_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_kid from public.kids where id = v_ap.kid_id for update;
  if not found or v_kid.parent_id is distinct from p_parent_id then
    raise exception 'not_found';
  end if;

  if v_ap.status <> 'pending' then
    raise exception 'already_resolved';
  end if;

  if p_approve then
    if v_ap.kind = 'WITHDRAWAL' then
      if v_ap.amount > v_kid.balance then
        raise exception 'insufficient_balance';
      end if;
      update public.kids set balance = balance - v_ap.amount where id = v_kid.id;
      insert into public.transactions (kid_id, type, amount, label)
        values (v_kid.id, 'WITHDRAWAL', v_ap.amount, v_ap.reason);

    elsif v_ap.kind = 'DEPOSIT' then
      update public.kids set balance = balance + v_ap.amount where id = v_kid.id;
      insert into public.transactions (kid_id, type, amount, label)
        values (v_kid.id, 'DEPOSIT', v_ap.amount, v_ap.reason);

    elsif v_ap.kind = 'QARD' then
      if p_loan_due_date is null or p_loan_reason is null then
        raise exception 'missing_loan_terms';
      end if;
      v_net := greatest(0, v_ap.amount - c_service_fee - c_processing_fee);
      insert into public.loans (kid_id, amount, due_date, reason, signature_data_url, signed_at)
        values (v_kid.id, v_ap.amount, p_loan_due_date, p_loan_reason, p_loan_signature, now());
      update public.kids set balance = balance + v_net where id = v_kid.id;
      insert into public.transactions (kid_id, type, amount, label) values
        (v_kid.id, 'QARD', v_net, 'Qard approved: ' || p_loan_reason),
        (v_kid.id, 'WITHDRAWAL', c_service_fee, 'Loan service fee'),
        (v_kid.id, 'WITHDRAWAL', c_processing_fee, 'Loan processing fee');

    else
      raise exception 'unknown_kind';
    end if;
  end if;

  update public.approvals
     set status = case when p_approve then 'approved' else 'declined' end,
         resolved_at = now()
   where id = v_ap.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.resolve_reward(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.resolve_reward(uuid, uuid, boolean) to service_role;

revoke all on function public.resolve_approval(uuid, uuid, boolean, date, text, text) from public, anon, authenticated;
grant execute on function public.resolve_approval(uuid, uuid, boolean, date, text, text) to service_role;

-- Close an older hole: these SECURITY DEFINER helpers bypass RLS and were
-- executable by every client role, so anyone holding the public anon key could
-- change any child's balance or coins through /rpc. Only edge functions (service
-- role) call them.
revoke all on function public.adjust_kid_balance(uuid, numeric) from public, anon, authenticated;
grant execute on function public.adjust_kid_balance(uuid, numeric) to service_role;
alter function public.adjust_kid_balance(uuid, numeric) set search_path = public;

revoke all on function public.adjust_kid_coins(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_kid_coins(uuid, integer) to service_role;
alter function public.adjust_kid_coins(uuid, integer) set search_path = public;
