-- Storage: buckets + policies (aplicado a henry-machine)
insert into storage.buckets (id, name, public) values
  ('experience-media', 'experience-media', false),
  ('experience-covers', 'experience-covers', true)
on conflict (id) do nothing;

-- experience-media: solo el autor escribe bajo prefijo <experience_id>/ ;
-- NO hay select de cliente → el player recibe signed URLs del backend (service_role + can_read_step()).
create policy "media_author_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'experience-media'
    and is_experience_author(((storage.foldername(name))[1])::uuid));
create policy "media_author_update" on storage.objects for update to authenticated
  using (bucket_id = 'experience-media'
    and is_experience_author(((storage.foldername(name))[1])::uuid));
create policy "media_author_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'experience-media'
    and is_experience_author(((storage.foldername(name))[1])::uuid));

-- experience-covers: lectura pública + autor escribe bajo su prefijo
create policy "covers_public_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'experience-covers');
create policy "covers_author_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'experience-covers'
    and is_experience_author(((storage.foldername(name))[1])::uuid));
create policy "covers_author_update" on storage.objects for update to authenticated
  using (bucket_id = 'experience-covers'
    and is_experience_author(((storage.foldername(name))[1])::uuid));
create policy "covers_author_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'experience-covers'
    and is_experience_author(((storage.foldername(name))[1])::uuid));
