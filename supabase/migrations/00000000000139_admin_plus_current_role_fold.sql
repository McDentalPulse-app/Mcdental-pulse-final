-- ============================================================================
-- Rol 'admin_plus' (parte 2/3): admin_plus hereda TODO lo que hoy es admin en RLS,
-- sin tocar cada política una por una.
--
-- current_role() es la función que casi todas las policies de este repo usan para
-- decidir acceso (`current_role() in ('admin', ...)`, `= any(array['admin',...])`).
-- Se pliega admin_plus -> admin en lo que ESTA función devuelve: las ~30 policies
-- existentes ganan a admin_plus solas, con un solo archivo.
--
-- rol_real() es nueva: el cuerpo que current_role() tenía HASTA esta migración
-- (sin plegar). Se usa donde sí hace falta distinguir admin_plus de admin de verdad
-- (la jerarquía de la migración 140, y el módulo Checador).
-- ============================================================================

create or replace function public.rol_real()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$
  select role from public.usuarios where auth_user_id = auth.uid();
$$;

create or replace function public.current_role()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$
  select case when role = 'admin_plus' then 'admin'::public.rol_usuario else role end
  from public.usuarios where auth_user_id = auth.uid();
$$;
