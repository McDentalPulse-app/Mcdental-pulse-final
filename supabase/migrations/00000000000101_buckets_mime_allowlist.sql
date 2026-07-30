-- Cierra la subida de contenido ejecutable a los buckets. (Auditoría 2026-07-30)
--
-- EL AGUJERO: los 7 buckets tenían `allowed_mime_types = null`, es decir, CERO validación
-- de tipo en el servidor. `avatars` y `banners` son además PÚBLICOS y se sirven desde
-- mcdentalpulse.duckdns.org/storage/... — el MISMO ORIGEN que la app.
--
-- La interfaz sí valida: avatarService re-codifica por canvas a JPEG y fuerza
-- contentType 'image/jpeg'. Pero eso es validación de cliente, y la app le entrega al
-- navegador la anon key y el JWT del usuario. Cualquiera con sesión podía saltarse la
-- pantalla y llamar directo a la API de storage:
--
--   supabase.storage.from('avatars')
--     .upload(`${miId}.jpg`, htmlMalicioso, { contentType: 'text/html' })
--
-- La policy solo comprueba que el nombre sea `<su-uuid>.jpg`; no mira el contenido ni el
-- tipo declarado. El archivo se servía con Content-Type: text/html desde el origen de la
-- app -> XSS almacenado -> robo de la sesión de quien abriera el enlace.
--
-- X-Content-Type-Options: nosniff NO protege aquí: hace que el navegador CONFÍE en el tipo
-- declarado, y el declarado era HTML. Y la CSP estaba en Report-Only, sin bloquear nada.
--
-- POR QUÉ DOS LISTAS Y NO UNA: `mensajes` y `expedientes` sí reciben documentos — el
-- composer del chat tiene un segundo input de archivo SIN `accept`, a propósito. Poner
-- "solo imágenes" en todos los buckets habría roto los adjuntos. Lo que se excluye en esos
-- dos es lo ejecutable: svg (lleva <script>) y html.
--
-- POR QUÉ LAS IMÁGENES VAN UNA A UNA Y EL AUDIO CON COMODÍN — probado contra un Supabase
-- real antes de escribir esto, no deducido:
--
--   · `image/*` NO se usa: dejaría pasar image/svg+xml, que es exactamente el vector que
--     esta migración cierra (un SVG lleva <script> dentro). Verificado: con lista explícita,
--     svg -> 415 invalid_mime_type.
--   · `audio/*` SÍ se usa, y es obligatorio: Supabase compara la cadena COMPLETA, y la
--     grabadora de notas de voz produce "audio/webm;codecs=opus" (utils/audio.js). Con la
--     lista explícita 'audio/webm' esa subida daba 415 y las notas de voz se habrían roto
--     en Chrome y Android. Con el comodín pasa, y text/html y svg siguen rechazados.
--
-- COMPROBADO ANTES DE APLICAR: en producción solo hay image/jpeg (282 archivos) e
-- image/png (2). Ninguna subida existente queda fuera de la lista.
--
-- REVERTIR: update storage.buckets set allowed_mime_types = null;

begin;

-- Buckets de foto: por diseño solo llevan imágenes. Aquí están los dos públicos, que son
-- el vector real.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('avatars', 'banners', 'rostros', 'asistencias', 'comisiones');

-- Buckets de adjuntos: imágenes y documentos. Sin svg ni html.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  -- Notas de voz. Comodín A PROPÓSITO: la grabadora manda el mime con parámetro
  -- ("audio/webm;codecs=opus") y Supabase compara la cadena entera. Ver cabecera.
  'audio/*'
]
where id in ('mensajes', 'expedientes');

commit;
