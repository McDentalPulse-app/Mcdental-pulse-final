-- ============================================================================
-- Performance de RLS: envolver los helpers en un subselect (InitPlan).
--
-- Problema: las policies llaman public.current_role() / public.current_usuario_id()
-- (y auth.role()) directamente. Postgres trata esas llamadas como dependientes de
-- la fila y las RE-EVALÚA UNA VEZ POR CADA FILA escaneada. En `encuestas` o
-- `mensajes`, que crecen sin techo, eso es una llamada a función por fila en cada
-- consulta — el error de performance nº1 de RLS documentado por Supabase.
--
-- Fix: envolver la llamada en `(select ...)`. Al no depender de la fila, el planner
-- la promueve a InitPlan y la evalúa UNA SOLA VEZ por consulta, cacheando el
-- resultado. Mejoras típicas de 10-100x en tablas grandes.
--
-- Esta migración NO cambia la semántica: mismos nombres de policy, misma lógica,
-- mismos roles. Solo cambia la FORMA de la expresión. Quien podía ver algo antes,
-- sigue pudiendo; quien no, sigue sin poder.
--
-- Los helpers current_role() / current_usuario_id() (mig 015) ya son STABLE, que es
-- el requisito para que el planner pueda cachearlos así.
-- ============================================================================

-- ================= usuarios =================
drop policy if exists usuarios_select_all_authenticated on public.usuarios;
create policy usuarios_select_all_authenticated
  on public.usuarios for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists usuarios_insert_admin_rh on public.usuarios;
create policy usuarios_insert_admin_rh
  on public.usuarios for insert
  with check ((select public.current_role()) in ('admin', 'rh'));

-- Definida en la mig 023 (cierre de escalación rh->admin): using + with check simétricos.
drop policy if exists usuarios_update_admin_rh on public.usuarios;
create policy usuarios_update_admin_rh
  on public.usuarios for update
  using ((select public.current_role()) in ('admin', 'rh'))
  with check ((select public.current_role()) in ('admin', 'rh'));

-- Definida en la mig 025 (self-service de avatar). El trigger
-- prevent_usuario_privilege_escalation sigue acotando las columnas editables.
drop policy if exists usuarios_update_own on public.usuarios;
create policy usuarios_update_own
  on public.usuarios for update
  using (id = (select public.current_usuario_id()))
  with check (id = (select public.current_usuario_id()));

-- ================= encuesta_preguntas =================
drop policy if exists encuesta_preguntas_select_all on public.encuesta_preguntas;
create policy encuesta_preguntas_select_all
  on public.encuesta_preguntas for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists encuesta_preguntas_write_admin on public.encuesta_preguntas;
create policy encuesta_preguntas_write_admin
  on public.encuesta_preguntas for all
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

-- ================= encuestas =================
drop policy if exists encuestas_select_admin_psicologa on public.encuestas;
create policy encuestas_select_admin_psicologa
  on public.encuestas for select
  using ((select public.current_role()) in ('admin', 'psicologa'));

drop policy if exists encuestas_select_own on public.encuestas;
create policy encuestas_select_own
  on public.encuestas for select
  using (empleado_id = (select public.current_usuario_id()));

drop policy if exists encuestas_insert_own on public.encuestas;
create policy encuestas_insert_own
  on public.encuestas for insert
  with check (
    empleado_id = (select public.current_usuario_id())
    and (select public.current_role()) in ('admin', 'psicologa', 'empleado')
  );

-- ================= mensajes =================
drop policy if exists mensajes_select_participant on public.mensajes;
create policy mensajes_select_participant
  on public.mensajes for select
  using (
    (select public.current_role()) in ('admin', 'psicologa', 'empleado')
    and (
      de_id = (select public.current_usuario_id())
      or para_id = (select public.current_usuario_id())
    )
  );

drop policy if exists mensajes_insert_as_sender on public.mensajes;
create policy mensajes_insert_as_sender
  on public.mensajes for insert
  with check (
    (select public.current_role()) in ('admin', 'psicologa', 'empleado')
    and de_id = (select public.current_usuario_id())
  );

drop policy if exists mensajes_update_mark_read on public.mensajes;
create policy mensajes_update_mark_read
  on public.mensajes for update
  using (para_id = (select public.current_usuario_id()))
  with check (para_id = (select public.current_usuario_id()));

-- ================= notas_psicologicas =================
drop policy if exists notas_psicologicas_all_psicologa_admin on public.notas_psicologicas;
create policy notas_psicologicas_all_psicologa_admin
  on public.notas_psicologicas for all
  using ((select public.current_role()) in ('psicologa', 'admin'))
  with check ((select public.current_role()) in ('psicologa', 'admin'));

-- ================= vacaciones =================
drop policy if exists vacaciones_select_admin_rh_psicologa on public.vacaciones;
create policy vacaciones_select_admin_rh_psicologa
  on public.vacaciones for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists vacaciones_select_own on public.vacaciones;
create policy vacaciones_select_own
  on public.vacaciones for select
  using (empleado_id = (select public.current_usuario_id()));

drop policy if exists vacaciones_insert_own_or_rh on public.vacaciones;
create policy vacaciones_insert_own_or_rh
  on public.vacaciones for insert
  with check (
    empleado_id = (select public.current_usuario_id())
    or (select public.current_role()) = 'rh'
  );

drop policy if exists vacaciones_update_rh on public.vacaciones;
create policy vacaciones_update_rh
  on public.vacaciones for update
  using ((select public.current_role()) = 'rh')
  with check ((select public.current_role()) = 'rh');

-- ================= permisos =================
drop policy if exists permisos_select_admin_rh_psicologa on public.permisos;
create policy permisos_select_admin_rh_psicologa
  on public.permisos for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists permisos_select_own on public.permisos;
