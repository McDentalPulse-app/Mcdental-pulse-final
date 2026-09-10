-- ============================================================================
-- 156 — Nómina: sueldo por persona y los montos fijos que se descuentan.
--
-- QUÉ AÑADE. Dos cosas, y nada más:
--   1. `usuarios.sueldo_semanal` — lo que gana cada quien en una semana.
--   2. `nomina_config` — UNA fila con el monto que descuenta un retardo y el que descuenta
--      una falta. Son iguales para toda la empresa y los fija gestión.
--
-- QUÉ NO AÑADE, A PROPÓSITO: ninguna tabla de "nóminas calculadas". El pago de una semana se
-- DERIVA (sueldo − retardos × monto − faltas × monto) de datos que ya existen: las checadas, el
-- horario de cada día y los permisos aprobados. Guardar el resultado obligaría a recalcular todas
-- las filas viejas cada vez que RH justifica una falta del mes pasado o corrige un horario — y el
-- día que ese reproceso fallara, la nómina guardada y la realidad dirían cosas distintas sin que
-- nadie se enterara. Es el mismo criterio con el que `asistencias` no guarda "faltó": ver el
-- encabezado de src/utils/asistencia.js.
--
-- POR QUÉ EL SUELDO VA EN `usuarios` Y NO EN UNA TABLA APARTE. Es un atributo de la persona, uno
-- por persona, con el mismo ciclo de vida que su puesto o su sucursal. Una tabla 1:1 solo añadiría
-- un join y un segundo sitio donde el alta puede olvidarse.
--
-- QUIÉN LO VE (verificado contra las policies vivas de `usuarios`, migs. 030/095/099):
--   · SELECT de `usuarios` = admin, rh, psicologa (`usuarios_select_privilegiados`) + la fila
--     PROPIA de cada quien (`usuarios_select_own`). O sea: gestión ve todos los sueldos, y cada
--     persona ve el suyo y el de nadie más. Eso es lo correcto y es lo que se quería.
--   · La plantilla NO lee esta tabla: lee la vista `usuarios_directorio` (mig. 030), que
--     enumera columnas UNA POR UNA. `sueldo_semanal` no está en esa lista, así que no se filtra
--     por añadirla aquí. SI ALGÚN DÍA SE REESCRIBE ESA VISTA, NO METER ESTA COLUMNA.
--   · UPDATE de `usuarios` = admin, rh, psicologa (`usuarios_update_gestion`, mig. 095). Los
--     mismos tres que pidió el dueño para la pantalla de Nómina.
-- ============================================================================

begin;

-- ── 1. El sueldo de cada persona ────────────────────────────────────────────
-- Nullable a propósito: nace vacío para toda la plantilla y se captura persona a persona. Un
-- default de 0 sería peor que null — diría "esta persona gana cero" en vez de "falta capturarlo",
-- y la pantalla no podría distinguir un sueldo pendiente de un sueldo real.
alter table public.usuarios
  add column if not exists sueldo_semanal numeric(10,2);

alter table public.usuarios
  drop constraint if exists usuarios_sueldo_semanal_no_negativo;
alter table public.usuarios
  add constraint usuarios_sueldo_semanal_no_negativo
  check (sueldo_semanal is null or sueldo_semanal >= 0);

comment on column public.usuarios.sueldo_semanal is
  'Lo que gana la persona en UNA semana, en pesos. NULL = todavía no se ha capturado (distinto de 0). Base del cálculo de la pantalla de Nómina; los descuentos salen de nomina_config. Ver migración 156.';

-- ── 2. Los montos que se descuentan ─────────────────────────────────────────
-- Una fila única, con el mismo patrón que `ajustes` (mig. 044): columnas con su tipo y su
-- check, no una tabla clave-valor genérica. Una clave-valor acepta 'monto_retado' = 'mucho'.
create table if not exists public.nomina_config (
  id              boolean primary key default true check (id),  -- fuerza una única fila
  monto_retardo   numeric(10,2) not null default 0 check (monto_retardo >= 0),
  monto_falta     numeric(10,2) not null default 0 check (monto_falta >= 0),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references public.usuarios(id)
);

comment on table public.nomina_config is
  'Montos fijos que se descuentan por retardo y por falta, iguales para toda la empresa. UNA sola fila (el check sobre la pk lo garantiza). Ver migración 156.';
comment on column public.nomina_config.monto_retardo is
  'Pesos que se descuentan por CADA día clasificado como retardo (llegó pasada su tolerancia). Nace en 0: hasta que gestión lo fije, la nómina no descuenta nada — mejor no descontar que descontar una cantidad inventada.';
comment on column public.nomina_config.monto_falta is
  'Pesos que se descuentan por CADA día clasificado como falta (tenía turno, no checó y no hay permiso ni vacación aprobados). Decisión del dueño (2026-09-10): la falta descuenta ESTE monto y nada más — el día no se resta aparte, porque el sueldo capturado es semanal y fijo.';

insert into public.nomina_config (id) values (true) on conflict (id) do nothing;

alter table public.nomina_config enable row level security;

-- Grants explícitos: sin esto la tabla da "permission denied" y RLS ni se evalúa (las
-- migraciones corren como 'postgres', cuyo default privilege en Supabase no incluye
-- SELECT/UPDATE). El acceso real lo deciden las policies de abajo.
grant select, update on public.nomina_config to authenticated;
grant select, update on public.nomina_config to service_role;

-- Lo ven los tres roles de gestión, y NADIE más. A diferencia de `ajustes`, que lo lee
-- cualquier autenticado porque el checador necesita saber si exigir rostro, esto no le hace
-- falta a la plantilla para nada: es información de nómina.
drop policy if exists nomina_config_select_gestion on public.nomina_config;
create policy nomina_config_select_gestion
  on public.nomina_config for select
  using ((select public."current_role"()) in ('admin', 'rh', 'psicologa'));

-- Lo cambian los mismos tres. Subir el monto de la falta cambia retroactivamente lo que se le
-- descuenta a todo el mundo en todas las semanas que se miren después: no es un ajuste menor,
-- pero es exactamente el trabajo de estos tres roles.
drop policy if exists nomina_config_update_gestion on public.nomina_config;
create policy nomina_config_update_gestion
  on public.nomina_config for update
  using ((select public."current_role"()) in ('admin', 'rh', 'psicologa'))
  with check ((select public."current_role"()) in ('admin', 'rh', 'psicologa'));

-- Sin INSERT ni DELETE: la fila es una y ya existe.

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   insert into public.nomina_config (id) values (true);   -> falla (clave duplicada)
--   insert into public.nomina_config (id) values (false);  -> falla (check id)
--   update public.usuarios set sueldo_semanal = -1 ...;    -> falla (check no_negativo)
--
--   (como EMPLEADO)
--     select * from public.nomina_config;                  -> 0 filas
--     select sueldo_semanal from public.usuarios;          -> SOLO su propia fila
--     select * from public.usuarios_directorio;            -> sin columna de sueldo
--
--   (como RH o PSICOLOGA)
--     update public.nomina_config set monto_retardo = 50;  -> UPDATE 1
--
-- ROLLBACK:
--   drop table if exists public.nomina_config;
--   alter table public.usuarios drop constraint if exists usuarios_sueldo_semanal_no_negativo;
--   alter table public.usuarios drop column if exists sueldo_semanal;
-- ----------------------------------------------------------------------------
