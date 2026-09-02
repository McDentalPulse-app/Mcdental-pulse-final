-- ============================================================================
-- Ticket de arranque para el primer admin_plus — atómico y de un solo uso.
--
-- La primera versión de esta feature dejaba "arrancar" a cualquiera de
-- admin/rh/psicologa con solo comprobar `count(*) = 0` (mig. 140 original, ver
-- revisión de seguridad): dos huecos reales, no teóricos:
--   1. Identidad: rh o psicologa podían ser ellos mismos el "primer" admin_plus,
--      exactamente el ataque que esta feature existe para cerrar.
--   2. Carrera: dos solicitudes al mismo tiempo pasan el `count=0` ANTES de que
--      cualquiera de las dos escriba, y las dos terminan siendo admin_plus.
--
-- Esta tabla es un ticket de un solo lugar (`id` fijo, PK) que se reclama con un
-- solo UPDATE ... WHERE ... — Postgres serializa esto solo: la segunda
-- transacción concurrente espera el lock de fila de la primera, y cuando lo
-- obtiene, `usado` ya es true y su UPDATE no toca ninguna fila. Sin advisory
-- lock a mano: el propio UPDATE es la sección crítica.
-- ============================================================================

create table public.bootstrap_admin_plus (
  id boolean primary key default true,
  usado boolean not null default false,
  constraint bootstrap_admin_plus_singleton check (id)
);

insert into public.bootstrap_admin_plus (id, usado) values (true, false);

alter table public.bootstrap_admin_plus enable row level security;
-- Sin policies: nadie toca esta tabla directo, solo a través de la función de
-- abajo (security definer). RLS activada y sin permisos = bloqueada por defecto.

-- Reclama el ticket. Devuelve true UNA sola vez en la vida del sistema, y solo
-- para quien YA es 'admin' de verdad (rol_real(), sin plegar admin_plus->admin
-- ni contar rh/psicologa) — cierra el hueco de identidad, no solo el de carrera.
create or replace function public.reclamar_bootstrap_admin_plus()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.rol_real() is distinct from 'admin' then
    return false;
  end if;

  update public.bootstrap_admin_plus
  set usado = true
  where id = true and usado = false;

  return found;
end;
$$;

revoke all on function public.reclamar_bootstrap_admin_plus() from public;
grant execute on function public.reclamar_bootstrap_admin_plus() to authenticated;
