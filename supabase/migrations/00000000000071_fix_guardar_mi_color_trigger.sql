-- ============================================================================
-- Fix: el trigger anti-escalación (mig 025/027) bloqueaba guardar el color.
--
-- Síntoma: en producción, un empleado (no admin/rh) recibía el error "no se
-- puede aplicar el color" al elegir uno. admin/rh sí podían.
--
-- Causa: guardar_mi_color() (mig 070) hace UPDATE de color_acento, y el trigger
-- prevent_usuario_privilege_escalation() (mig 027) — que restringe el self-update
-- de un no-admin/rh a SOLO avatar_url — interpretaba ese cambio como no permitido
-- y abortaba ("solo puedes cambiar tu foto de perfil"). La RPC es SECURITY DEFINER
-- (salta RLS), pero el trigger igual se ejecuta y current_role() sigue viendo al
-- empleado.
--
-- Solución: mismo patrón que mark_password_changed (mig 027). La RPC marca una
-- señal local a la transacción (app.setting_color_acento) que el trigger exime
-- SOLO en ese caso. Un empleado no puede activar la señal por su cuenta (PostgREST
-- no permite set_config previo al update en la misma transacción), así que no se
-- reabre la superficie de escalación cerrada por la mig 025.
-- ============================================================================

create or replace function public.guardar_mi_color(p_color text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Color inválido: debe ser un hex #RRGGBB o null';
  end if;

  -- Señal local a la transacción: autoriza el UPDATE de color_acento.
  perform set_config('app.setting_color_acento', 'on', true);
  update public.usuarios
  set color_acento = p_color
  where auth_user_id = auth.uid();
end;
$$;

create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
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

  -- Self-service acotado a avatar_url para no-admin/rh sobre su propia fila,
  -- EXCEPTO cuando una RPC legítima marca su señal local a la transacción:
  --   · app.marking_password_changed = 'on'  (mark_password_changed, mig 027)
  --   · app.setting_color_acento    = 'on'  (guardar_mi_color, este fix)
  if public.current_role() not in ('admin', 'rh')
     and new.id = public.current_usuario_id()
     and coalesce(current_setting('app.marking_password_changed', true), 'off') <> 'on'
     and coalesce(current_setting('app.setting_color_acento', true), 'off') <> 'on' then
    if (to_jsonb(new) - 'avatar_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil.';
    end if;
  end if;

  return new;
end;
$$;
