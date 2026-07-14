-- 0010: identidad — consent de marketing, país en sesiones, tokens por turno.
-- Ajustado al shape REAL de la DB (session_messages ya existe; enums en español).

alter table purchases add column if not exists marketing_consent boolean;
alter table play_sessions add column if not exists country text;

-- session_messages ya existe: solo sumamos el costo por turno.
alter table session_messages add column if not exists prompt_tokens int;
alter table session_messages add column if not exists output_tokens int;

-- una sesión EN_CURSO por persona+experiencia (anon)
create unique index if not exists play_sessions_active_anon_uq
  on play_sessions (experience_id, anon_id)
  where anon_id is not null and status = 'EN_CURSO';

notify pgrst, 'reload schema';
