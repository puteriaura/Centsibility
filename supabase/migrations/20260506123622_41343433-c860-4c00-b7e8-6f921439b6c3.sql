
-- Parents (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kids
create table public.kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  login_code text not null unique,
  balance numeric not null default 0,
  coins int not null default 0,
  unclaimed_coins int not null default 0,
  xp int not null default 0,
  level int not null default 1,
  streak int not null default 0,
  hibah_rate numeric not null default 0.05,
  trust_score int not null default 750,
  created_at timestamptz not null default now()
);
alter table public.kids enable row level security;
create policy "parent reads kids" on public.kids for select using (auth.uid() = parent_id);
create policy "parent inserts kids" on public.kids for insert with check (auth.uid() = parent_id);
create policy "parent updates kids" on public.kids for update using (auth.uid() = parent_id);
create policy "parent deletes kids" on public.kids for delete using (auth.uid() = parent_id);

-- Goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  name text not null,
  emoji text not null default '🎯',
  target numeric not null,
  saved numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create policy "parent rw goals" on public.goals for all
  using (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()))
  with check (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()));

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  type text not null,
  amount numeric not null,
  label text not null,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "parent reads tx" on public.transactions for select
  using (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()));

-- Approvals (parent reviews requests from kid)
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  kind text not null,
  amount numeric not null default 0,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.approvals enable row level security;
create policy "parent rw approvals" on public.approvals for all
  using (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()))
  with check (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()));

-- Reward requests (custom rewards kid asks for)
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  name text not null,
  cost int not null default 0,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
alter table public.rewards enable row level security;
create policy "parent rw rewards" on public.rewards for all
  using (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()))
  with check (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()));

-- Qard loans (interest-free) with trust impact
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  amount numeric not null,
  repaid numeric not null default 0,
  due_date date not null,
  status text not null default 'active',
  reason text,
  created_at timestamptz not null default now()
);
alter table public.loans enable row level security;
create policy "parent rw loans" on public.loans for all
  using (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()))
  with check (exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()));
