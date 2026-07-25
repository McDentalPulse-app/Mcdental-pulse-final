-- ============================================================================
-- El interruptor: ¿hace falta tener el rostro registrado para poder checar?
--
-- EL AGUJERO QUE CIERRA. Hasta ahora, quien no tuviera rostro aprobado podía checar sin
-- cotejo (la checada salía "no comprobada"). Durante el despliegue eso es obligatorio: si
-- exiges rostro desde el minuto uno, el primer día NO FICHA NADIE — toda la plantilla llega
-- sin registrar y RH tiene sesenta aprobaciones pendientes mientras la gente espera en la
-- puerta.
--
-- Pero en cuanto todos están registrados, ese hueco se convierte en la puerta de salida
-- evidente: basta con NO registrarse nunca para que el cotejo no te aplique. El control se
-- esquiva no haciendo nada.
--
-- Por eso es un interruptor y no una constante: nace apagado (todos pueden checar mientras
-- se registran) y admin lo enciende cuando la plantilla ya está cubierta. A partir de ahí,
-- sin rostro aprobado no hay checada.
--
-- Una fila única, a propósito. No es una tabla de "configuración genérica" con claves y
-- valores sueltos: es un ajuste concreto, con su columna y su tipo, que la base puede
-- validar. Una tabla clave-valor acepta 'exijir_rostro' = 'sí' sin rechistar.
-- ============================================================================

create table if not exists public.ajustes (
  id             boolean primary key default true check (id),  -- fuerza una única fila
  exigir_rostro  boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.usuarios(id)
);

comment on table public.ajustes is
  'Ajustes globales. UNA sola fila (el check sobre la pk lo garantiza). Ver migración 044.';
comment on column public.ajustes.exigir_rostro is
  'true = sin rostro APROBADO no se puede checar. Nace en false: encenderlo el primer día dejaría a toda la plantilla sin poder fichar. Se enciende cuando ya están todos registrados.';

insert into public.ajustes (id) values (true) on conflict (id) do nothing;

alter table public.ajustes enable row level security;

grant select on public.ajustes to authenticated;
grant select, update on public.ajustes to service_role;

-- Lo lee todo el mundo: el checador necesita saber si tiene que exigir rostro para poder
-- avisar al empleado ANTES de que se plante delante de la cámara.
drop policy if exists ajustes_select_autenticados on public.ajustes;
create policy ajustes_select_autenticados
  on public.ajustes for select
  using ((select public.current_role()) is not null);

-- Lo cambia solo admin. Encender esto es dejar sin fichar a quien no esté registrado: no es
-- un ajuste de decoración.
drop policy if exists ajustes_update_admin on public.ajustes;
create policy ajustes_update_admin
  on public.ajustes for update
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

-- Sin DELETE ni INSERT: la fila es una y ya existe.

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   insert into public.ajustes (id) values (true);   -> falla (clave duplicada)
--   insert into public.ajustes (id) values (false);  -> falla (check id)
--     La tabla no puede tener dos filas ni una fila "falsa". El ajuste es único por diseño.
--
--   (como rh) update public.ajustes set exigir_rostro = true;  -> UPDATE 0 (solo admin)
--
-- ROLLBACK:
--   drop table if exists public.ajustes;
-- ----------------------------------------------------------------------------
