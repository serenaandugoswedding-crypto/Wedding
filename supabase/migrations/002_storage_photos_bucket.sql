-- Create public storage bucket for photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- Allow anyone to read files in the photos bucket
create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Allow service role to upload and delete
create policy "Service role write access"
  on storage.objects for insert
  with check (bucket_id = 'photos' and auth.role() = 'service_role');

create policy "Service role delete access"
  on storage.objects for delete
  using (bucket_id = 'photos' and auth.role() = 'service_role');
