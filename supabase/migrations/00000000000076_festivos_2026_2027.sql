-- ============================================================================
-- Amplía el catálogo de festivos: completa 2026, agrega 2027 y suma los días CONMEMORATIVOS.
--
-- Dos naturalezas distintas (importa para el intercambio de días):
--   - tipo 'oficial'       → NO se trabaja (descanso obligatorio LFT art. 74 + Semana Santa).
--                            Se resaltan en el calendario y son intercambiables.
--   - tipo 'conmemorativo' → SÍ se trabaja (Reyes, Día de Muertos, Guadalupe, etc.). Se muestran
--                            en el calendario como referencia, pero NO se pueden intercambiar.
--
-- Fechas oficiales tomadas de la API pública date.nager.at (incluye Semana Santa con su cálculo
-- movible: Jueves/Viernes Santo). Los conmemorativos son de fecha fija cada año.
--
-- on conflict (fecha) do nothing: no pisa los 7 oficiales de 2026 que ya sembró la mig 075.
-- ============================================================================

insert into public.festivos (fecha, nombre, tipo) values
  -- ---- 2026: completar oficiales que faltaban (Semana Santa) ----
  ('2026-04-02', 'Jueves Santo', 'oficial'),
  ('2026-04-03', 'Viernes Santo', 'oficial'),

  -- ---- 2027: oficiales (descanso obligatorio + Semana Santa) ----
  ('2027-01-01', 'Año Nuevo', 'oficial'),
  ('2027-02-01', 'Día de la Constitución', 'oficial'),
  ('2027-03-15', 'Natalicio de Benito Juárez', 'oficial'),
  ('2027-03-25', 'Jueves Santo', 'oficial'),
  ('2027-03-26', 'Viernes Santo', 'oficial'),
  ('2027-04-30', 'Día del Trabajo', 'oficial'),
  ('2027-09-16', 'Independencia de México', 'oficial'),
  ('2027-11-15', 'Revolución Mexicana', 'oficial'),
  ('2027-12-25', 'Navidad', 'oficial'),

  -- ---- 2026: conmemorativos (se trabaja) ----
  ('2026-01-06', 'Día de Reyes', 'conmemorativo'),
  ('2026-02-24', 'Día de la Bandera', 'conmemorativo'),
  ('2026-05-05', 'Batalla de Puebla', 'conmemorativo'),
  ('2026-05-10', 'Día de las Madres', 'conmemorativo'),
  ('2026-05-15', 'Día del Maestro', 'conmemorativo'),
  ('2026-11-02', 'Día de Muertos', 'conmemorativo'),
  ('2026-12-12', 'Día de la Virgen de Guadalupe', 'conmemorativo'),
  ('2026-12-24', 'Nochebuena', 'conmemorativo'),
  ('2026-12-31', 'Fin de Año', 'conmemorativo'),

  -- ---- 2027: conmemorativos (se trabaja) ----
  ('2027-01-06', 'Día de Reyes', 'conmemorativo'),
  ('2027-02-24', 'Día de la Bandera', 'conmemorativo'),
  ('2027-05-05', 'Batalla de Puebla', 'conmemorativo'),
  ('2027-05-10', 'Día de las Madres', 'conmemorativo'),
  ('2027-05-15', 'Día del Maestro', 'conmemorativo'),
  ('2027-11-02', 'Día de Muertos', 'conmemorativo'),
  ('2027-12-12', 'Día de la Virgen de Guadalupe', 'conmemorativo'),
  ('2027-12-24', 'Nochebuena', 'conmemorativo'),
  ('2027-12-31', 'Fin de Año', 'conmemorativo')
on conflict (fecha) do nothing;
