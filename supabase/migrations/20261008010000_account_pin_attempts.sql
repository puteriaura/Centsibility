-- PIN outcomes are serialized per account. Only the server may submit an outcome.
create or replace function public.kid_pin_result(p_kid_id uuid, p_hash text, p_valid boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.kids%rowtype;
begin
  select * into v from public.kids where id = p_kid_id for update;
  if not found or v.hashed_pin is distinct from p_hash or p_valid is null then
    return jsonb_build_object('status', 'changed');
  end if;
  if v.locked_until > now() then
    return jsonb_build_object('status', 'locked', 'attemptsLeft', 0, 'lockedUntil', v.locked_until);
  end if;
  if v.locked_until is not null then
    v.failed_login_attempts := 0;
  end if;
  if p_valid then
    update public.kids set failed_login_attempts = 0, locked_until = null where id = p_kid_id;
    return jsonb_build_object('status', 'valid', 'attemptsLeft', 5, 'lockedUntil', null);
  end if;
  v.failed_login_attempts := least(5, coalesce(v.failed_login_attempts, 0) + 1);
  v.locked_until := case when v.failed_login_attempts >= 5 then now() + interval '15 minutes' else null end;
  update public.kids set failed_login_attempts = v.failed_login_attempts, locked_until = v.locked_until where id = p_kid_id;
  return jsonb_build_object('status', 'invalid', 'attemptsLeft', 5 - v.failed_login_attempts, 'lockedUntil', v.locked_until);
end $$;
revoke all on function public.kid_pin_result(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.kid_pin_result(uuid, text, boolean) to service_role;

create or replace function public.pin_account_status(p_mode text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_failed int; v_until timestamptz;
begin
  if p_mode = 'kid' then
    select failed_login_attempts, locked_until into v_failed, v_until from public.kids where id = p_id;
  elsif p_mode = 'parent' then
    select failed_attempts, locked_until into v_failed, v_until from public.commander_pins where parent_id = p_id;
  else
    raise exception 'invalid_mode';
  end if;
  if v_until is not null and v_until <= now() then
    v_failed := 0; v_until := null;
  end if;
  return jsonb_build_object('attemptsLeft', greatest(0, 5 - coalesce(v_failed, 0)), 'lockedUntil', v_until);
end $$;
revoke all on function public.pin_account_status(text, uuid) from public, anon, authenticated;
grant execute on function public.pin_account_status(text, uuid) to service_role;
