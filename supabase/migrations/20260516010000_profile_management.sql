alter table public.kids 
  add column birth_date date,
  add column birth_year int,
  add column bio varchar(150);

insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true) 
on conflict (id) do nothing;

create policy "Avatars are publicly accessible" 
on storage.objects for select 
using ( bucket_id = 'avatars' );
