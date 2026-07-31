-- Que cada recepcionista fije la ubicación de su propia clínica desde su teléfono.
--
-- EL PROBLEMA: 25 de 26 sucursales no tienen geocerca. La única configurada es la Oficina
-- Administrativa, capturada a mano estando ahí. Configurar el resto obligaba a viajar a cada
-- clínica, porque el botón "Usar mi ubicación actual" solo existe en la pantalla de admin.
--
-- LO QUE MANDA SOBRE ESTE DISEÑO: estar 'fuera' BLOQUEA la checada (403 en api/checar.js). Una
-- geocerca mal puesta deja a una clínica entera sin poder fichar a las ocho de la mañana. Por eso
-- se rechaza la captura con GPS malo, y por eso todo cambio de coordenadas queda registrado con
-- nombre y fecha: si una sale mal hay que poder ver quién y cuándo, y deshacerla.

-- ============================================================================
-- 1. Quién puede hacerlo
-- ============================================================================
-- Se usa un booleano y NO el texto de `puesto`. `puesto` es campo libre y hoy ya trae tres
-- grafías del mismo puesto ('Recepcionista', 'recepcionista', 'RECEPCIONISTA'); colgar un permiso
-- de texto libre es colgarlo de que nadie lo escriba distinto mañana. Mismo patrón que
-- `soporte_ti` (migración 094).
--
-- No hace falta protegerlo de que alguien se lo auto-otorgue: el trigger
-- `prevent_usuario_privilege_escalation` ya impide que quien no es gestión cambie de su propia
-- fila nada que no sea avatar_url o banner_url.
alter table public.usuarios
  add column if not exists puede_ubicar_sucursal boolean not null default false;

comment on column public.usuarios.puede_ubicar_sucursal is
  'Puede fijar la geocerca de SU sucursal desde la app (recepción). Se otorga desde gestión.';

-- De paso, las tres grafías a una sola. Se hace aquí y no "algún día" porque cualquier reporte
-- que filtre por texto exacto ya estaba perdiendo dos personas.
update public.usuarios
   set puesto = 'Recepcionista'
 where lower(trim(puesto)) = 'recepcionista'
   and puesto <> 'Recepcionista';

update public.usuarios
   set puede_ubicar_sucursal = true
 where puesto = 'Recepcionista'
   and not inactivo
   and not archivado;

-- ============================================================================
-- 2. Auditoría de la geocerca
-- ============================================================================
alter table public.sucursales
  add column if not exists geocerca_fijada_por  uuid references public.usuarios(id) on delete set null,
  add column if not exists geocerca_fijada_en   timestamptz,
  add column if not exists geocerca_precision_m integer;

create table if not exists public.sucursal_geocerca_log (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  lat         numeric,
  lng         numeric,
  precision_m integer,
  fijada_por  uuid references public.usuarios(id) on delete set null,
  fijada_en   timestamptz not null default now(),
  -- 'quitada' es lat/lng a null: la clínica vuelve a 'sin_geocerca' y todos pueden fichar.
  -- Es el freno de emergencia, y merece quedar en el historial tanto como una captura.
  accion      text not null check (accion in ('fijada', 'quitada'))
);

create index if not exists idx_geocerca_log_sucursal
  on public.sucursal_geocerca_log (sucursal_id, fijada_en desc);

alter table public.sucursal_geocerca_log enable row level security;

drop policy if exists geocerca_log_select_gestion on public.sucursal_geocerca_log;
create policy geocerca_log_select_gestion
  on public.sucursal_geocerca_log for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

grant select on public.sucursal_geocerca_log to authenticated;

-- ============================================================================
-- 3. La auditoría se mantiene sola, venga de donde venga el cambio
-- ============================================================================
-- Hay dos caminos que escriben coordenadas: el admin (UPDATE directo con su RLS) y la RPC de
-- recepción. Si cada uno tuviera que acordarse de rellenar quién y cuándo, tarde o temprano uno
-- se olvidaría y el historial mentiría. Se hace en trigger para que no dependa de nadie.
create or replace function public.sellar_geocerca()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    if new.lat is null or new.lng is null then
      new.geocerca_fijada_por  := null;
      new.geocerca_fijada_en   := null;
      new.geocerca_precision_m := null;
    else
      -- Siempre se sobrescribe (nunca coalesce): si no, un cambio hecho por otra persona
      -- heredaría el nombre del anterior, que es justo lo contrario de auditar.
      new.geocerca_fijada_por := public.current_usuario_id();
      new.geocerca_fijada_en  := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sucursales_sellar_geocerca on public.sucursales;
