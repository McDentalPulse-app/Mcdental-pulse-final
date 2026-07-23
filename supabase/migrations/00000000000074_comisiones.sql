-- ============================================================================
-- Comisiones: recibos que suben los doctores para que RH los valide.
--
-- Flujo: el doctor sube una FOTO del recibo (con la fecha de hoy escrita a mano) + una nota
-- opcional. Queda 'pendiente'. RH la revisa por doctor y la marca 'valida' o 'invalida' con un
-- comentario; en ese momento el doctor recibe un mensaje + una notificación (vía
-- api/revisar-comision.js, que es quien tiene la service role y la clave de push).
--
-- La foto vive en un bucket PRIVADO (como 'asistencias'/'expedientes', no como 'avatars'): un
-- recibo es un dato económico, no puede quedar en URL pública adivinando un UUID. Se lee con
-- signed URL on-demand.
-- ============================================================================

create type public.estado_comision as enum ('pendiente', 'valida', 'invalida');

create table public.comisiones (
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid not null references public.usuarios(id) on delete cascade,
  foto_path      text not null,                       -- comisiones/<doctor_id>/<timestamp>.jpg
  fecha          date not null default current_date,  -- la fecha del registro (hoy)
  nota           text,
  estado         public.estado_comision not null default 'pendiente',
  comentario_rh  text,
  revisado_por   uuid references public.usuarios(id),
  revisado_en    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_comisiones_updated_at
  before update on public.comisiones
  for each row execute function public.set_updated_at();

create index idx_comisiones_doctor_id on public.comisiones(doctor_id);
create index idx_comisiones_estado on public.comisiones(estado);

alter table public.comisiones enable row level security;

-- El doctor ve y crea SOLO las suyas. La escritura de estado/comentario NO es suya (la hace RH
-- vía servidor); por eso no hay policy de UPDATE para el dueño.
create policy comisiones_select_own on public.comisiones
  for select using (doctor_id = (select public.current_usuario_id()));

create policy comisiones_insert_own on public.comisiones
  for insert with check (
    doctor_id = (select public.current_usuario_id())
    and (select public.current_role()) = 'doctor'
  );

-- Gestión (rh/admin/psicologa) ve todas y puede resolverlas. La resolución real pasa por
-- api/revisar-comision.js (service role) para poder mandar mensaje + push; esta policy deja
-- además que el update funcione si algún día se hace desde el cliente autenticado como gestión.
create policy comisiones_select_gestion on public.comisiones
  for select using ((select public.current_role()) in ('rh', 'admin', 'psicologa'));

create policy comisiones_update_gestion on public.comisiones
  for update
  using ((select public.current_role()) in ('rh', 'admin', 'psicologa'))
  with check ((select public.current_role()) in ('rh', 'admin', 'psicologa'));

grant select, insert, update on public.comisiones to authenticated;
grant select, insert, update, delete on public.comisiones to service_role;

-- Realtime: para que RH vea entrar los recibos y el doctor vea el veredicto sin recargar.
alter publication supabase_realtime add table public.comisiones;

-- Storage: bucket privado, path por carpeta = UUID del doctor (igual que 'asistencias'). -------
insert into storage.buckets (id, name, public)
values ('comisiones', 'comisiones', false)
on conflict (id) do nothing;

update storage.buckets set file_size_limit = 3145728 where id = 'comisiones';  -- 3 MB

-- El doctor sube en SU carpeta.
drop policy if exists comisiones_obj_insert_own on storage.objects;
create policy comisiones_obj_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'comisiones'
    and (storage.foldername(name))[1] = (select public.current_usuario_id())::text
  );

-- El doctor lee sus propios recibos.
drop policy if exists comisiones_obj_select_own on storage.objects;
create policy comisiones_obj_select_own
  on storage.objects for select
  using (
    bucket_id = 'comisiones'
    and (storage.foldername(name))[1] = (select public.current_usuario_id())::text
  );

-- Gestión lee todos para poder validarlos.
drop policy if exists comisiones_obj_select_gestion on storage.objects;
create policy comisiones_obj_select_gestion
  on storage.objects for select
  using (
    bucket_id = 'comisiones'
    and (select public.current_role()) in ('rh', 'admin', 'psicologa')
  );

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (doctor A) insert comisiones{doctor_id: A}            -> OK
--   (doctor A) insert comisiones{doctor_id: B}            -> DEBE FALLAR (RLS)
--   (doctor A) subir 'comisiones/<A>/1.jpg'               -> OK ; a '<B>/1.jpg' -> FALLA
--   (rh)       select * from comisiones                   -> ve todas
--   (empleado) insert comisiones                          -> DEBE FALLAR (no es doctor)
-- ----------------------------------------------------------------------------
