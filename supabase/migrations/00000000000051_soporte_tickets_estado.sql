-- ============================================================================
-- Caché del último estado conocido de cada ticket de soporte (MCTIC).
--
-- MCTIC es un sistema externo y no manda webhook cuando un ticket cambia de estado: lo único
-- que se puede hacer es preguntarle de vez en cuando. Esta tabla es la "última foto" contra la
-- que se compara cada consulta (api/revisar-tickets.js, cron cada 15 minutos): si el estado que
-- devuelve MCTIC no coincide con el que quedó guardado aquí, cambió, y se avisa por push.
--
-- La primera vez que se ve un ticket no se avisa (solo se siembra la fila): de lo contrario, el
-- primer barrido tras desplegar esto mandaría un push de "cambió de estado" por cada ticket que
-- ya existiera de antes, aunque no haya pasado nada.
-- ============================================================================

create table if not exists public.soporte_tickets_estado (
  id             bigint generated always as identity primary key,
  empleado_id    uuid not null references public.usuarios(id) on delete cascade,
  ticket_id      text not null,
  status         text not null,
  actualizado_en timestamptz not null default now(),

  unique (empleado_id, ticket_id)
);

create index if not exists idx_soporte_tickets_estado_empleado
  on public.soporte_tickets_estado (empleado_id);

comment on table public.soporte_tickets_estado is
  'Último estado conocido de cada ticket de MCTIC, para detectar cambios entre un barrido del cron y el siguiente. Nadie la lee ni la escribe desde el navegador: es un caché interno del servidor.';

alter table public.soporte_tickets_estado enable row level security;

-- Explícito en los dos sentidos, como manda la lección de cotejo_intentos (047): nadie del lado
-- cliente necesita tocar esto jamás, ni para leer ni para escribir.
revoke all on public.soporte_tickets_estado from authenticated, anon;
grant select, insert, update, delete on public.soporte_tickets_estado to service_role;

-- Sin policies para authenticated/anon: RLS activo y sin una sola regla deniega todo acceso de
-- cliente por defecto. Solo la service role (el cron) la toca.


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   drop table if exists public.soporte_tickets_estado;
