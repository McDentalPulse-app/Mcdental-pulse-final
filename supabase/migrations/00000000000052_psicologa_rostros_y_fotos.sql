-- Completa la paridad rh/psicologa-como-admin (migración 050) para rostros, fotos y
-- calibración.
--
-- La 050 dejó fuera estas tablas/buckets porque en su momento acarreaban fotos y datos
-- biométricos ("la psicóloga NO, mismo criterio que en la tabla: es dato laboral" — comentario
-- de la migración 037). La decisión de negocio del dueño (2026-07-15, misma sesión que la 050)
-- es que RH y psicóloga vean y operen TODO lo que admin, sin excepción: horarios, rostros y las
-- fotos de asistencia incluidas. Esta migración cierra ese hueco.
--
-- No se editan migraciones ya aplicadas: se SUELTAN y RECREAN las policies afectadas.

-- ================= rostros (tabla): SELECT / INSERT / UPDATE =================
-- Antes: admin, rh. Ahora suma psicologa — sin esto, la pantalla "Rostros" que el menú ya le
-- ofrece a psicologa cargaría vacía o fallaría al aprobar/rechazar.
drop policy if exists rostros_select_admin_rh on public.rostros;
create policy rostros_select_gestion
  on public.rostros for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists rostros_insert_admin_rh on public.rostros;
create policy rostros_insert_gestion
  on public.rostros for insert
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists rostros_update_admin_rh on public.rostros;
create policy rostros_update_gestion
  on public.rostros for update
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- ================= storage: bucket 'rostros' (subir/actualizar fotos de enrolado) =========
drop policy if exists rostros_insert_admin_rh on storage.objects;
create policy rostros_insert_gestion
  on storage.objects for insert
  with check (
    bucket_id = 'rostros'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

drop policy if exists rostros_update_admin_rh on storage.objects;
create policy rostros_update_gestion
  on storage.objects for update
  using (
    bucket_id = 'rostros'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

-- ================= storage: bucket 'asistencias' (fotos de cada checada) =================
-- Antes excluía a propósito a psicologa (037). La decisión de paridad total de hoy la incluye:
-- ya ve la fila de la checada (migración 050), verla sin la foto era la mitad de la pantalla.
drop policy if exists asistencias_select_admin_rh on storage.objects;
create policy asistencias_select_gestion
  on storage.objects for select
  using (
    bucket_id = 'asistencias'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

-- ================= cotejo_intentos: SELECT (pantalla de Calibración) =================
drop policy if exists cotejo_intentos_select_admin_rh on public.cotejo_intentos;
create policy cotejo_intentos_select_gestion
  on public.cotejo_intentos for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   drop policy if exists rostros_select_gestion on public.rostros;
--   create policy rostros_select_admin_rh on public.rostros for select
--     using ((select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists rostros_insert_gestion on public.rostros;
--   create policy rostros_insert_admin_rh on public.rostros for insert
--     with check ((select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists rostros_update_gestion on public.rostros;
--   create policy rostros_update_admin_rh on public.rostros for update
--     using ((select public.current_role()) in ('admin', 'rh'))
--     with check ((select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists rostros_insert_gestion on storage.objects;
--   create policy rostros_insert_admin_rh on storage.objects for insert
--     with check (bucket_id = 'rostros' and (select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists rostros_update_gestion on storage.objects;
--   create policy rostros_update_admin_rh on storage.objects for update
--     using (bucket_id = 'rostros' and (select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists asistencias_select_gestion on storage.objects;
--   create policy asistencias_select_admin_rh on storage.objects for select
--     using (bucket_id = 'asistencias' and (select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists cotejo_intentos_select_gestion on public.cotejo_intentos;
--   create policy cotejo_intentos_select_admin_rh on public.cotejo_intentos for select
--     using ((select public.current_role()) in ('admin', 'rh'));