create trigger trg_sucursales_sellar_geocerca
  before update on public.sucursales
  for each row execute function public.sellar_geocerca();

create or replace function public.log_geocerca()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    insert into public.sucursal_geocerca_log
      (sucursal_id, lat, lng, precision_m, fijada_por, accion)
    values
      (new.id, new.lat, new.lng, new.geocerca_precision_m,
       public.current_usuario_id(),
       case when new.lat is null then 'quitada' else 'fijada' end);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sucursales_log_geocerca on public.sucursales;
create trigger trg_sucursales_log_geocerca
  after update on public.sucursales
  for each row execute function public.log_geocerca();

-- ============================================================================
-- 4. La RPC que usa recepción
-- ============================================================================
-- Va por RPC y NO por una policy de UPDATE sobre `sucursales`, por dos razones concretas:
--   · RLS no sabe de columnas. Una policy que la dejara escribir lat/lng la dejaría también
--     renombrar la clínica o desactivarla.
--   · La RPC no recibe id de sucursal. No es que se compruebe que es la suya: es que no hay
--     forma de nombrar otra. Lo que no se puede expresar no se puede colar.
-- Mismo patrón que `mark_password_changed` (migración 020).
create or replace function public.fijar_geocerca_mi_sucursal(
  p_lat       numeric,
  p_lng       numeric,
  p_precision integer
)
returns public.sucursales
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario  public.usuarios%rowtype;
  v_sucursal public.sucursales%rowtype;
begin
  select * into v_usuario from public.usuarios where auth_user_id = auth.uid();
  if v_usuario.id is null then
    raise exception 'Tu sesión expiró. Vuelve a entrar.';
  end if;
  if v_usuario.inactivo or v_usuario.archivado then
    raise exception 'Tu cuenta no está activa.';
  end if;
  if not coalesce(v_usuario.puede_ubicar_sucursal, false) then
    raise exception 'No tienes permiso para fijar la ubicación de tu clínica.';
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'No recibimos tu ubicación. Activa el GPS de tu teléfono.';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'La ubicación recibida no es válida.';
  end if;

  -- Mismo tope que ya aplica el admin en GestionSucursales.jsx. Capturar con 300 m de
  -- incertidumbre es capturar un punto que no sirve, y más vale saberlo ahora que cuando media
  -- clínica aparezca "fuera de rango" y no pueda fichar.
  if p_precision is null or p_precision > 100 then
    raise exception 'Tu GPS solo tiene % m de precisión. Sal al exterior e inténtalo de nuevo.',
      coalesce(p_precision, 0);
  end if;

  select * into v_sucursal
    from public.sucursales
   where nombre = v_usuario.sucursal and activa = true;

  if v_sucursal.id is null then
    raise exception 'No encontramos tu clínica (%). Avisa a administración.',
      coalesce(v_usuario.sucursal, 'sin asignar');
  end if;

  -- El radio NO se toca: lo ajusta el dueño desde admin. Un radio corto mal puesto bloquea gente.
  update public.sucursales
     set lat = p_lat,
         lng = p_lng,
         geocerca_precision_m = p_precision
   where id = v_sucursal.id
  returning * into v_sucursal;

  return v_sucursal;
end;
$$;

-- Sin este GRANT, Postgres niega ANTES de mirar nada y la RPC no se ejecutaría nunca — la trampa
-- que ya documentó la migración 054.
grant execute on function public.fijar_geocerca_mi_sucursal(numeric, numeric, integer) to authenticated;


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   drop function if exists public.fijar_geocerca_mi_sucursal(numeric, numeric, integer);
--   drop trigger if exists trg_sucursales_log_geocerca on public.sucursales;
--   drop trigger if exists trg_sucursales_sellar_geocerca on public.sucursales;
--   drop function if exists public.log_geocerca();
--   drop function if exists public.sellar_geocerca();
--   drop table if exists public.sucursal_geocerca_log;
--   alter table public.sucursales
--     drop column if exists geocerca_fijada_por,
--     drop column if exists geocerca_fijada_en,
--     drop column if exists geocerca_precision_m;
--   alter table public.usuarios drop column if exists puede_ubicar_sucursal;
