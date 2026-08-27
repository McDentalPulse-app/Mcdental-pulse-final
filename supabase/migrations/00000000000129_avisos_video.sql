-- Video adjunto en los avisos (admin/rh/psicologa). Un aviso lleva a lo más un video, en
-- una columna aparte — no dentro del `cuerpo` (HTML enriquecido saneado con DOMPurify,
-- migración 058): esa lista blanca excluye <video>/<iframe>/<img> a propósito, es la
-- defensa anti-XSS del comunicado. Abrirla para meter un video ahí debilitaría esa defensa
-- para TODOS los avisos, no solo para el que lo lleva.
--
-- Mismo patrón que la foto de material (migración 124): bucket público con tope de tamaño,
-- columna `video_url`, políticas acotadas a quien ya puede publicar avisos, y una policy
-- `_select_public` adicional — sin ella el upload falla con "new row violates row-level
-- security policy" aunque el INSERT esté bien (mismo gotcha documentado en la 022/124).
--
-- Tope 50 MB y solo MP4 (confirmado con el dueño): compatible en cualquier teléfono,
-- incluido iPhone, y no deja subir un archivo tan pesado que nadie lo vea con datos
-- móviles. El `allowed_mime_types` del bucket lo hace cumplir el servidor, no solo el
-- cliente.

alter table public.avisos add column if not exists video_url text;

comment on column public.avisos.video_url is
  'URL pública del video adjunto (bucket avisos-videos), o null si el aviso no lleva video. Migración 129.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avisos-videos', 'avisos-videos', true, 52428800, array['video/mp4'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convención de ruta: avisos-videos/<aviso_id>.mp4

drop policy if exists avisos_videos_insert_gestion on storage.objects;
create policy avisos_videos_insert_gestion
  on storage.objects for insert
  with check (
    bucket_id = 'avisos-videos'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

drop policy if exists avisos_videos_update_gestion on storage.objects;
create policy avisos_videos_update_gestion
  on storage.objects for update
  using (
    bucket_id = 'avisos-videos'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

drop policy if exists avisos_videos_delete_gestion on storage.objects;
create policy avisos_videos_delete_gestion
  on storage.objects for delete
  using (
    bucket_id = 'avisos-videos'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

-- "Bucket público" solo habilita el endpoint público de descarga
-- (/storage/v1/object/public/...) — storage.objects sigue necesitando su propia policy de
-- SELECT para que el servicio de Storage resuelva metadata al subir. Sin esto el upload
-- falla con "new row violates row-level security policy" aunque la policy de INSERT sea
-- correcta (migración 022, repetido en la 124).
drop policy if exists avisos_videos_select_public on storage.objects;
create policy avisos_videos_select_public
  on storage.objects for select
  using (bucket_id = 'avisos-videos');

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en transacción con rollback, mismo método que la migración 128):
--   (como admin/rh/psicologa) insert into storage.objects (bucket_id, name)
--     values ('avisos-videos', 'prueba.mp4'); -> OK (RLS deja pasar).
--   (como empleado) mismo insert -> 0 filas / rechazado (RLS lo bloquea).
--   select file_size_limit, allowed_mime_types from storage.buckets
--     where id = 'avisos-videos'; -> 52428800, {video/mp4}.
--
-- ROLLBACK:
--   drop policy if exists avisos_videos_select_public on storage.objects;
--   drop policy if exists avisos_videos_delete_gestion on storage.objects;
--   drop policy if exists avisos_videos_update_gestion on storage.objects;
--   drop policy if exists avisos_videos_insert_gestion on storage.objects;
--   delete from storage.buckets where id = 'avisos-videos';
--   alter table public.avisos drop column if exists video_url;
-- ----------------------------------------------------------------------------
