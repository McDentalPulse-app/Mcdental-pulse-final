-- Foto de perfil de usuario. Bucket público (uso interno, sensibilidad baja
-- comparado con expedientes) para poder mostrar el avatar en toda la app
-- (sidebar, tarjetas de empleado, mensajes, etc.) sin tener que generar una
-- signed URL cada vez que se renderiza <Avatar>. Solo admin/psicologa pueden
-- subir — se asigna desde la pantalla de Expediente Integral.

alter table public.usuarios add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Comprimido client-side antes de subir (~pocos cientos de KB); 2MB de
-- margen server-side por si algo se sube sin pasar por esa compresión.
update storage.buckets set file_size_limit = 2097152 where id = 'avatars';

-- Convención de path: avatars/<usuario_id_uuid>.jpg (determinístico, upsert
-- en cada cambio de foto — no se acumulan versiones viejas).
create policy avatars_insert_admin_psicologa
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.current_role() in ('admin', 'psicologa')
  );

create policy avatars_update_admin_psicologa
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.current_role() in ('admin', 'psicologa')
  );

create policy avatars_delete_admin_psicologa
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.current_role() in ('admin', 'psicologa')
  );

-- Sin policy de SELECT: el bucket es público, storage.objects no necesita
-- una policy de lectura para que las URLs públicas funcionen.
