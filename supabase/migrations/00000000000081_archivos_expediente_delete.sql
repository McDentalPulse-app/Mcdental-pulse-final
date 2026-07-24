-- ============================================================================
-- Permite ELIMINAR archivos del expediente (tabla + storage) a gestión.
--
-- Motivo: quien sube un archivo al expediente a veces se equivoca de archivo, y hasta ahora no
-- había forma de borrarlo — la tabla `archivos_expediente` y el bucket `expedientes` solo tenían
-- políticas INSERT y SELECT. Se agregan políticas DELETE para admin/rh/psicologa, con el MISMO
-- criterio de rol que ya usa el INSERT (archivos_expediente_insert_admin_rh_psicologa y
-- expedientes_insert_admin_rh_psicologa). El empleado sigue sin poder borrar nada.
-- ============================================================================

-- 1) Borrado de la fila de metadata.
drop policy if exists archivos_expediente_delete_admin_rh_psicologa on public.archivos_expediente;

create policy archivos_expediente_delete_admin_rh_psicologa on public.archivos_expediente
  for delete using (
    (select public.current_role()) = any (array['admin', 'rh', 'psicologa']::rol_usuario[])
  );

-- 2) Borrado del objeto en el bucket privado 'expedientes'.
drop policy if exists expedientes_delete_admin_rh_psicologa on storage.objects;

create policy expedientes_delete_admin_rh_psicologa on storage.objects
  for delete using (
    bucket_id = 'expedientes'
    and (select public.current_role()) = any (array['admin', 'rh', 'psicologa']::rol_usuario[])
  );