create policy permisos_select_own
  on public.permisos for select
  using (empleado_id = (select public.current_usuario_id()));

drop policy if exists permisos_insert_own_or_rh on public.permisos;
create policy permisos_insert_own_or_rh
  on public.permisos for insert
  with check (
    empleado_id = (select public.current_usuario_id())
    or (select public.current_role()) = 'rh'
  );

drop policy if exists permisos_update_rh on public.permisos;
create policy permisos_update_rh
  on public.permisos for update
  using ((select public.current_role()) = 'rh')
  with check ((select public.current_role()) = 'rh');

-- ================= descuentos =================
drop policy if exists descuentos_select_admin_rh_psicologa on public.descuentos;
create policy descuentos_select_admin_rh_psicologa
  on public.descuentos for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists descuentos_insert_admin_rh on public.descuentos;
create policy descuentos_insert_admin_rh
  on public.descuentos for insert
  with check ((select public.current_role()) in ('admin', 'rh'));

drop policy if exists descuentos_update_admin_rh on public.descuentos;
create policy descuentos_update_admin_rh
  on public.descuentos for update
  using ((select public.current_role()) in ('admin', 'rh'))
  with check ((select public.current_role()) in ('admin', 'rh'));

-- ================= archivos_expediente =================
drop policy if exists archivos_expediente_select_admin_rh_psicologa on public.archivos_expediente;
create policy archivos_expediente_select_admin_rh_psicologa
  on public.archivos_expediente for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists archivos_expediente_insert_admin_rh_psicologa on public.archivos_expediente;
create policy archivos_expediente_insert_admin_rh_psicologa
  on public.archivos_expediente for insert
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- ================= reportes_confidenciales =================
-- El empleado sigue pudiendo INSERTAR su reporte pero NO tiene policy de SELECT:
-- no puede leerlo de vuelta ("confidencial" real). Sin cambios respecto a la mig 016.
drop policy if exists reportes_confidenciales_select_admin_psicologa on public.reportes_confidenciales;
create policy reportes_confidenciales_select_admin_psicologa
  on public.reportes_confidenciales for select
  using ((select public.current_role()) in ('admin', 'psicologa'));

drop policy if exists reportes_confidenciales_insert_own on public.reportes_confidenciales;
create policy reportes_confidenciales_insert_own
  on public.reportes_confidenciales for insert
  with check (empleado_id = (select public.current_usuario_id()));

-- ================= reconocimientos =================
drop policy if exists reconocimientos_select_all_authenticated on public.reconocimientos;
create policy reconocimientos_select_all_authenticated
  on public.reconocimientos for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists reconocimientos_write_admin_rh on public.reconocimientos;
create policy reconocimientos_write_admin_rh
  on public.reconocimientos for insert
  with check ((select public.current_role()) in ('admin', 'rh'));

-- ================= candidatos_bolsa (mig 026) =================
drop policy if exists candidatos_bolsa_select_rh_admin on public.candidatos_bolsa;
create policy candidatos_bolsa_select_rh_admin
  on public.candidatos_bolsa for select
  using ((select public.current_role()) in ('admin', 'rh'));

-- ================= storage.objects: expedientes (mig 017) =================
drop policy if exists expedientes_select_admin_rh_psicologa on storage.objects;
create policy expedientes_select_admin_rh_psicologa
  on storage.objects for select
  using (
    bucket_id = 'expedientes'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

drop policy if exists expedientes_select_own on storage.objects;
create policy expedientes_select_own
  on storage.objects for select
  using (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select public.current_usuario_id())::text
  );

drop policy if exists expedientes_insert_admin_rh_psicologa on storage.objects;
create policy expedientes_insert_admin_rh_psicologa
  on storage.objects for insert
  with check (
    bucket_id = 'expedientes'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

-- ================= storage.objects: avatars (migs 021, 022, 025) =================
drop policy if exists avatars_insert_admin_psicologa on storage.objects;
create policy avatars_insert_admin_psicologa
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (select public.current_role()) in ('admin', 'psicologa')
  );

drop policy if exists avatars_update_admin_psicologa on storage.objects;
create policy avatars_update_admin_psicologa
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (select public.current_role()) in ('admin', 'psicologa')
  );

drop policy if exists avatars_delete_admin_psicologa on storage.objects;
create policy avatars_delete_admin_psicologa
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (select public.current_role()) in ('admin', 'psicologa')
  );

-- Self-service (mig 025): cada usuario gestiona su propio avatars/<id>.jpg.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and name = (select public.current_usuario_id())::text || '.jpg'
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and name = (select public.current_usuario_id())::text || '.jpg'
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and name = (select public.current_usuario_id())::text || '.jpg'
  );

-- avatars_select_public (mig 022) no se toca: solo compara bucket_id, sin llamadas
-- a función, así que no tiene nada que cachear.

-- ----------------------------------------------------------------------------
-- Verificación tras el deploy (los permisos deben ser idénticos a los de antes):
--   - Como empleado: ve solo SUS encuestas, SUS vacaciones/permisos, y sus mensajes.
--     NO ve reportes_confidenciales (ni los propios) ni notas_psicologicas.
--   - Como rh: ve vacaciones/permisos/descuentos de todos; NO ve encuestas ni notas.
--   - Como psicologa: ve encuestas, notas y reportes_confidenciales.
--   - Como admin: todo.
--   - Subir/quitar la foto de perfil propia sigue funcionando en los 4 roles.
--
-- Comprobar el InitPlan (la llamada debe aparecer una sola vez, no por fila):
--   explain (analyze, verbose) select * from public.encuestas;
--   -> el filtro de RLS debe mostrarse como InitPlan, no en el Filter de cada fila.
-- ----------------------------------------------------------------------------
