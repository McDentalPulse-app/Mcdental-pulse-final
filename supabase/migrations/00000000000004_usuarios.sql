-- Tabla de perfiles, vinculada 1:1 a auth.users
create table public.usuarios (
  id                          uuid primary key default gen_random_uuid(),
  auth_user_id                uuid unique references auth.users(id) on delete cascade,
  legacy_id                   integer unique,           -- id numérico viejo de Firestore, solo para la migración
  name                        text not null,
  username                    text not null unique,     -- login, minúsculas, sin espacios (saneado en migración)
  synthetic_email             text not null unique,     -- {username}@mcdental.internal, debe == auth.users.email
  role                        public.rol_usuario not null default 'empleado',
  sucursal                    text,
  puesto                      text,
  telefono                    text,
  email                       text,                      -- email real de contacto (opcional), distinto del sintético
  fecha_ingreso               date,
  fecha_cumpleanos            text,                      -- formato "MM-DD", se preserva tal cual
  fecha_nacimiento            date,
  inactivo                    boolean not null default false,
  debe_cambiar_password       boolean not null default true,
  password_restablecido_en    timestamptz,
  password_restablecido_por   uuid references public.usuarios(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger trg_usuarios_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

create index idx_usuarios_role on public.usuarios(role);
create index idx_usuarios_auth_user_id on public.usuarios(auth_user_id);
