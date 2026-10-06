-- 20261005110000_investments.sql
-- T35: Centsibility Funds (Investment) replaces Growth Tabung

-- 1. Table public.investments
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  mode text not null,
  label text,
  principal numeric(12,2) not null check (principal > 0),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  payout numeric(12,2),
  close_reason text check (close_reason in ('matured', 'early', 'sold')),
  client_request_id uuid,
  tier text check (tier in ('low', 'medium', 'high')),
  frequency text check (frequency in ('minute', 'day', 'week')),
  lock_ticks int check (lock_ticks > 0),
  seed text,
  symbol text,
  entry_price numeric(18,6) check (entry_price is null or entry_price > 0),
  entry_price_at timestamptz,
  constraint investments_kid_client_request_id_key unique (kid_id, client_request_id),
  constraint investments_mode_check check (
    (mode = 'fund' and tier is not null and frequency is not null and lock_ticks is not null and seed is not null and symbol is null and entry_price is null and entry_price_at is null)
    or
    (mode = 'market' and symbol is not null and entry_price is not null and entry_price_at is not null and tier is null and frequency is null and lock_ticks is null and seed is null)
  )
);

create index if not exists idx_investments_kid_status on public.investments(kid_id, status);

alter table public.investments enable row level security;
revoke all on public.investments from public, anon, authenticated;
grant all on public.investments to service_role;

