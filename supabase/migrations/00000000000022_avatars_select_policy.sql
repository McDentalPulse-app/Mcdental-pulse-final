-- Falta esta policy: "bucket público" solo habilita el endpoint público de
-- descarga (/storage/v1/object/public/...), pero storage.objects sigue
-- necesitando su propia policy de SELECT para que el servicio de Storage
-- pueda resolver metadata (ej. decidir upsert vs insert al subir). Sin esto,
-- el upload fallaba con "new row violates row-level security policy" aunque
-- la policy de INSERT era correcta — confirmado con current_role() devolviendo
-- 'admin' correctamente vía RPC, descartando un problema de esa función.
create policy avatars_select_public
  on storage.objects for select
  using (bucket_id = 'avatars');
