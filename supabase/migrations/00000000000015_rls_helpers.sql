-- Funciones helper security definer: evitan recursión de RLS al leer
-- public.usuarios desde las propias policies de public.usuarios.
create or replace function public.current_usuario_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.usuarios where auth_user_id = auth.uid();
$$;

create or replace function public.current_role()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$
  select role from public.usuarios where auth_user_id = auth.uid();
$$;
