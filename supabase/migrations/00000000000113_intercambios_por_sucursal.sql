-- Un intercambio de día bloquea ese día SOLO dentro de la clínica de quien lo pidió.
--
-- Antes el índice único era `(fecha_destino)` a secas: global. Con 26 sucursales y ~100
-- personas, la primera que apartaba el 18 de agosto se lo quitaba a las otras 101 — y sin
-- explicación visible, porque `intercambios_destinos_ocupados` oculta a propósito QUIÉN lo
-- tomó, así que el día solo aparecía deshabilitado. El límite existe para no dejar una
-- clínica corta de gente (la mayoría tienen 2–4 personas activas), y ese motivo no dice
-- nada sobre lo que haga otra clínica a 500 km.

begin;

alter table public.intercambios_dia add column if not exists sucursal text;

-- Las solicitudes que ya existen se quedan con la sucursal actual de su empleado.
update public.intercambios_dia i
   set sucursal = u.sucursal
  from public.usuarios u
 where u.id = i.empleado_id
   and i.sucursal is distinct from u.sucursal;

-- La sucursal la sella el servidor desde el empleado; el cliente no la manda ni la puede
-- falsear. Se copia AL SOLICITAR y no se sigue viva: si alguien cambia de clínica después,
-- su solicitud pertenece a la clínica donde la pidió. Seguir al usuario permitiría que un
-- traslado creara dos personas fuera el mismo día en la misma clínica sin que nadie lo note.
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

-- El índice viejo (global) se va; el nuevo es por clínica.
-- `nulls not distinct` importa: por defecto Postgres considera dos NULL distintos entre sí,
-- así que si algún día hay personas sin sucursal asignada, dos de ellas podrían apartar el
-- mismo día. Hoy no hay ninguna, pero el índice no debe depender de que eso siga siendo así.
drop index if exists public.uniq_intercambio_destino;

create unique index if not exists uniq_intercambio_destino_sucursal
  on public.intercambios_dia (sucursal, fecha_destino)
  nulls not distinct
  where estado <> 'rechazado';

-- Los días que el calendario del empleado pinta como no disponibles: solo los de SU clínica.
create or replace function public.intercambios_destinos_ocupados()
returns setof date
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.fecha_destino
    from public.intercambios_dia i
   where i.estado <> 'rechazado'
     and i.sucursal is not distinct from (
           select u.sucursal from public.usuarios u where u.id = public.current_usuario_id()
         );
$$;

commit;
