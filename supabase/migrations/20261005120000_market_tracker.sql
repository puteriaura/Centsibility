-- 20261005120000_market_tracker.sql
-- T36: Market Tracker - practice investing tracking real share prices

-- 1. Table market_symbols
create table if not exists public.market_symbols (
  symbol text primary key,
  name text not null,
  kind text not null check (kind in ('etf', 'stock')),
  halal_source text not null,
  halal_checked_on date not null,
  active boolean not null default true
);

-- Seed 12 curated symbols (7 ETFs + 5 US stocks)
insert into public.market_symbols (symbol, name, kind, halal_source, halal_checked_on, active)
values
  ('SPUS', 'SP Funds S&P 500 Sharia Industry Exclusions ETF', 'etf', 'S&P Shariah index (AAOIFI standards)', '2026-10-01', true),
  ('HLAL', 'Wahed FTSE USA Shariah ETF', 'etf', 'FTSE Shariah index', '2026-10-01', true),
  ('UMMA', 'Wahed Dow Jones Islamic World ETF', 'etf', 'Dow Jones Islamic Market index', '2026-10-01', true),
  ('SPWO', 'SP Funds S&P World (ex-US) ETF', 'etf', 'S&P Shariah index', '2026-10-01', true),
  ('SPSK', 'SP Funds Dow Jones Global Sukuk ETF', 'etf', 'Dow Jones Sukuk index (lower swings)', '2026-10-01', true),
  ('SPRE', 'SP Funds S&P Global REIT Sharia ETF', 'etf', 'S&P Shariah index', '2026-10-01', true),
  ('SPTE', 'SP Funds S&P Global Technology ETF', 'etf', 'S&P Shariah index', '2026-10-01', true),
  ('AAPL', 'Apple Inc.', 'stock', 'S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026', '2026-10-01', true),
  ('MSFT', 'Microsoft Corporation', 'stock', 'S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026', '2026-10-01', true),
  ('GOOGL', 'Alphabet Inc.', 'stock', 'S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026', '2026-10-01', true),
  ('NVDA', 'NVIDIA Corporation', 'stock', 'S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026', '2026-10-01', true),
  ('TSLA', 'Tesla, Inc.', 'stock', 'S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026', '2026-10-01', true)
on conflict (symbol) do update set
  name = excluded.name,
  kind = excluded.kind,
  halal_source = excluded.halal_source,
  halal_checked_on = excluded.halal_checked_on,
  active = excluded.active;

-- Foreign key on investments(symbol)
alter table public.investments
  add constraint investments_symbol_fkey
  foreign key (symbol) references public.market_symbols(symbol);

-- 2. Table market_quotes
create table if not exists public.market_quotes (
  symbol text primary key references public.market_symbols(symbol) on delete cascade,
  price numeric(18,6) not null,
  previous_close numeric(18,6),
  currency text not null default 'USD',
  is_market_open boolean not null default false,
  price_time timestamptz,
  fetched_at timestamptz not null default now()
);

-- 3. Table market_daily_closes
create table if not exists public.market_daily_closes (
  symbol text not null references public.market_symbols(symbol) on delete cascade,
  day date not null,
  close numeric(18,6) not null,
  primary key (symbol, day)
);

-- 4. Table market_api_calls
create table if not exists public.market_api_calls (
  id bigserial primary key,
  called_at timestamptz not null default now(),
  symbol text,
  endpoint text
);

create index if not exists idx_market_api_calls_called_at on public.market_api_calls(called_at);

-- 5. kids.market_tracker_enabled
alter table public.kids
  add column if not exists market_tracker_enabled boolean default null;

-- 6. RLS on the four tables: enabled with no client policies
alter table public.market_symbols enable row level security;
alter table public.market_quotes enable row level security;
alter table public.market_daily_closes enable row level security;
alter table public.market_api_calls enable row level security;

revoke all on public.market_symbols from public, anon, authenticated;
revoke all on public.market_quotes from public, anon, authenticated;
revoke all on public.market_daily_closes from public, anon, authenticated;
revoke all on public.market_api_calls from public, anon, authenticated;

grant all on public.market_symbols to service_role;
grant all on public.market_quotes to service_role;
grant all on public.market_daily_closes to service_role;
grant all on public.market_api_calls to service_role;

drop function if exists public.kid_market_open(uuid, text, numeric, uuid);

