-- Bucket privado para expedientes, con límite de 10MB también server-side
-- (no solo validado en cliente).
insert into storage.buckets (id, name, public)
values ('expedientes', 'expedientes', false)
on conflict (id) do nothing;

update storage.buckets set file_size_limit = 10485760 where id = 'expedientes';

-- Convención de path: expedientes/<empleado_id_uuid>/<timestamp>-<nombre_archivo>
create policy expedientes_select_admin_rh_psicologa
  on storage.objects for select
  using (
    bucket_id = 'expedientes'
    and public.current_role() in ('admin', 'rh', 'psicologa')
  );

create policy expedientes_select_own
  on storage.objects for select
  using (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = public.current_usuario_id()::text
  );

create policy expedientes_insert_admin_rh_psicologa
  on storage.objects for insert
  with check (
    bucket_id = 'expedientes'
    and public.current_role() in ('admin', 'rh', 'psicologa')
  );

-- Sin policy de UPDATE/DELETE: los archivos de expediente son inmutables (igual que hoy).
