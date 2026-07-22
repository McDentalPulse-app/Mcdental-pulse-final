-- Color de marca personalizable por usuario.
-- Cada persona elige el color de la app (login + todas las pestañas). Se guarda
-- en su propia fila. null = color por defecto (teal de McDental).
alter table public.usuarios
  add column color_acento text;

-- Solo se acepta un hex #RRGGBB o null (volver al default). Blinda la columna
-- contra basura aunque el cliente valide antes.
alter table public.usuarios
  add constraint usuarios_color_acento_formato
  check (color_acento is null or color_acento ~ '^#[0-9A-Fa-f]{6}$');

-- usuarios solo tiene UPDATE policy para admin/rh (usuarios_update_admin_rh).
-- Un usuario normal necesita poder guardar SU propio color sin poder tocar
-- ningún otro campo. Mismo patrón que mark_password_changed (migración ...020):
-- security definer + WHERE acotado a auth.uid() + único campo escrito.
create or replace function public.guardar_mi_color(p_color text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Color inválido: debe ser un hex #RRGGBB o null';
  end if;

  update public.usuarios
  set color_acento = p_color
  where auth_user_id = auth.uid();
end;
$$;

grant execute on function public.guardar_mi_color(text) to authenticated;
