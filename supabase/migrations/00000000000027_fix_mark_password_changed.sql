-- ============================================================================
-- Fix: el trigger anti-escalación (mig 025) bloqueaba el cambio de contraseña.
--
-- Síntoma: un usuario con contraseña temporal (emp123) no podía completar el
-- cambio forzado; recibía "No autorizado: solo puedes cambiar tu foto de perfil".
--
-- Causa: mark_password_changed() (mig 020) hace UPDATE de debe_cambiar_password,
-- y el trigger prevent_usuario_privilege_escalation() (mig 025) — que restringe
-- el self-update de un no-admin/rh a SOLO avatar_url — interpretaba ese cambio
-- como no permitido y abortaba. La RPC es SECURITY DEFINER (salta RLS), pero el
-- trigger igual se ejecuta y current_role() sigue viendo al empleado.
--
-- Solución: la RPC marca una señal local a la transacción
-- (app.marking_password_changed) que el trigger exime SOLO en ese caso. Un
-- empleado no puede activar la señal por su cuenta (PostgREST no permite
-- set_config previo al update en la misma transacción), así que no se reabre la
-- superficie de escalación cerrada por la mig 025.
-- ============================================================================

create or replace function public.mark_password_changed()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Señal local a la transacción: autoriza el UPDATE de debe_cambiar_password.
  perform set_config('app.marking_password_changed', 'on', true);
  update public.usuarios
  set debe_cambiar_password = false
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
  -- EXCEPTO cuando la RPC legítima mark_password_changed() está marcando el
  -- cambio de contraseña forzado (señal app.marking_password_changed = 'on').
  if public.current_role() not in ('admin', 'rh')
     and new.id = public.current_usuario_id()
     and coalesce(current_setting('app.marking_password_changed', true), 'off') <> 'on' then
    if (to_jsonb(new) - 'avatar_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil.';
    end if;
  end if;

  return new;
end;
$$;
