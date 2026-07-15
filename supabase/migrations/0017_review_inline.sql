-- Pedido de reseña INLINE: se puede anclar a una parada (arrival) puntual, en vez
-- de esperar al final del recorrido (donde muchos ya se bajaron).
-- El admin marca la parada con un toggle y edita el mensaje que dice Henry.

alter table steps add column if not exists ask_review boolean not null default false;
alter table steps add column if not exists review_message text;
