-- ============================================================================
-- 166 — CRÍTICO: `registrar_checada` es llamable desde el navegador, y eso salta la geocerca
-- y el reconocimiento facial.
--
-- El comentario de `api/checar.js` dice, literalmente: «Es el ÚNICO camino: la RPC ya no la
-- puede llamar el navegador». Esa frase es FALSA en producción desde la migración 136.
--
-- POR QUÉ IMPORTA TANTO. Los dos candados del fichaje NO viven dentro de la RPC: viven en
-- `api/checar.js`, que los aplica ANTES de llamarla. La geocerca se evalúa allí, y el cotejo
-- facial —dos inferencias, bloqueante— también. La RPC solo pone la hora y las reglas de turno.
-- O sea que quien la llama directamente se salta los dos controles de golpe: puede fichar desde
-- su casa, a la hora que quiera, sin que ninguna cámara lo mire.
--
-- REPRODUCIDO, no deducido (2026-09-17, contra la base real y con ROLLBACK): poniendo el rol
-- `authenticated` y un `request.jwt.claims` con el `sub` de un empleado real, la llamada
-- CREA LA CHECADA. No falla por permisos.
--
-- CÓMO LLEGÓ AQUÍ, y es la MISMA lección que la migración 164 de hoy: las migraciones 045, 063
-- y 067 revocaban correctamente el permiso. La 136 hizo `drop function` para cambiar la firma
-- —y **DROP DESTRUYE LA ACL**—; al recrearla, las default privileges de Supabase le devolvieron
-- EXECUTE a `anon` y `authenticated`. Nadie lo decidió: se perdió una revocación.
--
--   `drop view` borró los grants de usuarios_directorio  -> migración 164 (esta mañana)
--   `drop function` borró los de registrar_checada       -> esta
--
-- La regla, por tercera vez y ahora escrita donde se va a leer: **si una migración hace DROP de
-- algo, tiene que volver a poner sus REVOKE, no solo sus GRANT.**
-- ============================================================================

begin;

-- Se revoca a PUBLIC además de a los dos roles: la ACL real en producción mostraba `=X/postgres`,
-- que es PUBLIC con EXECUTE. Revocar solo a anon y authenticated dejaría esa puerta abierta.
revoke all on function public.registrar_checada(
  uuid, public.tipo_checada, numeric, numeric, integer, text, text, boolean
) from public, anon, authenticated;

-- El único que debe poder llamarla es el servidor, que es quien ya comprobó geocerca y cara.
grant execute on function public.registrar_checada(
  uuid, public.tipo_checada, numeric, numeric, integer, text, text, boolean
) to service_role;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--
--   1) select proacl from pg_proc where proname = 'registrar_checada';
--      -> NO debe aparecer `anon` ni `authenticated`, ni un `=X/` suelto (que es PUBLIC).
--         Solo postgres y service_role.
--
--   2) El intento que hoy SÍ funciona debe dejar de funcionar:
--        begin;
--        set local role authenticated;
--        select set_config('request.jwt.claims',
--               json_build_object('sub','<auth_user_id de un empleado>','role','authenticated')::text, true);
--        select public.registrar_checada('<usuario_id>', 'entrada');
--        -- ANTES: crea la checada.  DESPUÉS: debe fallar con "permission denied for function".
--        rollback;
--
--   3) EL FICHAJE NORMAL TIENE QUE SEGUIR FUNCIONANDO — es lo que hay que mirar antes de
--      irse a dormir: `api/checar.js` usa la clave de service_role (ver api/_auth.js admin()),
--      así que no le afecta. Comprobarlo fichando de verdad desde la PWA después de aplicar.
--
--   4) Ojo con RH registrando checadas a mano: si esa pantalla llama a la RPC desde el
--      navegador en vez de pasar por el servidor, este revoke la rompería. Verificado antes de
--      escribir esto: el único uso de `registrar_checada` fuera de la base es api/checar.js.
--
-- ROLLBACK (solo si algo legítimo dependía de llamarla desde el cliente, que no debería):
--   grant execute on function public.registrar_checada(
--     uuid, public.tipo_checada, numeric, numeric, integer, text, text, boolean
--   ) to authenticated;
-- ----------------------------------------------------------------------------
