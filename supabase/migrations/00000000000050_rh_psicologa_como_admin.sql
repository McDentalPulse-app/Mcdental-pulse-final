-- rh y psicologa con paridad de admin.
--
-- Decisión de negocio (2026-07-15): los roles RH y psicóloga deben poder hacer todo
-- lo que hace admin, además de lo suyo. Antes varias tablas gateaban por 'admin'
-- (o 'admin'+un rol) y dejaban fuera a RH y/o psicóloga.
--
-- No se editan migraciones ya aplicadas: esta migración SUELTA y RECREA las policies
-- afectadas ampliando la lista de roles a ('admin','rh','psicologa') donde corresponde.
--
-- ⚠️ Incluye datos sensibles a propósito: notas psicológicas y reportes confidenciales
-- de salud mental quedan visibles también para RH. Es la decisión explícita del dueño.

-- ================= encuestas: SELECT =================
-- Antes: admin, psicologa. Ahora suma rh (Encuestas, Reportes, AI Engine).
drop policy if exists encuestas_select_admin_psicologa on public.encuestas;
create policy encuestas_select_admin_rh_psicologa
  on public.encuestas for select
  using (public.current_role() in ('admin', 'rh', 'psicologa'));

-- ================= encuesta_preguntas: WRITE =================
-- Antes: solo admin. Ahora rh y psicologa pueden editar el cuestionario (GestionEncuestas).
drop policy if exists encuesta_preguntas_write_admin on public.encuesta_preguntas;
create policy encuesta_preguntas_write_gestion
  on public.encuesta_preguntas for all
  using (public.current_role() in ('admin', 'rh', 'psicologa'))
  with check (public.current_role() in ('admin', 'rh', 'psicologa'));

-- ================= notas_psicologicas: ALL =================
-- Antes: psicologa, admin. Ahora suma rh (Expedientes).
drop policy if exists notas_psicologicas_all_psicologa_admin on public.notas_psicologicas;
create policy notas_psicologicas_all_gestion
  on public.notas_psicologicas for all
  using (public.current_role() in ('admin', 'rh', 'psicologa'))
  with check (public.current_role() in ('admin', 'rh', 'psicologa'));

-- ================= reportes_confidenciales: SELECT =================
-- Antes: admin, psicologa. Ahora suma rh (panel de Reportes Confidenciales + Expedientes).
-- La policy de INSERT (reportes_confidenciales_insert_own) NO se toca: el empleado sigue
-- pudiendo crear su reporte sin poder leerlo de vuelta.
drop policy if exists reportes_confidenciales_select_admin_psicologa on public.reportes_confidenciales;
create policy reportes_confidenciales_select_gestion
  on public.reportes_confidenciales for select
  using (public.current_role() in ('admin', 'rh', 'psicologa'));

-- ================= reconocimientos: INSERT =================
-- Antes: admin, rh. Ahora suma psicologa.
drop policy if exists reconocimientos_write_admin_rh on public.reconocimientos;
create policy reconocimientos_write_gestion
  on public.reconocimientos for insert
  with check (public.current_role() in ('admin', 'rh', 'psicologa'));

-- ================= sucursales: INSERT / UPDATE =================
-- Antes: solo admin. Ahora rh y psicologa pueden capturar geocercas.
drop policy if exists sucursales_insert_admin on public.sucursales;
create policy sucursales_insert_gestion
  on public.sucursales for insert
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists sucursales_update_admin on public.sucursales;
create policy sucursales_update_gestion
  on public.sucursales for update
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- ================= horarios: INSERT / UPDATE / DELETE =================
-- Antes: admin, rh. Ahora suma psicologa (el SELECT de gestión ya la incluía).
drop policy if exists horarios_insert_admin_rh on public.horarios;
create policy horarios_insert_gestion
  on public.horarios for insert
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists horarios_update_admin_rh on public.horarios;
create policy horarios_update_gestion
  on public.horarios for update
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists horarios_delete_admin_rh on public.horarios;
create policy horarios_delete_gestion
  on public.horarios for delete
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- ================= asistencias: SELECT =================
-- Antes: admin, rh. Ahora suma psicologa (ve la rejilla como admin).
-- La anulación (INSERT/UPDATE) sigue siendo exclusiva de rh: ni admin ni psicóloga
-- anulan checadas, así que no se tocan esas policies.
drop policy if exists asistencias_select_admin_rh on public.asistencias;
create policy asistencias_select_gestion
  on public.asistencias for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
