-- 0007: tip de Henry editable (frase manuscrita del detalle público).
-- PENDIENTE DE APLICAR: el código ya lo soporta y tolera que la columna
-- no exista (guarda el resto y avisa). Aplicar cuando haya conexión a la DB.
alter table experiences add column if not exists henry_tip text;

notify pgrst, 'reload schema';
