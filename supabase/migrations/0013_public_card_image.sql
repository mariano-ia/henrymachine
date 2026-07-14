-- 0013: exponer card_image_path en la vista pública (para la card de la home).
create or replace view experiences_public as
 select id, slug, title, city, pitch, cover_path, language, expected_minutes,
        price_cents, currency, published_at,
        ( select min(s."position") from steps s
            where s.experience_id = e.id and s.is_paywall ) as paywall_position,
        neighborhood, theme, distance_m,
        ( select count(*) from steps s
            where s.experience_id = e.id and s.type = 'arrival'::step_type ) as stops_count,
        card_image_path
   from experiences e
  where status = 'published'::experience_status;

notify pgrst, 'reload schema';
