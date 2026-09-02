-- ============================================================================
-- Módulos apagables por persona (parte 2/2): enforcement en RLS.
--
-- Se usan políticas RESTRICTIVE en vez de tocar las políticas PERMISSIVE que ya
-- existen en cada tabla (varias de ellas reescritas en 5-10 migraciones distintas
-- a lo largo del repo — copiar mal una condición ahí rompe algo que ya funciona).
-- Una policy RESTRICTIVE se AND-ea con TODAS las permissive existentes sin tocarlas
-- ni necesitar conocer su texto exacto: si el interruptor está apagado, no importa
-- qué permissive diga que sí — queda bloqueado igual.
--
-- Checador (registrar_checada) NO se toca acá: es SECURITY DEFINER y no pasa por
-- RLS de la tabla asistencias al insertar, así que su enforcement va en la propia
-- función (migración 143).
-- ============================================================================

-- Comisiones
create policy comisiones_modulo_activo on public.comisiones
  as restrictive
  for select
  using (coalesce((select puede_ver_comisiones from public.usuarios where id = public.current_usuario_id()), true));

-- Los recibos de comisiones no viven en una tabla propia: son archivos en
-- storage.objects, bucket 'comisiones' (mig. 074). Misma idea, mismo interruptor.
create policy comisiones_obj_modulo_activo on storage.objects
  as restrictive
  for select
  using (
    bucket_id <> 'comisiones'
    or coalesce((select puede_ver_comisiones from public.usuarios where id = public.current_usuario_id()), true)
  );

-- Notas personales
create policy notas_modulo_activo on public.notas
  as restrictive
  for all
  using (coalesce((select puede_usar_notas from public.usuarios where id = public.current_usuario_id()), true));

create policy nota_links_modulo_activo on public.nota_links
  as restrictive
  for all
  using (coalesce((select puede_usar_notas from public.usuarios where id = public.current_usuario_id()), true));

-- Departamentos (solo lectura/participación — crear un departamento ya está
-- gobernado aparte por puede_crear_departamento, sin cambios acá)
create policy departamentos_modulo_activo on public.departamentos
  as restrictive
  for select
  using (coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true));

create policy departamento_miembros_modulo_activo on public.departamento_miembros
  as restrictive
  for select
  using (coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true));

create policy departamento_publicaciones_modulo_activo on public.departamento_publicaciones
  as restrictive
  for select
  using (coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true));

create policy departamento_tareas_modulo_activo on public.departamento_tareas
  as restrictive
  for select
  using (coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true));

-- Avisos (comunicados de la empresa)
create policy avisos_modulo_activo on public.avisos
  as restrictive
  for select
  using (coalesce((select puede_ver_avisos from public.usuarios where id = public.current_usuario_id()), true));

-- Encuestas (deja el propio submit/lectura de la encuesta detrás del interruptor;
-- OJO: si se apaga para alguien que igual tiene bloqueo de entrada del viernes
-- ligado a "contestó la encuesta" (mig. 128), va a quedar bloqueado siempre —
-- riesgo ya documentado en el plan de esta feature).
create policy encuestas_modulo_activo on public.encuestas
  as restrictive
  for select
  using (coalesce((select puede_ver_encuestas from public.usuarios where id = public.current_usuario_id()), true));

create policy encuestas_modulo_activo_insert on public.encuestas
  as restrictive
  for insert
  with check (coalesce((select puede_ver_encuestas from public.usuarios where id = public.current_usuario_id()), true));
