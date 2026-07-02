-- Habilitar RLS en las 11 tablas de dominio
alter table public.usuarios enable row level security;
alter table public.encuesta_preguntas enable row level security;
alter table public.encuestas enable row level security;
alter table public.mensajes enable row level security;
alter table public.notas_psicologicas enable row level security;
alter table public.vacaciones enable row level security;
alter table public.permisos enable row level security;
alter table public.descuentos enable row level security;
alter table public.archivos_expediente enable row level security;
alter table public.reportes_confidenciales enable row level security;
alter table public.reconocimientos enable row level security;

-- ================= usuarios =================
create policy usuarios_select_all_authenticated
  on public.usuarios for select
  using (auth.role() = 'authenticated');

create policy usuarios_insert_admin_rh
  on public.usuarios for insert
  with check (public.current_role() in ('admin', 'rh'));

create policy usuarios_update_admin_rh
  on public.usuarios for update
  using (public.current_role() in ('admin', 'rh'));

-- ================= encuesta_preguntas =================
create policy encuesta_preguntas_select_all
  on public.encuesta_preguntas for select
  using (auth.role() = 'authenticated');

create policy encuesta_preguntas_write_admin
  on public.encuesta_preguntas for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ================= encuestas =================
create policy encuestas_select_admin_psicologa
  on public.encuestas for select
  using (public.current_role() in ('admin', 'psicologa'));

create policy encuestas_select_own
  on public.encuestas for select
  using (empleado_id = public.current_usuario_id());

create policy encuestas_insert_own
  on public.encuestas for insert
  with check (
    empleado_id = public.current_usuario_id()
    and public.current_role() in ('admin', 'psicologa', 'empleado')
  );

-- ================= mensajes =================
create policy mensajes_select_participant
  on public.mensajes for select
  using (
    public.current_role() in ('admin', 'psicologa', 'empleado')
    and (de_id = public.current_usuario_id() or para_id = public.current_usuario_id())
  );

create policy mensajes_insert_as_sender
  on public.mensajes for insert
  with check (
    public.current_role() in ('admin', 'psicologa', 'empleado')
    and de_id = public.current_usuario_id()
  );

create policy mensajes_update_mark_read
  on public.mensajes for update
  using (para_id = public.current_usuario_id())
  with check (para_id = public.current_usuario_id());

-- ================= notas_psicologicas =================
create policy notas_psicologicas_all_psicologa_admin
  on public.notas_psicologicas for all
  using (public.current_role() in ('psicologa', 'admin'))
  with check (public.current_role() in ('psicologa', 'admin'));

-- ================= vacaciones =================
create policy vacaciones_select_admin_rh_psicologa
  on public.vacaciones for select
  using (public.current_role() in ('admin', 'rh', 'psicologa'));

create policy vacaciones_select_own
  on public.vacaciones for select
  using (empleado_id = public.current_usuario_id());

create policy vacaciones_insert_own_or_rh
  on public.vacaciones for insert
  with check (
    empleado_id = public.current_usuario_id()
    or public.current_role() = 'rh'
  );

create policy vacaciones_update_rh
  on public.vacaciones for update
  using (public.current_role() = 'rh')
  with check (public.current_role() = 'rh');

-- ================= permisos =================
create policy permisos_select_admin_rh_psicologa
  on public.permisos for select
  using (public.current_role() in ('admin', 'rh', 'psicologa'));

create policy permisos_select_own
  on public.permisos for select
  using (empleado_id = public.current_usuario_id());

create policy permisos_insert_own_or_rh
  on public.permisos for insert
  with check (
    empleado_id = public.current_usuario_id()
    or public.current_role() = 'rh'
  );

create policy permisos_update_rh
  on public.permisos for update
  using (public.current_role() = 'rh')
  with check (public.current_role() = 'rh');

-- ================= descuentos =================
create policy descuentos_select_admin_rh_psicologa
  on public.descuentos for select
  using (public.current_role() in ('admin', 'rh', 'psicologa'));

create policy descuentos_insert_admin_rh
  on public.descuentos for insert
  with check (public.current_role() in ('admin', 'rh'));

create policy descuentos_update_admin_rh
  on public.descuentos for update
  using (public.current_role() in ('admin', 'rh'))
  with check (public.current_role() in ('admin', 'rh'));

-- ================= archivos_expediente =================
create policy archivos_expediente_select_admin_rh_psicologa
  on public.archivos_expediente for select
  using (public.current_role() in ('admin', 'rh', 'psicologa'));

create policy archivos_expediente_insert_admin_rh_psicologa
  on public.archivos_expediente for insert
  with check (public.current_role() in ('admin', 'rh', 'psicologa'));

-- ================= reportes_confidenciales =================
-- Reemplaza el hardcode visiblePara: ["admin","psicologa"] de reportesService.js por RLS real.
create policy reportes_confidenciales_select_admin_psicologa
  on public.reportes_confidenciales for select
  using (public.current_role() in ('admin', 'psicologa'));

create policy reportes_confidenciales_insert_own
  on public.reportes_confidenciales for insert
  with check (empleado_id = public.current_usuario_id());
  -- El empleado puede INSERTAR su propio reporte pero no tiene policy de SELECT:
  -- no puede leer ni su propio reporte de vuelta ni el de nadie más ("confidencial" real).

-- ================= reconocimientos =================
create policy reconocimientos_select_all_authenticated
  on public.reconocimientos for select
  using (auth.role() = 'authenticated');

create policy reconocimientos_write_admin_rh
  on public.reconocimientos for insert
  with check (public.current_role() in ('admin', 'rh'));
