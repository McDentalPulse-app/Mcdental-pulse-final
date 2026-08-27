-- Sube el tope del video de avisos de 50 MB a 200 MB (pedido del dueño). Mismo bucket,
-- mismo formato (solo MP4) — no se toca nada más de la migración 129.

update storage.buckets
set file_size_limit = 209715200
where id = 'avisos-videos';

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select file_size_limit from storage.buckets where id = 'avisos-videos'; -> 209715200
--
-- ROLLBACK:
--   update storage.buckets set file_size_limit = 52428800 where id = 'avisos-videos';
-- ----------------------------------------------------------------------------
