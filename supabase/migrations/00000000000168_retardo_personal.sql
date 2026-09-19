-- ============================================================================
-- 164 — Tasa de retardo personalizada por empleado.
--
-- La tasa de retardo tenía dos niveles: la general de `nomina_config.monto_retardo` (igual
-- para toda la empresa) y la de becarios, fija en $50 por puesto (ver esBecario() en
-- utils/nomina.js). Apareció un tercer caso: alguien que NO es becario por puesto (Alexis
-- Alan Rafael Castañeda, Técnico de Mantenimiento) pero al que el dueño quiere cobrarle
-- retardo como becario de todos modos — un caso suelto, no una categoría.
--
-- LA DECISIÓN: en vez de hardcodear su nombre en el código (este proyecto ya tuvo eso una vez
-- con datos personales en helpers.js y se quitó por eso mismo) o mentir en su puesto poniéndole
-- "Becario" sin serlo, se agrega un monto OPCIONAL por persona. Cualquier empleado puede tener
-- su propia tasa de retardo, editable desde la pantalla de Nómina — no hace falta tocar código
-- para el siguiente caso suelto que aparezca.
--
-- PRIORIDAD (ver descuentoDelDia() en utils/nomina.js): el monto personal, si existe, gana
-- sobre todo lo demás — incluida la tasa de becario. Es la más específica de las tres.
-- ============================================================================

begin;

alter table public.usuarios
  add column if not exists monto_retardo_personal numeric(10,2);

alter table public.usuarios
  drop constraint if exists usuarios_monto_retardo_personal_no_negativo;
alter table public.usuarios
  add constraint usuarios_monto_retardo_personal_no_negativo
  check (monto_retardo_personal is null or monto_retardo_personal >= 0);

comment on column public.usuarios.monto_retardo_personal is
  'Monto fijo que le descuenta a ESTA persona un retardo, si es distinto del general de nomina_config.monto_retardo (y distinto de la tasa de becario, ver esBecario() en utils/nomina.js). NULL = usa la regla que le toque por puesto/config, que es el caso normal. Migración 164.';

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   update public.usuarios set monto_retardo_personal = -1 where username = 'alexis castan';
--     -> falla (check no_negativo)
--   update public.usuarios set monto_retardo_personal = 50 where username = 'alexis castan';
--     -> UPDATE 1
--   select monto_retardo_personal from public.usuarios where username = 'alexis castan';
--     -> 50.00
--
-- ROLLBACK:
--   alter table public.usuarios drop constraint if exists usuarios_monto_retardo_personal_no_negativo;
--   alter table public.usuarios drop column if exists monto_retardo_personal;
-- ----------------------------------------------------------------------------
