-- 20261006100000_fund_ups_and_downs.sql
-- T39: Funds go up and down like a real market; protected flag; neutral notifications

-- 1. New columns on public.investments
alter table public.investments
  add column if not exists min_rate numeric(8,5),
  add column if not exists max_rate numeric(8,5),
  add column if not exists protected boolean not null default false;

-- 2. Backfill existing fund rows with old ranges and protected = true
update public.investments
set min_rate = case tier
      when 'low' then 0.00100
      when 'medium' then 0.00100
      when 'high' then -0.02000
      else 0.00100
    end,
    max_rate = case tier
      when 'low' then 0.01000
      when 'medium' then 0.03000
      when 'high' then 0.05000
      else 0.01000
    end,
    protected = true
where mode = 'fund';

-- Check constraint: fund rows must have min_rate and max_rate set
alter table public.investments
  drop constraint if exists investments_fund_rate_check;

alter table public.investments
  add constraint investments_fund_rate_check check (
    mode != 'fund' or (min_rate is not null and max_rate is not null)
  );

-- 3. investment_fund_options()
create or replace function public.investment_fund_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'tiers', jsonb_build_object(
      'low', jsonb_build_object('name', 'Low', 'min_rate', -0.005, 'max_rate', 0.005, 'label', 'Low: moves up to 0.5% each update'),
      'medium', jsonb_build_object('name', 'Medium', 'min_rate', -0.010, 'max_rate', 0.010, 'label', 'Medium: up to 1%'),
      'high', jsonb_build_object('name', 'High', 'min_rate', -0.020, 'max_rate', 0.020, 'label', 'High: up to 2%')
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

-- 4. investment_fund_path(p_id uuid, p_at timestamptz)
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

  v_lo := coalesce(inv.min_rate, -0.005);
  v_hi := coalesce(inv.max_rate, 0.005);

  v_val := inv.principal;

  for k in 1..inv.lock_ticks loop
    v_tick_at := inv.created_at + (k * v_interval);
    if v_tick_at > p_at then
      exit;
    end if;

    v_u_k := (('x' || substr(md5(inv.seed || ':' || k::text), 1, 8))::bit(32)::bigint)::numeric / 4294967296.0;
    v_rate_k := v_lo + (v_hi - v_lo) * v_u_k;
    v_val := v_val * (1.0 + v_rate_k);

    if inv.protected is true then
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

-- 5. kid_investment_open
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
  v_min_rate numeric(8,5);
  v_max_rate numeric(8,5);
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

  if p_tier = 'low' then
    v_min_rate := -0.005;
    v_max_rate := 0.005;
  elsif p_tier = 'medium' then
    v_min_rate := -0.010;
    v_max_rate := 0.010;
  elsif p_tier = 'high' then
    v_min_rate := -0.020;
    v_max_rate := 0.020;
  else
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
    tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
  ) values (
    p_kid_id, 'fund', 'Centsibility Fund (' || initcap(p_tier) || ')', p_amount, 'active', now(), p_client_request_id,
    p_tier, p_frequency, p_lock_ticks, v_seed, v_min_rate, v_max_rate, false
  ) returning * into v_inv;

  update public.kids set balance = balance - p_amount where id = p_kid_id;

  insert into public.transactions (kid_id, type, amount, label)
  values (p_kid_id, 'INVEST_IN', p_amount, 'Centsibility Fund (' || initcap(p_tier) || ')');

  return to_jsonb(v_inv) - 'seed';
end;
$$;

revoke all on function public.kid_investment_open(uuid, text, text, int, numeric, uuid) from public, anon, authenticated;
grant execute on function public.kid_investment_open(uuid, text, text, int, numeric, uuid) to service_role;

-- 6. kid_investments_settle
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

