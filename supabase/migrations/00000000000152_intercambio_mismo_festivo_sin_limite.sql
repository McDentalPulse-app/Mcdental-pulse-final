-- ============================================================================
-- Pedir el MISMO festivo como destino: avisar que no vienes ese día, sin canjearlo por otro.
--
-- Hasta ahora `intercambio` significaba únicamente "trabajo el festivo X, dame Y libre a
-- cambio" — fecha_festivo y fecha_destino siempre tenían que ser distintas (api/solicitar-
-- intercambio.js lo rechazaba con 400 explícito). El dueño pidió lo contrario: dejar que
-- alguien pida el MISMO festivo como destino, para usar esta misma pantalla como aviso formal
-- de que no va a venir ese día — es el protocolo real de la empresa, aunque el festivo ya sea
-- descanso para todos.
--
-- El problema no era solo quitar la validación: el índice único (sucursal, fecha_destino) de
-- las migraciones 113/151 trata fecha_destino como un recurso escaso por sucursal — un solo
-- dueño por fecha. Eso tiene sentido cuando de verdad se está pidiendo UN DÍA DISTINTO al
-- festivo (dos personas no pueden llevarse el mismo martes libre). Pero cuando fecha_destino =
-- fecha_festivo, NO hay nada escaso: es un festivo, todo el mundo ya tiene derecho a no venir.
-- Sin esta migración, la primera persona en "avisar" se quedaría con el cupo y a la segunda le
-- saldría "alguien ya apartó ese día" — falso, nadie apartó nada, el día es libre para todos.
--
-- Por eso el caso fecha_destino = fecha_festivo queda FUERA del índice único y FUERA de lo que
-- intercambios_destinos_ocupados() marca como tomado — no compite con nada, cada quien registra
-- su propio aviso.
-- ============================================================================

drop index if exists public.uniq_intercambio_destino_sucursal;

create unique index uniq_intercambio_destino_sucursal
  on public.intercambios_dia (sucursal, fecha_destino)
  nulls not distinct
  where estado <> 'rechazado'
    and coalesce(sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central')
    and fecha_destino <> fecha_festivo;

create or replace function public.intercambios_destinos_ocupados()
returns setof date
language sql stable security definer set search_path to 'public'
as $$
  select i.fecha_destino
    from public.intercambios_dia i
   where i.estado <> 'rechazado'
     and i.fecha_destino <> i.fecha_festivo
     and coalesce(i.sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central')
     and i.sucursal is not distinct from (
           select u.sucursal from public.usuarios u where u.id = public.current_usuario_id()
         );
$$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (empleado A, McDental Palmas) insert festivo=destino='2026-10-16' (Independencia)  -> OK
--   (empleado B, MISMA sucursal, TAMBIÉN festivo=destino='2026-10-16')                 -> OK
--     (antes de esta migración, B hubiera chocado con 23505 contra A)
--   (empleado C, MISMA sucursal) insert festivo='2026-10-16' destino='2026-10-20'       -> OK
--     (canje real, sigue exclusivo: sigue usando el índice de siempre)
--   (empleado D, MISMA sucursal, TAMBIÉN quiere destino='2026-10-20')                   -> FALLA (23505)
--     (el canje real por un día distinto sigue siendo exclusivo, sin cambios)
--   (como A) select * from intercambios_destinos_ocupados();
--     -> NO debe incluir '2026-10-16' (nadie ve ese día como "tomado" por otro)
--     -> SÍ debe incluir '2026-10-20' (canje real de C, sigue bloqueando a los demás)
-- ----------------------------------------------------------------------------