-- 2. investment_fund_options()
create or replace function public.investment_fund_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'tiers', jsonb_build_object(
      'low', jsonb_build_object('name', 'Low', 'min_rate', 0.001, 'max_rate', 0.010, 'label', '0.10% to 1.00% per update (always grows)'),
      'medium', jsonb_build_object('name', 'Medium', 'min_rate', 0.001, 'max_rate', 0.030, 'label', '0.10% to 3.00% per update (always grows)'),
      'high', jsonb_build_object('name', 'High', 'min_rate', -0.020, 'max_rate', 0.050, 'label', '-2.00% to 5.00% per update (never dips below what you put in)')
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

revoke all on function public.investment_fund_options() from public, anon, authenticated;
grant execute on function public.investment_fund_options() to service_role;

-- 3. investment_fund_path(p_id uuid, p_at timestamptz)
create or replace function public.investment_fund_path(p_id uuid, p_at timestamptz default now())
returns table(tick int, tick_at timestamptz, rate numeric, value numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  v_interval interval;
  v_lo numeric;
  v_hi numeric;
  k int;
  v_tick_at timestamptz;
  v_u_k numeric;
  v_rate_k numeric;
  v_val numeric;
begin
  select * into inv from public.investments where id = p_id;
  if not found or inv.mode != 'fund' then
    return;
  end if;

  v_interval := case inv.frequency
    when 'minute' then interval '1 minute'
    when 'day' then interval '1 day'
    when 'week' then interval '7 days'
    else interval '1 day'
  end;

  case inv.tier
    when 'low' then v_lo := 0.001; v_hi := 0.010;
    when 'medium' then v_lo := 0.001; v_hi := 0.030;
    when 'high' then v_lo := -0.020; v_hi := 0.050;
    else v_lo := 0.001; v_hi := 0.010;
  end case;

  v_val := inv.principal;

  for k in 1..inv.lock_ticks loop
    v_tick_at := inv.created_at + (k * v_interval);
    if v_tick_at > p_at then
      exit;
    end if;

    v_u_k := (('x' || substr(md5(inv.seed || ':' || k::text), 1, 8))::bit(32)::bigint)::numeric / 4294967296.0;
    v_rate_k := v_lo + (v_hi - v_lo) * v_u_k;
    v_val := v_val * (1.0 + v_rate_k);

    if inv.tier = 'high' then
      v_val := greatest(inv.principal, v_val);
    end if;

    tick := k;
    tick_at := v_tick_at;
    rate := round(v_rate_k, 6);
    value := round(v_val, 6);
    return next;
  end loop;
end;
$$;

revoke all on function public.investment_fund_path(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.investment_fund_path(uuid, timestamptz) to service_role;

-- 4. kid_investment_open
create or replace function public.kid_investment_open(
  p_kid_id uuid,
  p_tier text,
  p_frequency text,
  p_lock_ticks int,
  p_amount numeric,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  v_open_funds int;
  v_open_min int;
  v_daily_min int;
  v_seed text;
  v_inv record;
begin
  select balance into v_bal from public.kids where id = p_kid_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if p_client_request_id is not null then
    select * into v_inv from public.investments
    where kid_id = p_kid_id and client_request_id = p_client_request_id;
    if found then
      return to_jsonb(v_inv) - 'seed';
    end if;
  end if;

  if p_amount is null or p_amount < 1.00 or p_amount != round(p_amount, 2) then
    raise exception 'invalid_amount';
  end if;

  if p_tier is null or p_frequency is null or p_lock_ticks is null then
    raise exception 'invalid_option';
  end if;

  if p_tier not in ('low', 'medium', 'high') then
    raise exception 'invalid_option';
  end if;

  if p_frequency = 'minute' then
    if p_lock_ticks not in (5, 10, 15) or p_amount > 10.00 then
      raise exception 'invalid_option';
    end if;
  elsif p_frequency = 'day' then
    if p_lock_ticks not in (3, 7, 14) or p_amount > 50.00 then
      raise exception 'invalid_option';
    end if;
  elsif p_frequency = 'week' then
    if p_lock_ticks not in (2, 4, 8) or p_amount > 50.00 then
      raise exception 'invalid_option';
    end if;
  else
    raise exception 'invalid_option';
  end if;

  select count(*) into v_open_funds
  from public.investments
  where kid_id = p_kid_id and mode = 'fund' and status = 'active';

  if v_open_funds >= 5 then
    raise exception 'limit_reached';
  end if;

  if p_frequency = 'minute' then
    select count(*) into v_open_min
    from public.investments
    where kid_id = p_kid_id and mode = 'fund' and frequency = 'minute' and status = 'active';

    if v_open_min >= 1 then
      raise exception 'limit_reached';
    end if;

    select count(*) into v_daily_min
    from public.investments
    where kid_id = p_kid_id
      and mode = 'fund'
      and frequency = 'minute'
      and timezone('Asia/Kuala_Lumpur', created_at)::date = timezone('Asia/Kuala_Lumpur', now())::date;

    if v_daily_min >= 3 then
      raise exception 'limit_reached';
    end if;
  end if;

  if v_bal < p_amount then
    raise exception 'insufficient_balance';
  end if;

  v_seed := md5(gen_random_uuid()::text || clock_timestamp()::text);

  insert into public.investments (
    kid_id, mode, label, principal, status, created_at, client_request_id,
    tier, frequency, lock_ticks, seed
  ) values (
    p_kid_id, 'fund', 'Centsibility Fund (' || initcap(p_tier) || ')', p_amount, 'active', now(), p_client_request_id,
    p_tier, p_frequency, p_lock_ticks, v_seed
  ) returning * into v_inv;

  update public.kids set balance = balance - p_amount where id = p_kid_id;

  insert into public.transactions (kid_id, type, amount, label)
  values (p_kid_id, 'INVEST_IN', p_amount, 'Centsibility Fund (' || initcap(p_tier) || ')');

  return to_jsonb(v_inv) - 'seed';
end;
$$;

revoke all on function public.kid_investment_open(uuid, text, text, int, numeric, uuid) from public, anon, authenticated;
grant execute on function public.kid_investment_open(uuid, text, text, int, numeric, uuid) to service_role;

-- 5. kid_investments_settle
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
  v_profit numeric(12,2);
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

      v_payout := round(v_final_val, 2);
      v_profit := v_payout - r.principal;

      update public.investments
      set status = 'closed',
          close_reason = 'matured',
          closed_at = v_ends_at,
          payout = v_payout
      where id = r.id;

      update public.kids set balance = balance + v_payout where id = p_kid_id;

      insert into public.transactions (kid_id, type, amount, label)
      values (p_kid_id, 'INVEST_OUT', v_payout, 'Centsibility Fund finished (' || initcap(r.tier) || ')');

      if v_profit >= 0.01 then
        insert into public.transactions (kid_id, type, amount, label)
        values (p_kid_id, 'INVEST_GAIN', v_profit, 'Investment profit');
      end if;

      insert into public.kid_notifications (kid_id, kind, message, link)
      values (
        p_kid_id,
        'INVESTMENT',
        'Your ' || initcap(r.tier) || ' fund finished. RM' || to_char(r.principal, 'FM999,990.00') ||
        ' grew to RM' || to_char(v_payout, 'FM999,990.00') || ' and is back in your spending money.',
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

-- 6. kid_investment_close
create or replace function public.kid_investment_close(p_kid_id uuid, p_investment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  r record;
begin
  select balance into v_bal from public.kids where id = p_kid_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into r from public.investments
  where id = p_investment_id and kid_id = p_kid_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if r.status != 'active' then
    raise exception 'already_resolved';
  end if;

  if r.mode = 'fund' then
    update public.investments
    set status = 'closed',
        close_reason = 'early',
        closed_at = now(),
        payout = r.principal
    where id = r.id;

    update public.kids set balance = balance + r.principal where id = p_kid_id;

    insert into public.transactions (kid_id, type, amount, label)
    values (p_kid_id, 'INVEST_OUT', r.principal, 'Took out early (' || initcap(r.tier) || ' fund)');

    return jsonb_build_object('success', true, 'payout', r.principal);
  else
    raise exception 'invalid_option';
  end if;
end;
$$;

revoke all on function public.kid_investment_close(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kid_investment_close(uuid, uuid) to service_role;

-- 7. Migrate Growth Tabung
do $$
declare
  k record;
  v_tier text;
  v_seed text;
begin
  for k in select id, invest_balance, risk_appetite from public.kids where invest_balance > 0 loop
    v_tier := case k.risk_appetite
      when 'very_low' then 'low'
      when 'low' then 'low'
      when 'medium' then 'medium'
      when 'high' then 'high'
      when 'very_high' then 'high'
      else 'medium'
    end;
    v_seed := md5(gen_random_uuid()::text || clock_timestamp()::text);
    insert into public.investments (
      kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed
    ) values (
      k.id, 'fund', 'Moved from Growth Tabung', round(k.invest_balance, 2), 'active',
      v_tier, 'week', 4, v_seed
    );
    update public.kids set invest_balance = 0 where id = k.id;
  end loop;
end $$;

-- 8. Clean Quest text: replace "Growth Tabung" with halal investment
update public.quests
set summary = replace(replace(summary, 'halal investments or Growth Tabung', 'halal investments'), 'a halal Growth Tabung', 'a halal investment'),
    title = replace(replace(title, 'halal investments or Growth Tabung', 'halal investments'), 'a halal Growth Tabung', 'a halal investment')
where summary like '%Growth Tabung%' or title like '%Growth Tabung%';

update public.quest_questions
set prompt = replace(replace(prompt, 'halal investments or Growth Tabung', 'halal investments'), 'a halal Growth Tabung', 'a halal investment'),
    explanation = replace(replace(explanation, 'halal investments or Growth Tabung', 'halal investments'), 'a halal Growth Tabung', 'a halal investment')
where prompt like '%Growth Tabung%' or explanation like '%Growth Tabung%';