create or replace function public.kid_market_open(
  p_kid_id uuid,
  p_symbol text,
  p_amount numeric,
  p_client_request_id uuid default null,
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kid record;
  v_inv record;
  v_sym record;
  v_quote record;
  v_age_group text;
  v_enabled boolean;
  v_max_per numeric(12,2);
  v_max_tot numeric(12,2);
  v_open_count int;
  v_tot_exposure numeric(12,2);
  v_entry_price numeric(18,6);
  v_entry_price_at timestamptz;
  v_now timestamptz;
  v_in_market_window boolean;
begin
  select * into v_kid from public.kids where id = p_kid_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if p_client_request_id is not null then
    select * into v_inv from public.investments
    where kid_id = p_kid_id and client_request_id = p_client_request_id;
    if found then
      return to_jsonb(v_inv);
    end if;
  end if;

  v_age_group := public.kid_age_group(p_kid_id);
  v_enabled := v_kid.market_tracker_enabled;
  if v_enabled is null then
    if v_age_group = '13-17' then
      v_enabled := true;
    else
      v_enabled := false;
    end if;
  end if;

  if not v_enabled then
    raise exception 'market_off';
  end if;

  select * into v_sym from public.market_symbols where symbol = p_symbol;
  if not found or not v_sym.active then
    raise exception 'invalid_symbol';
  end if;

  if p_amount is null or p_amount < 1.00 or p_amount != round(p_amount, 2) then
    raise exception 'invalid_amount';
  end if;

  case v_age_group
    when '6-9' then
      v_max_per := 10.00;
      v_max_tot := 20.00;
    when '10-12' then
      v_max_per := 20.00;
      v_max_tot := 50.00;
    when '13-17' then
      v_max_per := 50.00;
      v_max_tot := 150.00;
    else
      v_max_per := 20.00;
      v_max_tot := 50.00;
  end case;

  if p_amount > v_max_per then
    raise exception 'limit_reached';
  end if;

  select count(*), coalesce(sum(principal), 0)
  into v_open_count, v_tot_exposure
  from public.investments
  where kid_id = p_kid_id and mode = 'market' and status = 'active';

  if v_open_count >= 5 or (v_tot_exposure + p_amount) > v_max_tot then
    raise exception 'limit_reached';
  end if;

  select * into v_quote from public.market_quotes where symbol = p_symbol;
  if not found or v_quote.price is null or v_quote.price <= 0 then
    raise exception 'stale_quote';
  end if;

  v_now := coalesce(p_now, now());
  v_in_market_window := (
    extract(isodow from (v_now at time zone 'UTC')) between 1 and 5
    and ((v_now at time zone 'UTC')::time >= time '13:30:00')
    and ((v_now at time zone 'UTC')::time < time '21:00:00')
  );

  if (v_in_market_window or v_quote.is_market_open is true) then
    if (v_now - v_quote.fetched_at) > interval '15 minutes' then
      raise exception 'stale_quote';
    end if;
  else
    if (v_now - v_quote.fetched_at) > interval '3 hours' then
      raise exception 'stale_quote';
    end if;
  end if;

  if v_kid.balance < p_amount then
    raise exception 'insufficient_balance';
  end if;

  v_entry_price := v_quote.price;
  v_entry_price_at := v_quote.fetched_at;

  insert into public.investments (
    kid_id, mode, label, principal, status, created_at, client_request_id,
    symbol, entry_price, entry_price_at
  ) values (
    p_kid_id, 'market', 'Market: ' || p_symbol, p_amount, 'active', now(), p_client_request_id,
    p_symbol, v_entry_price, v_entry_price_at
  ) returning * into v_inv;

  update public.kids set balance = balance - p_amount where id = p_kid_id;

  insert into public.transactions (kid_id, type, amount, label)
  values (p_kid_id, 'INVEST_IN', p_amount, 'Market: ' || p_symbol);

  return to_jsonb(v_inv);
end;
$$;

revoke all on function public.kid_market_open(uuid, text, numeric, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.kid_market_open(uuid, text, numeric, uuid, timestamptz) to service_role;

-- 8. Replace kid_investment_close to support both fund and market
drop function if exists public.kid_investment_close(uuid, uuid);

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

  elsif r.mode = 'market' then
    select * into v_quote from public.market_quotes where symbol = r.symbol;
    if not found or v_quote.price is null or v_quote.price <= 0 then
      raise exception 'stale_quote';
    end if;

    v_now := coalesce(p_now, now());
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
        closed_at = now(),
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
