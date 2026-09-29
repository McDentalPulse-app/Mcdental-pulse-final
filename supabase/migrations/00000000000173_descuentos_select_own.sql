-- ============================================================================
-- 173 — Cada empleado puede ver SUS PROPIOS descuentos.
--
-- NÚMERO CAMBIADO AL GUARDARLA EN EL REPO (2026-09-29). Se escribió y se aplicó en producción
-- como la 171 (hacia el 2026-09-21, desde la sesión de la app nativa), pero nunca se commiteó, y
-- mientras tanto prod/main usó 171 y 172 para otras dos. No hay registro de migraciones
-- aplicadas, así que el número solo ordena el repo. Que este SQL sea EXACTAMENTE el que corre en
-- producción se comprueba contra la base (pg_get_functiondef) antes de dar nada por bueno.
--
-- Hasta hoy `descuentos` solo la leían admin, RH y psicóloga (política
-- `descuentos_select_admin_rh_psicologa`, migraciones 016 y 028). Un empleado preguntando por
-- los suyos no recibía un error: recibía CERO FILAS. Eso es peor que un error, porque una app
-- que pregunta de buena fe concluye "no tienes descuentos" y tranquiliza a quien sí los tiene.
--
-- LA DECISIÓN (del dueño, 2026-09-21): que cada quien vea cuánto le van a descontar antes del
-- pago, para que no se entere el día de la raya. Es la misma lógica que ya se aplica a
-- `permisos` y `vacaciones`, que tienen su `..._select_own` desde la 016.
--
-- QUÉ ABRE Y QUÉ NO:
--   · Abre SELECT de las filas propias (`empleado_id = current_usuario_id()`). Nada más.
--   · NO toca INSERT, UPDATE ni DELETE: quien pone y quita descuentos sigue siendo RH. Un
--     empleado no puede borrarse un descuento ni cambiarle el monto.
--   · NO abre las filas de nadie más: la política filtra por su propio id, igual que permisos.
--   · La columna `responsable_nombre` queda técnicamente legible para el dueño de la fila. Si
--     no se quiere que sepa QUIÉN lo reportó, hay que quitarla de la consulta del cliente (la
--     app nativa no la pide) o mover ese dato a otra tabla; una política de RLS filtra filas,
--     no columnas.
-- ============================================================================

begin;

drop policy if exists descuentos_select_own on public.descuentos;
create policy descuentos_select_own
  on public.descuentos for select
  using (empleado_id = (select public.current_usuario_id()));

comment on table public.descuentos is
  'Descuentos de nómina. Lectura: admin/RH/psicóloga ven todo; cada empleado ve SOLO los suyos (migración 173). Escritura: solo RH.';

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (con el JWT de un empleado normal, no service_role):
--   select count(*) from public.descuentos;
--     -> solo sus filas; comparar contra el conteo real de ese empleado_id hecho con
--        service_role. Tienen que coincidir.
--   select count(*) from public.descuentos where empleado_id <> public.current_usuario_id();
--     -> 0
--   update public.descuentos set monto = 0 where empleado_id = public.current_usuario_id();
--     -> 0 filas afectadas (no hay política de update para el empleado)
--
-- ROLLBACK:
--   drop policy if exists descuentos_select_own on public.descuentos;
-- ----------------------------------------------------------------------------
