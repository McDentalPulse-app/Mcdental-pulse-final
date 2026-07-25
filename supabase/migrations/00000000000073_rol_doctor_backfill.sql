-- ============================================================================
-- Rol 'doctor' (parte 2/2): mover a los dentistas y darles paridad con 'empleado'.
--
-- 1) Backfill: todos los usuarios cuyo `puesto` empieza con "Doctor" (cubre Doctora, Doctor,
--    Doctora/Especialista, Doctora/Encargada) pasan a role='doctor'.
--
--    Ojo: el trigger trg_usuarios_prevent_privilege_escalation (mig 023/027) impide cambiar
--    `role` a cualquier caller que no sea 'admin'. En una migración no hay auth.uid(), así que
--    current_role() es NULL (≠ 'admin') y el trigger ABORTARÍA este UPDATE. Se deshabilita el
--    trigger solo durante el backfill y se reactiva enseguida.
--
-- 2) Paridad de permisos: 3 policies (definición vigente en mig 028) gatean por
--    current_role() in ('admin','psicologa','empleado') y, sin tocarlas, dejarían al doctor sin
--    poder responder su encuesta ni usar mensajería. Se les agrega 'doctor'. El resto del RLS va
--    por propiedad (empleado_id = current_usuario_id()), que ya cubre al doctor sin cambios.
-- ============================================================================

-- 1) Backfill del rol -------------------------------------------------------
alter table public.usuarios disable trigger trg_usuarios_prevent_privilege_escalation;

update public.usuarios
   set role = 'doctor'
 where puesto ilike 'doctor%'
   and role = 'empleado';

alter table public.usuarios enable trigger trg_usuarios_prevent_privilege_escalation;

-- 2) Paridad en las 3 policies gateadas por rol -----------------------------

-- Encuestas: el doctor debe poder responder SU propia encuesta.
drop policy if exists encuestas_insert_own on public.encuestas;
create policy encuestas_insert_own
  on public.encuestas for insert
  with check (
    empleado_id = (select public.current_usuario_id())
    and (select public.current_role()) in ('admin', 'psicologa', 'empleado', 'doctor')
  );

-- Mensajes: el doctor debe ver los suyos…
drop policy if exists mensajes_select_participant on public.mensajes;
create policy mensajes_select_participant
  on public.mensajes for select
  using (
    (select public.current_role()) in ('admin', 'psicologa', 'empleado', 'doctor')
    and (
      de_id = (select public.current_usuario_id())
      or para_id = (select public.current_usuario_id())
    )
  );

-- …y poder enviarlos como remitente.
drop policy if exists mensajes_insert_as_sender on public.mensajes;
create policy mensajes_insert_as_sender
  on public.mensajes for insert
  with check (
    (select public.current_role()) in ('admin', 'psicologa', 'empleado', 'doctor')
    and de_id = (select public.current_usuario_id())
  );

-- ----------------------------------------------------------------------------
-- Verificación manual tras aplicar:
--   select role, count(*) from public.usuarios group by role;  -- doctor ~54, empleado ~45
--   select count(*) from public.usuarios where puesto ilike 'doctor%' and role <> 'doctor'; -- 0
-- ----------------------------------------------------------------------------
