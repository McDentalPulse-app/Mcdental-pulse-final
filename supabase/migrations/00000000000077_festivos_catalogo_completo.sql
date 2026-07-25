-- ============================================================================
-- Catálogo COMPLETO de días festivos y conmemoraciones de México (2026 y 2027).
--
-- Amplía lo sembrado en 075/076 con el resto de fechas cívicas y populares que aparecen en un
-- calendario mexicano. Se mantiene la distinción de naturaleza (y por tanto de COLOR en la app):
--   - tipo 'oficial'/'empresa'  → NO se trabaja (se resaltan en rojo, celda completa).
--   - tipo 'conmemorativo'      → SÍ se trabaja (chip verde). La gran mayoría de estas fechas.
--
-- Nota: el índice único es por `fecha`, así que si un conmemorativo cae el mismo día que un
-- descanso obligatorio (p. ej. Candelaria 2-feb coincide con el descanso de la Constitución en
-- 2026), `on conflict do nothing` conserva el oficial y omite el conmemorativo ese año.
-- ============================================================================

-- Corrección: Día del Trabajo 2027 es el 1 de mayo (fijo por LFT art. 74); la fuente externa lo
-- había puesto el 30-abr. Se recoloca antes de insertar (así el 30-abr queda libre para el Día
-- del Niño). Si la fila no existe (BD fresca), no afecta a nadie.
update public.festivos set fecha = '2027-05-01'
 where fecha = '2027-04-30' and nombre = 'Día del Trabajo';

insert into public.festivos (fecha, nombre, tipo) values
  -- ---- 2026: conmemorativos adicionales ----
  ('2026-02-02', 'Día de la Candelaria', 'conmemorativo'),
  ('2026-02-14', 'Día del Amor y la Amistad', 'conmemorativo'),
  ('2026-03-08', 'Día Internacional de la Mujer', 'conmemorativo'),
  ('2026-03-18', 'Aniversario de la Expropiación Petrolera', 'conmemorativo'),
  ('2026-04-30', 'Día del Niño', 'conmemorativo'),
  ('2026-05-23', 'Día del Estudiante', 'conmemorativo'),
  ('2026-06-01', 'Día de la Marina', 'conmemorativo'),
  ('2026-06-21', 'Día del Padre', 'conmemorativo'),
  ('2026-08-28', 'Día del Abuelo', 'conmemorativo'),
  ('2026-09-15', 'Grito de Independencia', 'conmemorativo'),
  ('2026-10-12', 'Día de la Raza', 'conmemorativo'),
  ('2026-11-01', 'Día de Todos los Santos', 'conmemorativo'),
  ('2026-11-20', 'Aniversario de la Revolución', 'conmemorativo'),
  ('2026-12-28', 'Día de los Santos Inocentes', 'conmemorativo'),

  -- ---- 2027: conmemorativos adicionales ----
  ('2027-02-02', 'Día de la Candelaria', 'conmemorativo'),
  ('2027-02-14', 'Día del Amor y la Amistad', 'conmemorativo'),
  ('2027-03-08', 'Día Internacional de la Mujer', 'conmemorativo'),
  ('2027-03-18', 'Aniversario de la Expropiación Petrolera', 'conmemorativo'),
  ('2027-04-30', 'Día del Niño', 'conmemorativo'),
  ('2027-05-23', 'Día del Estudiante', 'conmemorativo'),
  ('2027-06-01', 'Día de la Marina', 'conmemorativo'),
  ('2027-06-20', 'Día del Padre', 'conmemorativo'),
  ('2027-08-28', 'Día del Abuelo', 'conmemorativo'),
  ('2027-09-15', 'Grito de Independencia', 'conmemorativo'),
  ('2027-10-12', 'Día de la Raza', 'conmemorativo'),
  ('2027-11-01', 'Día de Todos los Santos', 'conmemorativo'),
  ('2027-11-20', 'Aniversario de la Revolución', 'conmemorativo'),
  ('2027-12-28', 'Día de los Santos Inocentes', 'conmemorativo')
on conflict (fecha) do nothing;
