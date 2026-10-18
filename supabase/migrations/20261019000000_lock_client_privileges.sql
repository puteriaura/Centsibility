-- Remove direct client writes; privileged actions use edge functions.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;
drop policy if exists "parent rw notifications" on public.notifications;
drop policy if exists "parent updates notifications" on public.notifications;
revoke insert, update, delete, truncate on public.quiz_attempts from anon, authenticated;
drop policy if exists "parent reads quiz attempts" on public.quiz_attempts;
revoke all on public.child_creation_keys from anon, authenticated;
drop policy if exists "parent rw keys" on public.child_creation_keys;
alter table public.kids add column if not exists has_pin boolean generated always as (hashed_pin is not null) stored;
revoke select on public.kids from anon, authenticated;
grant select (id, parent_id, name, login_code, balance, coins, unclaimed_coins, xp, level, streak, hibah_rate, trust_score, created_at, invest_balance, invest_rate, invest_last_paid, quiz_date, quiz_correct, quiz_wrong, quiz_index, coins_decimal, avatar, username, birth_date, birth_year, bio, last_login_date, risk_appetite, invest_frequency, invest_last_settled, quiz_total_correct, card_frozen, card_daily_limit, card_online_enabled, penny_ai_date, penny_ai_count, card_controls_locked, comfort_name, age_group_override, market_tracker_enabled, has_pin) on public.kids to authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
create or replace function public.increment_quiz_total_correct()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.correct = true then
    update public.kids set quiz_total_correct = quiz_total_correct + 1 where id = new.kid_id;
  end if;
  return new;
end $$;
