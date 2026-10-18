update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'avatars';
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Avatars are publicly accessible" on storage.objects;
create policy "Owners read own avatar folder" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
