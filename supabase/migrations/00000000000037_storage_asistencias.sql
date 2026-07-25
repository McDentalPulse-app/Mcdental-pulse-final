-- ============================================================================
-- Bucket de selfies del checador.
--
-- PRIVADO, como 'expedientes' y a diferencia de 'avatars'. Una foto de la cara de
-- alguien tomada en su lugar de trabajo, con hora y coordenada al lado, es un dato
-- laboral sensible: no puede quedar accesible en una URL pública que solo depende de
-- adivinar un UUID. Se lee con signed URL de 5 minutos, on-demand.
--
-- Convención de path: asistencias/<usuario_id_uuid>/<timestamp>.jpg
-- La carpeta = UUID del empleado, para que las policies puedan resolver el dueño con
-- (storage.foldername(name))[1], exactamente como expedientes_select_own.
--
-- SIN policies de UPDATE/DELETE: las selfies son inmutables, igual que los archivos de
-- expediente. Como no hay upsert, nos ahorramos además la trampa que documenta la
-- migración 022 (con upsert, Storage necesita también policy de SELECT y de UPDATE
-- para resolver metadata, y el upload falla con un error de RLS que no dice eso).
--
-- Tamaño: el cliente comprime a JPEG de 480 px (~40 KB). El límite de 1 MB es la red
-- de seguridad del servidor, no el caso normal.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('asistencias', 'asistencias', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 1048576   -- 1 MB
where id = 'asistencias';

-- El empleado sube SU selfie, en SU carpeta. No puede escribir en la de otro.
drop policy if exists asistencias_insert_own on storage.objects;
create policy asistencias_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'asistencias'
    and (storage.foldername(name))[1] = (select public.current_usuario_id())::text
  );

-- El empleado ve sus propias selfies (su historial se las muestra).
drop policy if exists asistencias_select_own on storage.objects;
create policy asistencias_select_own
  on storage.objects for select
  using (
    bucket_id = 'asistencias'
    and (storage.foldername(name))[1] = (select public.current_usuario_id())::text
  );

-- admin y rh ven todas: la selfie solo sirve para algo si alguien puede mirarla cuando
-- una checada sale marcada como 'fuera' de la geocerca. Sin esto, la comprobación es
-- teatro. (La psicóloga NO, mismo criterio que en la tabla: es dato laboral.)
drop policy if exists asistencias_select_admin_rh on storage.objects;
create policy asistencias_select_admin_rh
  on storage.objects for select
  using (
    bucket_id = 'asistencias'
    and (select public.current_role()) in ('admin', 'rh')
  );

-- ----------------------------------------------------------------------------
-- RETENCIÓN (pendiente de decidir, deliberadamente NO implementado aquí):
--
-- Una selfie por checada, ~40 KB: unos 60 empleados x 2 checadas x 250 días ≈ 1,2 GB
-- en 5 años. Es asumible, pero guardar la cara de la plantilla indefinidamente es una
-- decisión que corresponde tomar a la empresa, no a esta migración. Cuando se decida
-- (¿12 meses?), el borrado va en un cron de Supabase que barra por prefijo de fecha.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como empleado A) subir a 'asistencias/<id-de-A>/123.jpg'  -> OK
--   (como empleado A) subir a 'asistencias/<id-de-B>/123.jpg'  -> DEBE FALLAR (RLS)
--   (como empleado A) leer  'asistencias/<id-de-B>/123.jpg'    -> DEBE FALLAR (RLS)
--   (como rh)         leer  cualquier objeto del bucket        -> OK
--
-- ROLLBACK:
--   drop policy if exists asistencias_insert_own     on storage.objects;
--   drop policy if exists asistencias_select_own     on storage.objects;
--   drop policy if exists asistencias_select_admin_rh on storage.objects;
--   delete from storage.buckets where id = 'asistencias';
-- ----------------------------------------------------------------------------