-- 7. kid_investment_close (keeping exactly the 3-arg signature from 20261005120000)
create or replace function public.kid_investment_close(
  p_kid_id uuid,
  p_investment_id uuid,
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  r record;
  v_quote record;
  v_raw_payout numeric(12,2);
  v_payout numeric(12,2);
  v_diff numeric(12,2);
  v_now timestamptz;
  v_in_market_window boolean;
  v_cur_val numeric;
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

  v_now := coalesce(p_now, now());

  if r.mode = 'fund' then
    if r.protected is true then
      v_payout := r.principal;
      v_diff := 0;

      update public.investments
      set status = 'closed',
          close_reason = 'early',
          closed_at = v_now,
          payout = v_payout
      where id = r.id;

      update public.kids set balance = balance + v_payout where id = p_kid_id;

      insert into public.transactions (kid_id, type, amount, label)
      values (p_kid_id, 'INVEST_OUT', v_payout, 'Took out early (' || initcap(r.tier) || ' fund)');

      return jsonb_build_object('success', true, 'payout', v_payout);
    else
      -- Unprotected fund: pays value at now()
      select value into v_cur_val
      from public.investment_fund_path(r.id, v_now)
      order by tick desc
      limit 1;

      if v_cur_val is null then
        v_cur_val := r.principal;
      end if;

      v_payout := greatest(0.00, round(v_cur_val, 2));
      v_diff := v_payout - r.principal;

      update public.investments
      set status = 'closed',
          close_reason = 'early',
          closed_at = v_now,
          payout = v_payout
      where id = r.id;

      update public.kids set balance = balance + v_payout where id = p_kid_id;

      insert into public.transactions (kid_id, type, amount, label)
      values (p_kid_id, 'INVEST_OUT', v_payout, 'Took out early (' || initcap(r.tier) || ' fund)');

      if v_diff >= 0.01 then
        insert into public.transactions (kid_id, type, amount, label)
        values (p_kid_id, 'INVEST_GAIN', v_diff, 'Investment profit');
      elsif v_diff <= -0.01 then
        insert into public.transactions (kid_id, type, amount, label)
        values (p_kid_id, 'INVEST_LOSS', abs(v_diff), 'Investment loss');
      end if;

      return jsonb_build_object('success', true, 'payout', v_payout);
    end if;

  elsif r.mode = 'market' then
    select * into v_quote from public.market_quotes where symbol = r.symbol;
    if not found or v_quote.price is null or v_quote.price <= 0 then
      raise exception 'stale_quote';
    end if;

    v_in_market_window := (
      extract(isodow from (v_now at time zone 'UTC')) between 1 and 5
      and ((v_now at time zone 'UTC')::time >= time '13:30:00')
      and ((v_now at time zone 'UTC')::time < time '21:00:00')
    );

    if (v_in_market_window or v_quote.is_market_open is true) then
      if (v_now - v_quote.fetched_at) > interval '30 minutes' then
        raise exception 'stale_quote';
      end if;
    else
      if (v_now - v_quote.fetched_at) > interval '3 hours' then
        raise exception 'stale_quote';
      end if;
    end if;

    v_raw_payout := round(r.principal * (v_quote.price / r.entry_price), 2);
    v_payout := greatest(0.00, least(v_raw_payout, round(r.principal * 10, 2)));
    v_diff := v_payout - r.principal;

    update public.investments
    set status = 'closed',
        close_reason = 'sold',
        closed_at = v_now,
        payout = v_payout
    where id = r.id;

    update public.kids set balance = balance + v_payout where id = p_kid_id;

    insert into public.transactions (kid_id, type, amount, label)
    values (p_kid_id, 'INVEST_OUT', v_payout, 'Sold Market: ' || r.symbol);

    if v_diff >= 0.01 then
      insert into public.transactions (kid_id, type, amount, label)
      values (p_kid_id, 'INVEST_GAIN', v_diff, 'Market profit');
    elsif v_diff <= -0.01 then
      insert into public.transactions (kid_id, type, amount, label)
      values (p_kid_id, 'INVEST_LOSS', abs(v_diff), 'Market loss');
    end if;

    return jsonb_build_object('success', true, 'payout', v_payout);

  else
    raise exception 'invalid_option';
  end if;
end;
$$;

revoke all on function public.kid_investment_close(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.kid_investment_close(uuid, uuid, timestamptz) to service_role;
