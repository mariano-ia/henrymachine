-- 0005: edición en vivo + ABM de pasos [decisión de producto 2026-07-09]
-- 1) Las experiencias publicadas se editan en vivo: se reemplaza la inmutabilidad
--    dura de steps por una validación DIFERIDA que re-asegura los invariantes de
--    publicación al commit de cualquier transacción que toque pasos publicados.
-- 2) set_experience_pricing: se recrea (no existía en la DB → "Guardar precio"
--    fallaba) y ahora funciona sobre publicadas + recibe stripe_price_id creado
--    antes (para no violar exp_paid_needs_price en publicadas).
-- 3) admin_add_step / admin_delete_step: alta y baja posicional de pasos.

-- ---------------------------------------------------------------------------
-- 1) fuera la inmutabilidad dura
drop trigger if exists trg_steps_immutable on steps;
drop function if exists guard_steps_immutable();

-- red de seguridad: si la experiencia está publicada, sus invariantes de
-- publicación deben sostenerse al final de cualquier tx que toque sus pasos.
create or replace function assert_steps_published_valid() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  exp uuid := coalesce(new.experience_id, old.experience_id);
  st  experience_status;
begin
  select status into st from experiences where id = exp;
  if st = 'published' then
    perform assert_publishable(exp);
  end if;
  return null;
end $$;

create constraint trigger trg_steps_published_valid
  after insert or update or delete on steps
  deferrable initially deferred
  for each row execute function assert_steps_published_valid();

-- ---------------------------------------------------------------------------
-- 2) pricing atómico, también sobre publicadas
drop function if exists set_experience_pricing(uuid, int, int, text);

create or replace function set_experience_pricing(
  p_exp uuid, p_price_cents int, p_paywall_after int, p_message text,
  p_stripe_price_id text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare st experience_status;
begin
  select status into st from experiences where id = p_exp;
  if st is null then raise exception 'experiencia inexistente'; end if;
  if not is_experience_author(p_exp) then raise exception 'no autorizado'; end if;

  set constraints steps_experience_position_key deferred;

  delete from steps where experience_id = p_exp and is_paywall;
  with ord as (select id, row_number() over (order by position) as rn
               from steps where experience_id = p_exp)
  update steps s set position = o.rn from ord o where s.id = o.id;

  if coalesce(p_price_cents, 0) <= 0 then
    update experiences set price_cents = 0, stripe_price_id = null where id = p_exp;
    return;
  end if;

  -- en publicadas, precio pago exige stripe_price_id en el MISMO update
  -- (constraint exp_paid_needs_price); el precio de Stripe se crea antes, afuera.
  update experiences
     set price_cents = p_price_cents,
         stripe_price_id = coalesce(p_stripe_price_id, stripe_price_id)
   where id = p_exp;

  if p_paywall_after is not null and p_paywall_after >= 1 then
    update steps set position = position + 1
      where experience_id = p_exp and position > p_paywall_after;
    insert into steps (experience_id, position, type, is_paywall, title, paywall_message)
      values (p_exp, p_paywall_after + 1, 'paywall', true, 'Paywall',
              coalesce(p_message, 'Seguí el recorrido completo'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) ABM de pasos
create or replace function admin_add_step(
  p_exp uuid, p_after int, p_type step_type
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_after int;
  v_count int;
  new_id  uuid;
begin
  if not is_experience_author(p_exp) then raise exception 'no autorizado'; end if;
  if p_type not in ('message','arrival') then
    raise exception 'solo se agregan pasos message o arrival (el paywall se maneja desde Monetización)';
  end if;

  select count(*) into v_count from steps where experience_id = p_exp;
  v_after := least(greatest(coalesce(p_after, v_count), 0), v_count);

  set constraints steps_experience_position_key deferred;
  update steps set position = position + 1
    where experience_id = p_exp and position > v_after;
  insert into steps (experience_id, position, type, title, place_query)
    values (p_exp, v_after + 1, p_type,
            case when p_type = 'arrival' then 'Nueva parada' else 'Mensaje' end,
            case when p_type = 'arrival' then '' else null end)
    returning id into new_id;
  return new_id;
end $$;

create or replace function admin_delete_step(p_step uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_exp     uuid;
  v_paywall boolean;
begin
  select experience_id, is_paywall into v_exp, v_paywall from steps where id = p_step;
  if v_exp is null then raise exception 'paso inexistente'; end if;
  if not is_experience_author(v_exp) then raise exception 'no autorizado'; end if;
  if v_paywall then
    raise exception 'el paywall se maneja desde Monetización (precio 0 lo quita)';
  end if;

  set constraints steps_experience_position_key deferred;
  delete from steps where id = p_step;
  with ord as (select id, row_number() over (order by position) as rn
               from steps where experience_id = v_exp)
  update steps s set position = o.rn from ord o where s.id = o.id;
end $$;

notify pgrst, 'reload schema';
