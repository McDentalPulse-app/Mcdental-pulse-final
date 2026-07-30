-- Imagen de banner (portada) en Mi perfil, para los cinco roles.
--
-- Hasta ahora la portada era un degradado fijo (--mc-perfil-cover). Se le añade una
-- imagen propia, con el mismo patrón que la foto de perfil: un bucket público, el
-- archivo nombrado con el id del usuario, y la URL guardada en la fila.
--
-- Tres piezas, y la tercera es la delicada:
--   1. columna usuarios.banner_url
--   2. bucket 'banners' + sus policies (mismo esquema que 'avatars')
--   3. prevent_usuario_privilege_escalation: hay que sumar banner_url a lo que un
--      usuario puede cambiar de su propia fila. Sin esto, guardar el banner falla con
--      "solo puedes cambiar tu foto de perfil" para todos menos admin y rh.

-- ================= 1. columna =================
alter table public.usuarios add column if not exists banner_url text;

-- ================= 2. bucket + policies =================
-- Público como 'avatars': la portada se ve sin firmar la URL. 2 MB de tope server-side,
-- aunque el navegador ya comprime a 1200px de lado mayor antes de subir.
insert into storage.buckets (id, name, public, file_size_limit)
values ('banners', 'banners', true, 2097152)
on conflict (id) do update set public = true, file_size_limit = 2097152;

drop policy if exists banners_select_public on storage.objects;
create policy banners_select_public
  on storage.objects for select
  using (bucket_id = 'banners');

-- El archivo se llama "<id del usuario>.jpg", así que la propia ruta es la que ata cada
-- imagen a su dueño: nadie puede escribir sobre la portada de otro.
drop policy if exists banners_insert_own on storage.objects;
create policy banners_insert_own
  on storage.objects for insert
  with check (bucket_id = 'banners'
              and name = ((select public.current_usuario_id())::text || '.jpg'));

drop policy if exists banners_update_own on storage.objects;
create policy banners_update_own
  on storage.objects for update
  using (bucket_id = 'banners'
         and name = ((select public.current_usuario_id())::text || '.jpg'));

drop policy if exists banners_delete_own on storage.objects;
create policy banners_delete_own
  on storage.objects for delete
  using (bucket_id = 'banners'
         and name = ((select public.current_usuario_id())::text || '.jpg'));

-- ================= 3. trigger anti-escalada =================
-- Se recrea íntegro con un solo cambio: banner_url se resta igual que avatar_url en la
-- comparación del self-service. Las dos guardas de rol (role y auth_user_id solo para
-- admin) quedan EXACTAMENTE como estaban: esto no relaja quién puede cambiar de rol.
create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Guarda original: solo admin puede tocar role / auth_user_id.
  if public.current_role() is distinct from 'admin' then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo un administrador puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo un administrador puede cambiar el vínculo de autenticación.';
    end if;
  end if;

  -- Self-service acotado a avatar_url y banner_url para no-admin/rh sobre su propia fila,
  -- EXCEPTO cuando una RPC legítima marca su señal local a la transacción:
  --   · app.marking_password_changed = 'on'  (mark_password_changed, mig 027)
  --   · app.setting_color_acento    = 'on'  (guardar_mi_color, mig 070)
  if public.current_role() not in ('admin', 'rh')
     and new.id = public.current_usuario_id()
     and coalesce(current_setting('app.marking_password_changed', true), 'off') <> 'on'
     and coalesce(current_setting('app.setting_color_acento', true), 'off') <> 'on' then
    if (to_jsonb(new) - 'avatar_url' - 'banner_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'banner_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil y tu portada.';
    end if;
  end if;

  return new;
end;
$function$;
