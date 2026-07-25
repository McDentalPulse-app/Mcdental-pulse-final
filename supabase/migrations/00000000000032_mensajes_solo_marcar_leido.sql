-- ============================================================================
-- El receptor de un mensaje solo puede marcarlo como leído (hallazgo L1).
--
-- La policy `mensajes_update_mark_read` (mig 016, reescrita en la 028) concede UPDATE
-- de la fila entera a quien la recibe:
--
--     using (para_id = (select public.current_usuario_id()))
--
-- El nombre dice "mark_read", pero RLS es row-level: no restringe columnas. El receptor
-- podía reescribir el `texto` del mensaje que le mandaron, cambiar el `de_id` para
-- atribuírselo a otra persona, o mover la `fecha`. En una app donde la psicóloga y los
-- empleados se escriben sobre su salud mental, poder alterar lo que otro dijo no es
-- aceptable.
--
-- Mismo patrón que ya se usa en public.usuarios (prevent_usuario_privilege_escalation,
-- mig 023/025): la policy autoriza la fila, y un trigger acota las COLUMNAS.
-- ============================================================================

create or replace function public.prevent_mensaje_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- El emisor no tiene policy de UPDATE, así que aquí solo puede llegar el receptor
  -- (mensajes_update_mark_read) o un rol privilegiado. Se comparan todas las columnas
  -- salvo `leido`: si cambió cualquier otra cosa, se aborta.
  if (to_jsonb(new) - 'leido') is distinct from (to_jsonb(old) - 'leido') then
    raise exception 'No autorizado: de un mensaje recibido solo puedes cambiar si está leído.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mensajes_prevent_tampering on public.mensajes;

create trigger trg_mensajes_prevent_tampering
  before update on public.mensajes
  for each row
  execute function public.prevent_mensaje_tampering();

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (autenticado como el receptor de un mensaje):
--
--   update public.mensajes set leido = true where para_id = public.current_usuario_id();
--     -> OK. Es lo único que la app necesita (marcarMensajesLeidos en useAppActions).
--
--   update public.mensajes set texto = 'reescrito' where para_id = public.current_usuario_id();
--     -> debe FALLAR: "solo puedes cambiar si está leído".
--
--   update public.mensajes set de_id = <otro> where para_id = public.current_usuario_id();
--     -> debe FALLAR.
--
-- ROLLBACK:
--   drop trigger if exists trg_mensajes_prevent_tampering on public.mensajes;
--   drop function if exists public.prevent_mensaje_tampering();
-- ----------------------------------------------------------------------------
