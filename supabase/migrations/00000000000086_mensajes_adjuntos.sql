-- ============================================================================
-- Adjuntos en el chat empleado ↔ psicóloga (migración 086).
--
-- Un solo juego de columnas para archivo, imagen y —más adelante— nota de voz: lo
-- que las distingue es `adjunto_mime`, no una columna por tipo. Añadir
-- `es_imagen`, `es_audio`… obligaría a una migración por cada formato nuevo y
-- abre la puerta a filas que se contradicen.
-- ============================================================================

alter table public.mensajes
  add column if not exists adjunto_path   text,
  add column if not exists adjunto_nombre text,
  add column if not exists adjunto_mime   text,
  add column if not exists adjunto_bytes  bigint,
  add column if not exists adjunto_meta   jsonb;

comment on column public.mensajes.adjunto_path is
  'Ruta dentro del bucket privado `mensajes`. La primera carpeta es el id de quien lo subió: es lo que hace comprobable la política de escritura.';
comment on column public.mensajes.adjunto_nombre is
  'Nombre original, para mostrar y descargar. NO se usa en la ruta: un nombre con espacios o acentos rompe la URL del storage.';
comment on column public.mensajes.adjunto_mime is
  'Distingue imagen / documento / audio. Es el único discriminador de tipo.';
comment on column public.mensajes.adjunto_meta is
  'Extras según el tipo: dimensiones de una imagen, picos de onda de un audio (migración 088).';

-- ── El texto deja de ser obligatorio ────────────────────────────────────────
-- Mandar solo una foto es normal en un chat. Pero "sin texto obligatorio" no puede
-- significar "se admite un mensaje vacío": el CHECK exige que haya al menos una de
-- las dos cosas, para que no entren filas que no representan nada.
alter table public.mensajes alter column texto drop not null;

alter table public.mensajes drop constraint if exists mensajes_contenido_no_vacio;
alter table public.mensajes add constraint mensajes_contenido_no_vacio
  check (
    (texto is not null and length(btrim(texto)) > 0)
    or adjunto_path is not null
  );

-- La política de lectura del storage busca por esta columna en cada objeto que se
-- abre; sin índice sería un recorrido completo de la tabla por cada descarga.
create index if not exists idx_mensajes_adjunto_path
  on public.mensajes (adjunto_path)
  where adjunto_path is not null;

-- ── Bucket privado ──────────────────────────────────────────────────────────
-- 10 MB, el mismo tope que `expedientes`. Privado: aquí viaja lo que un empleado
-- le manda a la psicóloga.
insert into storage.buckets (id, name, public, file_size_limit)
values ('mensajes', 'mensajes', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- ── Políticas ───────────────────────────────────────────────────────────────

-- Escritura: cada quien solo puede escribir dentro de su propia carpeta. Mismo
-- patrón que `asistencias_insert_own`.
drop policy if exists "mensajes_obj_insert_own" on storage.objects;
create policy "mensajes_obj_insert_own" on storage.objects
  for insert to public
  with check (
    bucket_id = 'mensajes'
    and (storage.foldername(name))[1] = (select current_usuario_id())::text
  );

-- Lectura: la propia carpeta, O un archivo que alguien me mandó.
--
-- LAS DOS MITADES SON NECESARIAS. La subida ocurre ANTES de que exista el mensaje
-- (primero se sube el archivo, luego se inserta la fila con su ruta), así que la
-- carpeta no puede llamarse como el mensaje: se nombra con el remitente. Pero
-- entonces la primera mitad solo deja leer a quien subió, y quien recibe —que es
-- justo a quien va dirigido— se quedaría fuera. La segunda mitad lo arregla
-- mirando si hay un mensaje dirigido a mí que apunte a ese objeto.
--
-- Es exactamente el error que dejó el chat sin funcionar el 2026-07-27: sin la
-- política de subida, el archivo nunca llegaba y el servidor cotejaba una foto
-- inexistente. La lección es la misma: aquí lo que falla no da error, da vacío.
drop policy if exists "mensajes_obj_select_participante" on storage.objects;
create policy "mensajes_obj_select_participante" on storage.objects
  for select to public
  using (
    bucket_id = 'mensajes'
    and (
      (storage.foldername(name))[1] = (select current_usuario_id())::text
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = storage.objects.name
          and m.para_id = (select current_usuario_id())
      )
    )
  );

-- No se añade política de DELETE a propósito: en un canal confidencial, poder
-- borrar el adjunto de una conversación ya entregada es una decisión de negocio
-- (¿lo borra quien lo mandó?, ¿queda rastro?), no un detalle técnico. Mientras no
-- se decida, nadie borra desde el cliente.

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como empleado) subir a mensajes/<mi_id>/x.jpg           -> OK
--   (como empleado) subir a mensajes/<id_de_otro>/x.jpg      -> rechazado
--   (como psicóloga) leer mensajes/<id_empleado>/x.jpg
--       ANTES de insertar el mensaje  -> rechazado (aún no le va dirigido)
--       DESPUÉS de insertarlo         -> OK
--   (como un tercero) leerlo          -> rechazado
--
--   insert into mensajes (de_id, para_id) values (...);  -> lo rechaza el CHECK
--
-- ROLLBACK:
--   drop policy if exists "mensajes_obj_select_participante" on storage.objects;
--   drop policy if exists "mensajes_obj_insert_own" on storage.objects;
--   delete from storage.buckets where id = 'mensajes';
--   alter table public.mensajes drop constraint if exists mensajes_contenido_no_vacio;
--   alter table public.mensajes alter column texto set not null;
--   drop index if exists idx_mensajes_adjunto_path;
--   alter table public.mensajes drop column if exists adjunto_meta, ... ;
-- ----------------------------------------------------------------------------
