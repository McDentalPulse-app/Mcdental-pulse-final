-- Cuentas ocultas: siguen activas de verdad (checador, login, nómina se les sigue
-- calculando) pero no aparecen en ninguna lista ni reporte de cara al admin/RH.
--
-- Distinto de `archivado` (baja, implica inactivo = true, bloquea el login) y de
-- `inactivo` (bloquea el login): `oculto` NO toca ninguna de las dos capas de
-- autenticación ni el checador — solo es una señal para que el FRONTEND filtre a esa
-- persona de las listas (Gestión de Personal la sigue mostrando, con un filtro aparte,
-- para poder deshacerlo).
--
-- Caso de uso (pedido del dueño, 2026-09-21): cuentas que existen y siguen operando
-- (checan, cobran) pero que RH no quiere ver mezcladas en las pantallas del día a día.

alter table public.usuarios
  add column if not exists oculto boolean not null default false;

comment on column public.usuarios.oculto is
  'Oculta a la persona de listas y reportes sin afectar login, checador ni nómina. No implica inactivo ni archivado.';

create index if not exists idx_usuarios_oculto
  on public.usuarios (oculto)
  where oculto;

-- No hacen falta policies nuevas: `usuarios_update_admin_rh` (mig 023) ya cubre el
-- UPDATE para admin/rh, y el trigger prevent_usuario_privilege_escalation solo vigila
-- `role` y `auth_user_id`.
