-- ============================================================================
-- Principio de mínimo privilegio sobre public.usuarios.
--
-- La policy `usuarios_select_all_authenticated` (mig 016) concedía SELECT sobre
-- todas las columnas y todas las filas a cualquier usuario autenticado, sin
-- distinguir el rol de la aplicación. Los datos de contacto y las fechas
-- personales de la plantilla solo los necesitan los roles que gestionan
-- expedientes y altas, así que se acota el acceso a esos roles.
--
-- RLS en Postgres es ROW-level, no column-level — no se pueden ocultar columnas
-- con una policy. Se separan las dos necesidades reales:
--
--   1) Un DIRECTORIO con el subconjunto que la app necesita para pintar a un
--      compañero (nombre, foto, rol...), legible por cualquier autenticado.
--   2) La tabla base con la PII, restringida a los roles que la necesitan para
--      su trabajo: admin, rh y psicologa — más la propia fila de cada uno.
--
-- Quién necesita qué (verificado sobre las rutas de la app):
--   - GestionUsuarios (edita teléfono y fechas)      -> admin, rh
--   - ExpedienteIntegral (muestra teléfono y fechas) -> admin, psicologa
--   - EventosPersonal (cumpleaños)                   -> admin, rh  [un empleado
--     NO lo tiene enrutado: nunca ve los cumpleaños de nadie]
--   - Un empleado solo necesita, de sus compañeros: id, nombre, rol y avatar
--     (para Mensajes y para encontrar a la psicóloga).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Directorio: el subconjunto seguro, visible para cualquier autenticado.
-- ---------------------------------------------------------------------------
-- security_invoker = false (definer) A PROPÓSITO: la vista debe SALTARSE el RLS
-- de la tabla base, que a partir de aquí solo deja ver la propia fila a un
-- empleado. Es seguro porque la vista ya no expone ninguna columna sensible: es
-- justamente el mecanismo que sustituye al filtro por columnas que RLS no ofrece.
-- El linter de Supabase marcará esto como `security_definer_view`; es esperado.
drop view if exists public.usuarios_directorio;

create view public.usuarios_directorio
with (security_invoker = false) as
select
  id,
  name,
  role,
  sucursal,
  puesto,
  avatar_url,
  inactivo
from public.usuarios;

-- Fuera quedan, deliberadamente: telefono, email, fecha_nacimiento, fecha_ingreso,
-- fecha_cumpleanos, username, synthetic_email, debe_cambiar_password, auth_user_id,
-- legacy_id, password_restablecido_en, password_restablecido_por.

alter view public.usuarios_directorio owner to postgres;

revoke all on public.usuarios_directorio from anon;
grant select on public.usuarios_directorio to authenticated;

comment on view public.usuarios_directorio is
  'Subconjunto no sensible de public.usuarios, legible por cualquier autenticado. '
  'La tabla base queda restringida a admin/rh/psicologa + la fila propia. Ver migración 030.';

-- ---------------------------------------------------------------------------
-- 2) Tabla base: se cierra el SELECT abierto.
-- ---------------------------------------------------------------------------
drop policy if exists usuarios_select_all_authenticated on public.usuarios;

-- Los tres roles que manejan expedientes y altas necesitan la PII para su trabajo.
create policy usuarios_select_privilegiados
  on public.usuarios for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- Todo el mundo conserva su PROPIA fila completa: es lo que alimenta
-- AuthContext.cargarPerfil() (.eq auth_user_id) y la pantalla "Mi perfil",
-- donde cada quien ve su propio teléfono.
create policy usuarios_select_own
  on public.usuarios for select
  using (id = (select public.current_usuario_id()));

-- Se mantiene el patrón (select ...) de la migración 028: permite al planner
-- promover la llamada a InitPlan y evaluarla una vez por consulta, no por fila.

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (ejecutar autenticado como cada rol, p.ej. desde la app)
--
--   Como EMPLEADO:
--     select * from public.usuarios;             -> SOLO su propia fila
--     select * from public.usuarios_directorio;  -> todos, pero sin PII
--     -> En la app debe seguir funcionando: escribir a la psicóloga (Mensajes),
--        "Mis reconocimientos", sus vacaciones/permisos y su propio teléfono
--        en Perfil.
--
--   Como RH:      GestionUsuarios sigue mostrando y editando teléfono y fechas.
--   Como PSICOLOGA: ExpedienteIntegral sigue mostrando teléfono y fecha de ingreso.
--   Como ADMIN:   ambas pantallas, sin cambios.
--
-- ----------------------------------------------------------------------------
-- ROLLBACK (si algo se rompe, deja todo como antes de esta migración):
--
--   drop policy if exists usuarios_select_privilegiados on public.usuarios;
--   drop policy if exists usuarios_select_own on public.usuarios;
--   drop view if exists public.usuarios_directorio;
--   create policy usuarios_select_all_authenticated
--     on public.usuarios for select
--     using ((select auth.role()) = 'authenticated');
--
-- El código cliente tolera el rollback sin redeploy: getUsuariosDirectorio()
-- dejaría de existir la vista y fallaría, pero GlobalContext ya captura ese error
-- y conserva el estado previo en vez de vaciar la lista. Aun así, lo correcto es
-- revertir también el deploy.
-- ----------------------------------------------------------------------------
