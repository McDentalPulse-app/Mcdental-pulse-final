-- El script de migración asumía legacy_id chico (ids 1-107 del roster original),
-- pero al menos un usuario tiene un id tipo Date.now() (13 dígitos) que excede
-- el rango de integer (max ~2.1 mil millones). bigint cubre cualquier legacy_id real.
alter table public.usuarios alter column legacy_id type bigint;
alter table public.encuesta_preguntas alter column legacy_id type bigint;
