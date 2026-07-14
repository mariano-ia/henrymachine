-- 0008: Guía útil global (utility intents) + imagen cuadrada de card.
-- PENDIENTE DE APLICAR: correr en el SQL editor del dashboard (el código
-- degrada con gracia mientras no exista).

-- Guía útil: base de conocimiento GLOBAL (baños, agua, transporte, wifi,
-- plata, emergencias, consejos) editable en el admin e inyectada en el
-- prompt de TODAS las experiencias.
create table if not exists utilities (
  id uuid primary key default gen_random_uuid(),
  category text not null,           -- Baños | Agua | Transporte | WiFi y carga | Plata | Emergencias | Consejos
  name text not null,               -- "Bryant Park", "OMNY", ...
  neighborhood text,                -- zona para matchear con la parada actual (null = general)
  address text,
  place_query text,                 -- para el deep-link de Maps del chat
  hours text,                       -- horario simple; luego se automatiza con Places
  is_free boolean not null default true,
  henry_note text,                  -- el consejo en la voz de Henry
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table utilities enable row level security;
create policy "utilities_admin_all" on utilities for all to authenticated
  using (is_admin()) with check (is_admin());
-- (el runtime del chat lee con service_role; no hay lectura anónima)

create trigger trg_utilities_updated before update on utilities
  for each row execute function set_updated_at();

-- Semillas editables (borrá/edita desde el admin lo que no te guste):
insert into utilities (category, name, neighborhood, address, place_query, hours, is_free, henry_note, position) values
  ('Baños', 'Bryant Park', 'Midtown', 'Bryant Park, entre 5th y 6th Ave', 'Bryant Park restroom', 'Todos los días 7:00–22:00 aprox.', true, 'El baño público más famoso y limpio de la ciudad, hasta con flores. Si estás por Midtown, ve directo ahí.', 1),
  ('Baños', 'Cafés y bibliotecas (truco general)', null, null, null, null, true, 'Starbucks, McDonald''s o cualquier biblioteca pública: entra con confianza, pide el código con una sonrisa y listo. Comprar algo chico ayuda.', 2),
  ('Agua', 'Fuentes de parques y delis', null, null, null, null, true, 'En los parques grandes hay fuentes para recargar botella. Y en cualquier deli el agua cuesta la mitad que en los carritos de turistas.', 1),
  ('Transporte', 'OMNY — pagar el subte', null, null, null, null, false, 'No necesitas MetroCard: apoya tu tarjeta contactless o el teléfono en el lector amarillo y ya. Mismo precio, cero filas.', 1),
  ('WiFi y carga', 'Tótems LinkNYC', null, null, 'LinkNYC kiosk', null, true, 'Esos tótems altos en la vereda dan wifi gratis y tienen puerto USB para cargar el teléfono. Están por toda la ciudad.', 1),
  ('Plata', 'Propinas', null, null, null, null, true, 'En restaurantes con servicio de mesa la propina es 18–20%, no es opcional como en otros países. En cafés al paso, lo que quieras.', 1),
  ('Emergencias', 'Números y farmacias', null, null, null, null, true, 'Emergencias de verdad: 911. Para algo menor, las farmacias CVS/Duane Reade están por todos lados y muchas abren 24 h.', 1);

-- Imagen CUADRADA propia para la card de la home (distinta del cover del detalle)
alter table experiences add column if not exists card_image_path text;

notify pgrst, 'reload schema';
