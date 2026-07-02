-- 0004_catalog_meta — metadata de catálogo para las cards y el detalle.
-- Aplicada en Supabase (henry-machine) el 2026-07-01 vía MCP; se versiona acá.

alter table experiences
  add column if not exists neighborhood text,
  add column if not exists theme text,
  add column if not exists distance_m integer;

-- La vista pública suma neighborhood/theme/distance_m + stops_count (derivado
-- del conteo de arrivals). Se recrea apendeando columnas al final.
create or replace view experiences_public as
  select id, slug, title, city, pitch, cover_path, language, expected_minutes,
    price_cents, currency, published_at,
    ( select min(s."position")
        from steps s
       where s.experience_id = e.id and s.is_paywall) as paywall_position,
    neighborhood,
    theme,
    distance_m,
    ( select count(*)
        from steps s
       where s.experience_id = e.id and s.type = 'arrival') as stops_count
   from experiences e
  where status = 'published'::experience_status;
