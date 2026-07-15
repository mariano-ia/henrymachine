-- 0019: ventana de progreso a 7 días + helper para saber si un entitlement fue "empezado".

-- Progreso: la ventana de reanudación pasa de 24h a 7 días (168h). Aplica a
-- experiencias existentes y nuevas.
alter table experiences alter column resume_window_hours set default 168;
update experiences set resume_window_hours = 168 where resume_window_hours = 24;

-- "Empezado" = existe una play_session con progreso real (EN_CURSO o TERMINADO)
-- para ese dueño (anon o user) y experiencia. Se usa para el vencimiento de 90
-- días de compras NO empezadas y para el job recordatorio.
create or replace function entitlement_started(
  p_experience_id uuid, p_anon_id text, p_user_id uuid, p_grant_email text
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from play_sessions s
    where s.experience_id = p_experience_id
      and s.status in ('EN_CURSO','TERMINADO')
      and (
        (p_anon_id is not null and s.anon_id = p_anon_id)
        or (p_user_id is not null and s.user_id = p_user_id)
      )
  );
$$;

-- Índice para el job recordatorio: entitlements de compra sin revocar por fecha.
create index if not exists entitlements_created_active_idx
  on entitlements (created_at) where revoked_at is null and source = 'purchase';
