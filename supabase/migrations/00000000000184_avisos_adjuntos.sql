-- ============================================================================
-- 184 — Archivos adjuntos en los Avisos (PDF, Word, Excel, imágenes, texto).
--
-- Pedido del dueño (2026-09-30): adjuntar documentos a un aviso y que quien lo recibe los vea
-- DENTRO de la app, sin descargarlos. El visor vive en el cliente
-- (src/components/common/VisorArchivo.jsx); aquí solo se guarda qué archivos lleva cada aviso
-- y quién puede abrirlos.
--
-- Los adjuntos van en el propio aviso (`adjuntos` jsonb: [{nombre, ruta, mime, bytes}]), igual
-- que el video (`video_url`): se suben antes de guardar el aviso y se guardan junto con él. Así
-- no hace falta una tabla aparte ni un orden de inserción.
--
-- QUIÉN VE UN ARCHIVO: quien ve el aviso. El bucket `avisos-adjuntos` es privado y su policy de
-- lectura busca un aviso que contenga esa ruta; esa subconsulta pasa por la RLS de `avisos`
-- (avisos_select_por_sucursal y avisos_modulo_activo), así que la regla de sucursal y la de
-- módulo apagado aplican solas. Subir y borrar: solo gestión (admin/rh/psicóloga), igual que
-- publicar avisos.
-- ============================================================================

begin;

alter table public.avisos add column if not exists adjuntos jsonb not null default '[]'::jsonb;

comment on column public.avisos.adjuntos is
  'Archivos adjuntos: [{nombre, ruta, mime, bytes}] en el bucket avisos-adjuntos. Ver migración 184.';

-- 20 MB por archivo: un PDF escaneado o un Excel con varias hojas pasa fácil de 10.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avisos-adjuntos', 'avisos-adjuntos', false, 20971520, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avisos_adjuntos_insert_gestion" on storage.objects;
create policy "avisos_adjuntos_insert_gestion" on storage.objects for insert to authenticated
  with check (bucket_id = 'avisos-adjuntos'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists "avisos_adjuntos_delete_gestion" on storage.objects;
create policy "avisos_adjuntos_delete_gestion" on storage.objects for delete to authenticated
  using (bucket_id = 'avisos-adjuntos'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- Gestión lee todo (también lo recién subido que aún no está en ningún aviso guardado); el
-- resto, solo archivos de un aviso que puede ver.
drop policy if exists "avisos_adjuntos_select" on storage.objects;
create policy "avisos_adjuntos_select" on storage.objects for select to authenticated
  using (bucket_id = 'avisos-adjuntos' and (
    (select public.current_role()) in ('admin', 'rh', 'psicologa')
    or exists (select 1 from public.avisos a
                where a.adjuntos @> jsonb_build_array(jsonb_build_object('ruta', name)))
  ));

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   · RH sube un PDF y guarda el aviso para una sucursal: un empleado de esa sucursal lo abre;
--     uno de otra sucursal recibe 400 al pedir el archivo.
--   · Un empleado intenta subir al bucket: "new row violates row-level security policy".
--
-- ROLLBACK:
--   drop policy if exists "avisos_adjuntos_insert_gestion" on storage.objects;
--   drop policy if exists "avisos_adjuntos_delete_gestion" on storage.objects;
--   drop policy if exists "avisos_adjuntos_select" on storage.objects;
--   (vaciar y borrar el bucket por la API de Storage)
--   alter table public.avisos drop column if exists adjuntos;
-- ----------------------------------------------------------------------------
