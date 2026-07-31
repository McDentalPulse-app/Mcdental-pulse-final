-- Cierra el último hueco de la paridad de la psicóloga en la pantalla de Rostros.
--
-- La migración 052 le dio a psicologa SELECT sobre `public.rostros` y sobre el bucket
-- 'asistencias', y también INSERT/UPDATE sobre el bucket 'rostros'. Pero se saltó las dos
-- piezas que hacen falta justamente para MIRAR una cara:
--
--   1. `public.rostro_fotos` (SELECT) — la tabla que guarda `selfie_path`. Sin ella, el
--      `rostro_fotos(selfie_path)` que pide rostrosService.js vuelve como lista vacía y la
--      pantalla dibuja la tarjeta del pendiente sin una sola foto dentro.
--   2. `storage.objects` (SELECT, bucket 'rostros') — sin ella `createSignedUrl` falla,
--      así que aunque llegara la ruta, la imagen no cargaría.
--
-- Efecto medido antes del arreglo, simulando la sesión de la psicóloga: 38 rostros
-- visibles, 0 fotos, 0 objetos de storage. El admin, en la misma consulta: 38 / 152 / 152.
-- Por eso a ella la pantalla le salía vacía y a él no.
--
-- Esto importa más de lo que parece: aprobar un rostro es afirmar "esta cara es la de esta
-- persona". Si quien aprueba no puede ver la foto, o aprueba a ciegas —y el cotejo pasa de
-- detectar la suplantación a certificarla— o no aprueba nadie y la gente se queda sin poder
-- checar. Las dos salidas son malas.
--
-- No se editan migraciones ya aplicadas: se sueltan y recrean las policies afectadas.

-- ================= rostro_fotos (tabla): SELECT =================
drop policy if exists rostro_fotos_select_admin_rh on public.rostro_fotos;
create policy rostro_fotos_select_gestion
  on public.rostro_fotos for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- ================= storage: bucket 'rostros' (ver las fotos de referencia) =================
drop policy if exists rostros_select_admin_rh_storage on storage.objects;
create policy rostros_select_gestion_storage
  on storage.objects for select
  using (
    bucket_id = 'rostros'
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   drop policy if exists rostro_fotos_select_gestion on public.rostro_fotos;
--   create policy rostro_fotos_select_admin_rh on public.rostro_fotos for select
--     using ((select public.current_role()) in ('admin', 'rh'));
--   drop policy if exists rostros_select_gestion_storage on storage.objects;
--   create policy rostros_select_admin_rh_storage on storage.objects for select
--     using (bucket_id = 'rostros' and (select public.current_role()) in ('admin', 'rh'));
