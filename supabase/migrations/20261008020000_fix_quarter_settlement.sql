-- Preserve original 90-day quarters and all stored position terms. No position rewrite.
create or replace function public.kid_investments_settle(p_kid_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  r record;
  v_interval interval;
  v_ends_at timestamptz;
  v_final_val numeric;
  v_payout numeric(12,2);
  v_diff numeric(12,2);
  v_total_paid numeric(12,2) := 0;
begin
  select balance into v_bal from public.kids where id = p_kid_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  for r in (
    select * from public.investments
    where kid_id = p_kid_id and mode = 'fund' and status = 'active'
    for update
  ) loop
    v_interval := case r.frequency
      when 'minute' then interval '1 minute'
      when 'day' then interval '1 day'
      when 'week' then interval '7 days'
      when 'quarter' then interval '90 days'
      else interval '1 day'
    end;
    v_ends_at := r.created_at + (r.lock_ticks * v_interval);

    if now() >= v_ends_at then
      select value into v_final_val
      from public.investment_fund_path(r.id, v_ends_at)
      where tick = r.lock_ticks;

      if v_final_val is null then
        v_final_val := r.principal;
      end if;

      v_payout := greatest(0.00, round(v_final_val, 2));
      v_diff := v_payout - r.principal;

      update public.investments
      set status = 'closed',
          close_reason = 'matured',
          closed_at = v_ends_at,
          payout = v_payout
      where id = r.id;

      update public.kids set balance = balance + v_payout where id = p_kid_id;

      insert into public.transactions (kid_id, type, amount, label)
      values (p_kid_id, 'INVEST_OUT', v_payout, 'Centsibility Fund finished (' || initcap(r.tier) || ')');

      if v_diff >= 0.01 then
        insert into public.transactions (kid_id, type, amount, label)
        values (p_kid_id, 'INVEST_GAIN', v_diff, 'Investment profit');
      elsif v_diff <= -0.01 then
        insert into public.transactions (kid_id, type, amount, label)
        values (p_kid_id, 'INVEST_LOSS', abs(v_diff), 'Investment loss');
      end if;

      insert into public.kid_notifications (kid_id, kind, message, link)
      values (
        p_kid_id,
        'INVESTMENT',
        'Your ' || initcap(r.tier) || ' fund finished. RM' || to_char(r.principal, 'FM999,990.00') ||
        ' became RM' || to_char(v_payout, 'FM999,990.00') || ' and is back in your spending money.',
        '/kid/invest'
      );

      v_total_paid := v_total_paid + v_payout;
    end if;
  end loop;

  return jsonb_build_object('paid', v_total_paid);
end;
$$;

revoke all on function public.kid_investments_settle(uuid) from public, anon, authenticated;
grant execute on function public.kid_investments_settle(uuid) to service_role;
