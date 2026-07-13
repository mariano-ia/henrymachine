-- 0006: endurecimiento post-revisión de 0005
-- a) assert_publishable: el paywall debe dejar al menos un paso detrás
--    (cierra el "regalo total": paywall al final ⇒ todo el contenido gratis).
-- b) set_experience_pricing: stripe_price_id OBLIGATORIO con precio pago (evita
--    divergencia precio mostrado ↔ cobrado) + p_paywall_after acotado a [1, n-1].
-- c) assert_steps_published_valid: valida origen Y destino si un paso cambia de
--    experiencia + FOR SHARE del status (cierra write-skew con publicar).

create or replace function assert_publishable(exp uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  n_steps int;
  max_pos int;
  pw_pos  int;
  price   int;
  bad_arrival int;
begin
  select count(*), max(position) into n_steps, max_pos from steps where experience_id = exp;
  if n_steps = 0 then raise exception 'No se puede publicar sin pasos'; end if;

  select price_cents into price from experiences where id = exp;
  select min(position) into pw_pos from steps where experience_id = exp and is_paywall;

  if price > 0 and pw_pos is null then
    raise exception 'Experiencia paga sin paso paywall: se regalaria entera';
  end if;
  if price = 0 and pw_pos is not null then
    raise exception 'Experiencia gratis con paywall: estado invalido';
  end if;
  -- el paywall tiene que dejar contenido detrás; si no, se regala todo igual.
  if pw_pos is not null and pw_pos >= max_pos then
    raise exception 'El paywall no puede ser el ultimo paso: no quedaria contenido para vender';
  end if;

  select count(*) into bad_arrival from steps
    where experience_id = exp and type = 'arrival'
      and (place_query is null and address is null and (lat is null or lng is null));
  if bad_arrival > 0 then
    raise exception 'Hay % paso(s) arrival sin direccion/lugar verificado', bad_arrival;
  end if;
end $$;

create or replace function set_experience_pricing(
  p_exp uuid, p_price_cents int, p_paywall_after int, p_message text,
  p_stripe_price_id text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  st experience_status;
  n_content int;
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

  -- precio pago SIEMPRE con su price de Stripe recién creado: nunca divergen
  -- el precio mostrado (price_cents) y el cobrado (stripe_price_id).
  if p_stripe_price_id is null then
    raise exception 'falta stripe_price_id para un precio pago';
  end if;

  select count(*) into n_content from steps where experience_id = p_exp;
  if n_content < 2 then
    raise exception 'Se necesitan al menos 2 pasos para poner un paywall';
  end if;
  if p_paywall_after is null or p_paywall_after < 1 or p_paywall_after >= n_content then
    raise exception 'El paywall debe ir despues de un paso entre 1 y % (tiene que quedar contenido para vender)', n_content - 1;
  end if;

  update experiences
     set price_cents = p_price_cents, stripe_price_id = p_stripe_price_id
   where id = p_exp;

  update steps set position = position + 1
    where experience_id = p_exp and position > p_paywall_after;
  insert into steps (experience_id, position, type, is_paywall, title, paywall_message)
    values (p_exp, p_paywall_after + 1, 'paywall', true, 'Paywall',
            coalesce(p_message, 'Seguí el recorrido completo'));
end $$;

create or replace function assert_steps_published_valid() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new uuid;
  v_old uuid;
  st    experience_status;
begin
  if tg_op in ('INSERT','UPDATE') then v_new := new.experience_id; end if;
  if tg_op in ('DELETE','UPDATE') then v_old := old.experience_id; end if;

  -- FOR SHARE: serializa contra un publish concurrente (write-skew)
  if v_new is not null then
    select status into st from experiences where id = v_new for share;
    if st = 'published' then perform assert_publishable(v_new); end if;
  end if;
  -- si el paso se movió de experiencia, la de ORIGEN también debe seguir válida
  if v_old is not null and v_old is distinct from v_new then
    select status into st from experiences where id = v_old for share;
    if st = 'published' then perform assert_publishable(v_old); end if;
  end if;
  return null;
end $$;

notify pgrst, 'reload schema';
