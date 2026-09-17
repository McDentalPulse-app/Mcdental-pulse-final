-- ============================================================================
-- 164 — CRÍTICO: `usuarios_directorio` es escribible por cualquier autenticado, y como
-- la vista se salta la RLS, eso es escribir y BORRAR filas de public.usuarios.
--
-- ESTO NO LO INTRODUJO NINGÚN CAMBIO RECIENTE: está vivo en producción desde la migración
-- 030 y la 153 lo dejó escrito negro sobre blanco. Lo encontró la revisión de seguridad de
-- los datos bancarios (migración 163) al rastrear por dónde se podía leer una CLABE ajena.
-- La fuga de lectura no existe; esta otra puerta sí.
--
-- POR QUÉ ES GRAVE, en tres pasos que hay que leer juntos:
--
--   1. La vista se creó SIN `security_invoker`, cuyo default en PostgreSQL es `false`. O sea
--      que corre con los permisos de su DUEÑO, y el dueño es `postgres` (se fija
--      explícitamente en la 030 y en la 153).
--   2. `public.usuarios` tiene RLS pero NO tiene `force row level security`, y el dueño de
--      una tabla se salta su propia RLS. Esto era DELIBERADO y correcto para LEER: es el
--      mecanismo que permite a un empleado ver el directorio sin darle acceso a la tabla.
--   3. Pero la 153 concede a `authenticated` las siete acciones sobre la vista:
--        grant insert, select, update, delete, truncate, references, trigger
--          on public.usuarios_directorio to authenticated;
--      y su propio comentario dice que se copiaron «EXACTOS de la base real», o sea que no
--      es un desliz del archivo: es el estado de producción. Como la vista es una proyección
--      simple de una sola tabla, PostgreSQL la considera AUTO-ACTUALIZABLE y propaga el
--      insert/update/delete a `public.usuarios`.
--
-- CONSECUENCIA PRÁCTICA. Cualquier persona con una sesión válida —el rol más bajo de la
-- app— podía ejecutar contra PostgREST:
--
--      delete from usuarios_directorio where id = '<un compañero>';
--
-- y borrarlo de verdad. Reproducido EJECUTÁNDOLO (PGlite con 155 migraciones, rol
-- `authenticated` y el auth.uid() de un empleado raso): la llamada devuelve la fila ajena.
-- No es lectura del SQL ni sospecha.
--
-- Borrar a alguien no es quitarlo de una lista: `usuarios` tiene `on delete cascade` desde
-- **31 tablas hijas**, entre ellas `notas_psicologicas` y `reportes_confidenciales`. Es
-- irreversible y no deja a quién reclamarle.
--
-- Y un detalle que lo hace peor de lo que parece: NO toca `auth.users`. La persona conserva
-- su login y se queda sin expediente — entra a la app y no existe, en vez de recibir un
-- «tu cuenta fue eliminada» que alguien pudiera investigar.
--
-- Por UPDATE quedaban expuestas las columnas de la vista sobre filas AJENAS: `name`,
-- `sucursal`, `puesto`, `avatar_url` e `inactivo` — poner `inactivo = true` a un compañero
-- lo deja fuera de la app. `role` NO estaba expuesto, porque el trigger
-- prevent_usuario_privilege_escalation sí se dispara (los triggers corren aunque la RLS se
-- salte) y bloquea el cambio de rol a quien no es gestión; lo mismo `jefe_id`/`area_id` por
-- la guarda del organigrama. Pero ningún trigger cubre DELETE.
--
-- EL ARREGLO ES QUITAR LA ESCRITURA, NO LA VISTA. El SELECT definer sigue siendo el diseño
-- correcto y se conserva intacto: es lo que da el directorio sin PII a la plantilla. Lo que
-- se retira es lo que nadie usa. Verificado antes de escribir esto: el único acceso a la
-- vista en todo el repo es `supabase.from("usuarios_directorio").select("*")` en
-- src/services/supabase/usuariosService.js — no hay ni un insert, update ni delete, ni en
-- el cliente, ni en api/, ni en supabase/functions/. Revocar no rompe nada.
--
-- El borrado legítimo de personas NO pasa por aquí y no se toca: vive en la edge function
-- admin-delete-usuario, que autentica al llamante, exige rol admin/admin_plus, impide
-- borrarse a uno mismo y reserva a admin_plus el borrado de cuentas admin. Esa puerta está
-- bien cerrada; esta estaba abierta al lado.
-- ============================================================================

begin;

-- ANON: revocación TOTAL, y no es precaución de más. La migración 030 había hecho
-- `revoke all ... from anon`, pero la 153 empieza con `drop view if exists` y **al borrar la
-- vista se borraron también sus grants**; la 153 solo volvió a conceder a postgres,
-- service_role y authenticated, así que lo que anon tenga hoy depende de las default
-- privileges de Supabase, no de ninguna decisión escrita. Si anon quedó con escritura, esto
-- se puede hacer SIN SESIÓN, con la clave anónima que viaja en el bundle. No se deja al azar.
revoke all on public.usuarios_directorio from anon;

-- AUTHENTICATED: se quita todo salvo el select. También `references` y `trigger`: no
-- escriben datos por sí mismos, pero `trigger` permite colgar un INSTEAD OF de la vista, y
-- no hay ni un motivo para que la plantilla los tenga. Nada del repo los usa.
revoke insert, update, delete, truncate, references, trigger
  on public.usuarios_directorio from authenticated;

-- Se CONSERVA el select, que es para lo que existe la vista.
grant select on public.usuarios_directorio to authenticated;

comment on view public.usuarios_directorio is
  'Subconjunto no sensible de public.usuarios, legible por cualquier autenticado. '
  'SOLO LECTURA para anon y authenticated (mig. 164): la vista es security definer y la '
  'tabla base no tiene force row level security, así que conceder escritura aquí equivale a '
  'saltarse la RLS de public.usuarios.';

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (como un empleado autenticado, tras aplicar):
--
--   1) select count(*) from public.usuarios_directorio;
--      -> SIGUE FUNCIONANDO. Si esto falla, se rompió el directorio de toda la plantilla.
--
--   2) delete from public.usuarios_directorio where id = '<un compañero>';
--      -> DEBE FALLAR: "permission denied for view usuarios_directorio".
--         ANTES de esta migración esto BORRABA a la persona.
--
--   3) update public.usuarios_directorio set inactivo = true where id = '<un compañero>';
--      -> DEBE FALLAR con el mismo permission denied.
--
--   4) insert into public.usuarios_directorio (id, name) values (...);
--      -> DEBE FALLAR.
--
--   5) Como admin, que la app siga entera: Gestión de Personal lista, edita y archiva igual
--      (eso va por public.usuarios, no por la vista), y el borrado definitivo sigue
--      funcionando por la edge function admin-delete-usuario.
--
--   6) select grantee, privilege_type from information_schema.role_table_grants
--       where table_name = 'usuarios_directorio' order by grantee, privilege_type;
--      -> authenticated debe quedar SOLO con SELECT. anon no debe aparecer.
--
--   ANTES DE APLICAR, conviene correr esa misma consulta 6 sobre la base REAL: si `anon`
--   aparece hoy con INSERT/UPDATE/DELETE, el agujero era explotable SIN SESIÓN —con la clave
--   anónima que va en el bundle— y eso sube el hallazgo de HIGH a CRÍTICO. Cambia la urgencia
--   del despliegue, no el contenido de esta migración.
--
-- ROLLBACK (solo si algo dependía de escribir en la vista, que no debería):
--   grant insert, update, delete, truncate on public.usuarios_directorio to authenticated;
-- ----------------------------------------------------------------------------
