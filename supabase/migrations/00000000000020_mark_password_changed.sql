-- usuarios solo tiene UPDATE policy para admin/rh (usuarios_update_admin_rh).
-- Un usuario normal necesita poder marcar su propia fila como
-- "ya cambié la contraseña" sin poder tocar ningún otro campo (rol, sucursal, etc).
-- security definer + WHERE acotado a auth.uid() + único campo hardcodeado:
-- no abre superficie de escalación de privilegios.
create or replace function public.mark_password_changed()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.usuarios
  set debe_cambiar_password = false
  where auth_user_id = auth.uid();
end;
$$;

grant execute on function public.mark_password_changed() to authenticated;
