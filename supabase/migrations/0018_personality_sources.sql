-- Alimentación multimodal ACUMULATIVA de la personalidad de Henry.
-- Cada "fuente" (video/audio/pdf/imagen/youtube/texto) se procesa con Gemini, que
-- extrae NOTAS de personalidad de esa fuente. El dossier global (voice_profiles)
-- se re-sintetiza juntando las notas de TODAS las fuentes en estado 'done'.

create table if not exists personality_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('youtube','video','audio','pdf','image','text')),
  title text,
  storage_path text,   -- archivos subidos (bucket personality-sources)
  external_url text,   -- youtube / link
  raw_text text,       -- kind='text'
  mime_type text,
  status text not null default 'pending' check (status in ('pending','processing','done','error')),
  notes text,          -- lo que Gemini extrajo de ESTA fuente
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table personality_sources enable row level security;
-- solo usuarios autenticados (admins) — el CRUD real corre por service_role igual
create policy ps_author_all on personality_sources for all to authenticated using (true) with check (true);

-- bucket privado para los archivos de personalidad
insert into storage.buckets (id, name, public) values
  ('personality-sources', 'personality-sources', false)
on conflict (id) do nothing;

create policy "psrc_auth_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'personality-sources');
create policy "psrc_auth_update" on storage.objects for update to authenticated
  using (bucket_id = 'personality-sources');
create policy "psrc_auth_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'personality-sources');
create policy "psrc_auth_select" on storage.objects for select to authenticated
  using (bucket_id = 'personality-sources');
