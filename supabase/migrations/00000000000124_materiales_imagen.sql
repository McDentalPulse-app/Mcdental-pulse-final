-- Foto de material (catálogo de inventario). Mismo patrón que avatars (021): bucket
-- público, tope 2MB, solo quien ya puede editar el catálogo puede subir/cambiar/borrar
-- (calcado de materiales_update_gestion, migración 121).

alter table public.materiales add column if not exists imagen_url text;

insert into storage.buckets (id, name, public)
values ('materiales-fotos', 'materiales-fotos', true)
on conflict (id) do nothing;

update storage.buckets set file_size_limit = 2097152 where id = 'materiales-fotos';

-- Convención de path: materiales-fotos/<material_id_uuid>.jpg

create policy materiales_fotos_insert_gestion
  on storage.objects for insert
  with check (
    bucket_id = 'materiales-fotos'
    and (
      (select public.current_role()) = 'admin'
      or (select u.puede_gestionar_bodega from public.usuarios u
          where u.id = (select public.current_usuario_id()))
    )
  );

create policy materiales_fotos_update_gestion
  on storage.objects for update
  using (
    bucket_id = 'materiales-fotos'
    and (
      (select public.current_role()) = 'admin'
      or (select u.puede_gestionar_bodega from public.usuarios u
          where u.id = (select public.current_usuario_id()))
    )
  );

create policy materiales_fotos_delete_gestion
  on storage.objects for delete
  using (
    bucket_id = 'materiales-fotos'
    and (
      (select public.current_role()) = 'admin'
      or (select u.puede_gestionar_bodega from public.usuarios u
          where u.id = (select public.current_usuario_id()))
    )
  );

-- "Bucket público" solo habilita el endpoint público de descarga
-- (/storage/v1/object/public/...) — storage.objects sigue necesitando su propia policy de
-- SELECT para que el servicio de Storage resuelva metadata (upsert vs insert al subir,
-- RETURNING del INSERT). Sin esto el upload falla con "new row violates row-level security
-- policy" aunque la policy de INSERT sea correcta — mismo bug que documentó la migración 022
-- para avatars.
create policy materiales_fotos_select_public
  on storage.objects for select
  using (bucket_id = 'materiales-fotos');
