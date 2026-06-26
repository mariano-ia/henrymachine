-- RPC: fija precio + coloca/quita el paso paywall (posicional, atómico). [Fase 4]
create or replace function set_experience_pricing(
  p_exp uuid, p_price_cents int, p_paywall_after int, p_message text
) returns void
language plpgsql security definer set search_path = public as $$
declare st experience_status;
begin
  select status into st from experiences where id = p_exp;
  if st is null then raise exception 'experiencia inexistente'; end if;
  if not is_experience_author(p_exp) then raise exception 'no autorizado'; end if;
  if st = 'published' then raise exception 'despublica para cambiar precio/paywall'; end if;
  delete from steps where experience_id = p_exp and is_paywall;
  with ord as (select id, row_number() over (order by position) as rn
               from steps where experience_id = p_exp)
  update steps s set position = o.rn from ord o where s.id = o.id;
  if coalesce(p_price_cents, 0) <= 0 then
    update experiences set price_cents = 0, stripe_price_id = null where id = p_exp;
    return;
  end if;
  update experiences set price_cents = p_price_cents where id = p_exp;
  if p_paywall_after is not null and p_paywall_after >= 1 then
    update steps set position = position + 1
      where experience_id = p_exp and position > p_paywall_after;
    insert into steps (experience_id, position, type, is_paywall, title, paywall_message)
      values (p_exp, p_paywall_after + 1, 'paywall', true, 'Paywall',
              coalesce(p_message, 'Segui el recorrido completo'));
  end if;
end $$;
