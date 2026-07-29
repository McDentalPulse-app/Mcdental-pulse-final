-- psicologa puede archivar y editar personal (cierre del pendiente de la migración 050).
--
-- La 050 dio paridad de admin a rh y psicologa en varias tablas, pero `usuarios` quedó
-- fuera: su policy de UPDATE seguía siendo ('admin','rh'). El síntoma en la app era
-- confuso — dar de baja a un empleado desde el panel de psicóloga no mostraba un error
-- de permiso, porque RLS no rechaza el UPDATE: simplemente no afecta ninguna fila.
-- El `.single()` del servicio recibía 0 filas y el toast decía "Error al cambiar el
-- estado del usuario", sin decir que era falta de permiso.
--
-- Verificado antes de este cambio (con rollback, sobre datos reales):
--   como rh        -> UPDATE 1
--   como psicologa -> UPDATE 0   <- el bug
--   como admin     -> UPDATE 1
--
-- Esto NO abre una vía de escalada de privilegios: el trigger
-- trg_usuarios_prevent_privilege_escalation sigue exigiendo rol 'admin' para tocar
-- `role` y `auth_user_id`, y actúa BEFORE UPDATE con independencia de RLS. Una psicóloga
-- puede archivar, reactivar y corregir datos de ficha, pero no puede cambiar el rol de
-- nadie ni el suyo.
--
-- La policy de INSERT no se toca a propósito: la creación de usuarios pasa por la edge
-- function admin-create-usuario, que usa service_role (bypassa RLS) y tiene su propia
-- guarda de roles.

drop policy if exists usuarios_update_admin_rh on public.usuarios;

create policy usuarios_update_gestion
  on public.usuarios for update
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
