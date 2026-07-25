-- Baja "blanda" de personal: archivar en vez de borrar.
--
-- Hasta ahora había un solo estado (`inactivo`), que sirve para "ya no entra a la app
-- pero sigue en la lista". Faltaba el caso de la baja real (renuncia, despido): que
-- desaparezca de Gestión de Personal sin perder su historial — y sobre todo, que se
-- pueda deshacer si se archivó a la persona equivocada.
--
-- Archivar NO borra nada: ni checadas, ni encuestas, ni fotos de rostro. Es la
-- alternativa deliberada al DELETE en cascada, que es irreversible.
--
-- Archivar implica siempre `inactivo = true`: el bloqueo de login ya vive ahí
-- (AuthContext cierra la sesión de quien tenga inactivo, y api/_auth.js lo rechaza),
-- así que no hace falta tocar ninguna de las dos capas de autenticación.

alter table public.usuarios
  add column if not exists archivado boolean not null default false;

comment on column public.usuarios.archivado is
  'Baja blanda: desaparece de Gestión de Personal pero conserva su historial y se puede restaurar. Implica inactivo = true.';

-- Índice parcial: la consulta habitual es "los NO archivados", y los archivados son
-- pocos; un índice sobre todo el booleano no aportaría nada.
create index if not exists idx_usuarios_archivado
  on public.usuarios (archivado)
  where archivado;

-- No hacen falta policies nuevas: `usuarios_update_admin_rh` (mig 023) ya cubre el
-- UPDATE para admin/rh, y el trigger prevent_usuario_privilege_escalation solo vigila
-- `role` y `auth_user_id`, así que no interfiere con esta columna.
