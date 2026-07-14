-- 0015: códigos de login propios (OTP de 6 dígitos por email).
-- El código lo generamos y mandamos nosotros (Resend/Henry); Supabase no manda
-- ningún email. Al verificar, se crea la sesión con admin.generateLink.
create table if not exists login_codes (
  email citext primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table login_codes enable row level security;
-- sin policies: solo service role (las rutas /api/auth/*)

notify pgrst, 'reload schema';
