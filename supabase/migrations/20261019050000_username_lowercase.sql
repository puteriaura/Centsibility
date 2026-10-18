-- The deployer must verify there are no normalized username collisions first.
update public.kids set username = lower(btrim(username))
where username is not null and username <> lower(btrim(username));
drop index if exists public.kids_username_unique_idx;
create unique index if not exists kids_username_lower_unique_idx
on public.kids (lower(username)) where username is not null;
