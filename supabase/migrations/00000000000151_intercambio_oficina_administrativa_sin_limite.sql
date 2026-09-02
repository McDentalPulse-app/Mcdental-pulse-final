-- ============================================================================
-- Intercambio de festivos: exclusividad de fecha_destino POR SUCURSAL (documentando lo ya
-- aplicado en la VPS a mano, sin migración) + Oficina Administrativa TOTALMENTE sin límite.
--
-- LO QUE YA CORRE EN PRODUCCIÓN, nunca commiteado: en algún momento se cambió la exclusividad de
-- la migración 075 (un solo dueño por fecha_destino en TODA la empresa) a una exclusividad POR
-- SUCURSAL: dos personas de sucursales distintas SÍ pueden compartir fecha_destino, y solo chocan
-- si son de la MISMA sucursal. Esta migración empieza reproduciendo exactamente eso (columna,
-- trigger, índice — misma definición que la VPS, vía pg_get_functiondef) para que el repo deje de
-- estar desincronizado, y LUEGO agrega lo que pidió el dueño: Oficina Administrativa queda
-- TOTALMENTE fuera de la exclusividad — ni siquiera choca entre sí misma.
--
-- Sin esto, cualquier ambiente nuevo (o un rollback) se quedaría con el esquema viejo de la
-- migración 075 (uniq_intercambio_destino, global) en vez del que en verdad está corriendo.
-- ============================================================================

-- 1) Reproducir lo que ya existe en la VPS (nunca llegó a una migración) --------------------

alter table public.intercambios_dia add column if not exists sucursal text;

-- Snapshot de la sucursal de quien pide, al momento de pedir (RH nunca cambia fecha_destino
-- después, solo estado — el snapshot no necesita refrescarse).
create or replace function public.intercambios_sellar_sucursal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  select u.sucursal into new.sucursal
    from public.usuarios u
   where u.id = new.empleado_id;
  return new;
end;
$$;

drop trigger if exists sellar_sucursal_intercambio on public.intercambios_dia;
create trigger sellar_sucursal_intercambio
  before insert on public.intercambios_dia
  for each row execute function public.intercambios_sellar_sucursal();

-- Backfill de las filas que se hayan colado sin sucursal (columna nueva en un ambiente nuevo).
update public.intercambios_dia i
   set sucursal = u.sucursal
  from public.usuarios u
 where u.id = i.empleado_id
   and i.sucursal is null;

-- El índice viejo de la migración 075 (global) ya no debe existir en ningún ambiente: lo
-- reemplazó el de abajo. `if exists` porque en la VPS ya no está.
drop index if exists public.uniq_intercambio_destino;

-- 2) Lo nuevo: Oficina Administrativa queda fuera de la exclusividad por completo -----------
--
-- NULLS NOT DISTINCT: dos filas con sucursal NULL para la misma fecha también deberían chocar
-- (si no, un dato corrupto sin sucursal se colaría sin exclusividad de ningún tipo).
drop index if exists public.uniq_intercambio_destino_sucursal;

-- El literal de abajo (y su gemelo en la función) debe reflejar SUCURSAL_ALIASES de
-- src/utils/constants.js — "Oficina Central" y "Central" son el mismo puesto con nombre legacy
-- en usuarios.sucursal, así que también deben quedar sin límite.
create unique index uniq_intercambio_destino_sucursal
  on public.intercambios_dia (sucursal, fecha_destino) nulls not distinct
  where estado <> 'rechazado'
    and coalesce(sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central');

-- La RPC que el calendario usa para deshabilitar días "ya ocupados" (CalendarioIntercambio.jsx)
-- ya filtraba por la sucursal de quien pregunta (coherente con la exclusividad por sucursal).
-- Se agrega la misma exclusión: para alguien de Oficina Administrativa, nunca debe verse ningún
-- día como ocupado.
create or replace function public.intercambios_destinos_ocupados()
returns setof date
language sql stable security definer set search_path to 'public'
as $$
  select i.fecha_destino
    from public.intercambios_dia i
   where i.estado <> 'rechazado'
     and coalesce(i.sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central')
     and i.sucursal is not distinct from (
           select u.sucursal from public.usuarios u where u.id = public.current_usuario_id()
         );
$$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (empleado A, McDental Palmas) insert destino='2026-10-05'                  -> OK
--   (empleado B, McDental Madero) insert destino='2026-10-05'                  -> OK (sucursal distinta, ya funciona hoy)
--   (empleado C, McDental Palmas, MISMA sucursal que A) insert destino='2026-10-05' -> DEBE FALLAR (23505)
--   (empleado D, Oficina Administrativa) insert destino='2026-10-06'           -> OK
--   (empleado E, TAMBIÉN Oficina Administrativa) insert destino='2026-10-06'   -> OK (antes de este cambio, hubiera fallado)
--   (como D) select * from intercambios_destinos_ocupados();  -> NO debe incluir '2026-10-06'
-- ----------------------------------------------------------------------------
