-- ============================================================================
-- Avisos dirigidos por sucursal (migración 068).
--
-- Hasta la 058 un aviso era para TODOS (sin columna de destino). Ahora cada aviso
-- lleva una o más sucursales destino; se decidió por conversación:
--   * Cada aviso SIEMPRE lleva sucursales explícitas (no hay "todas" implícito). En
--     el formulario hay un botón "Seleccionar todas" para el caso "a toda la clínica".
--   * HISTORIAL: gestión (admin/rh/psicologa) ve todos los avisos (los administra);
--     un empleado ve solo los de SU sucursal.
--   * RECIBIR (modal bloqueante + campana): todos, incluida la gestión, reciben solo
--     los avisos que apunten a su propia sucursal. El modal filtra del lado del cliente
--     (porque la gestión sí puede SELECT todos); la campana la filtra este trigger.
--
-- Se guarda un text[] de NOMBRES canónicos de sucursal (los mismos que usuarios.sucursal
-- y la constante SUCURSALES del front), no una tabla puente: el conjunto es chico (25),
-- fijo y se edita entero. La comparación de RLS/trigger es u.sucursal = ANY(sucursales).
-- ============================================================================

-- 1) Columna nullable primero, para poder rellenar los avisos que ya existen.
alter table public.avisos add column if not exists sucursales text[];

-- 2) Backfill: los avisos previos eran "para todos" → se rellenan con las 25 sucursales,
--    así siguen viéndose para toda la plantilla (retrocompatibilidad). En local suele no
--    haber filas; en prod las hay.
update public.avisos
set sucursales = ARRAY[
  'Oficina Administrativa','McDental Palmas','McDental Madero','McDental Tampico',
  'McDental Tampico Obregon','Popular Tampico','McDental Tuxpan','Popular Tuxpan',
  'McDental Poza Rica','Popular Poza Rica','McDental Valles','McDental Irapuato',
  'Popular Irapuato','McDental Victoria','McDental Reynosa','McDental Pachuca',
  'McDental Hermosillo','McDental Villahermosa','McDental Huejutla','McDental Altamira',
  'McDental Ebano','Popular Reynosa','McDental Mante','McDental Leon','Martinez De La Torre'
]
where sucursales is null;

-- 3) Ahora sí NOT NULL + al menos una sucursal (el front también valida y avisa, esto es
--    el respaldo en BD: un aviso sin destino no tiene sentido).
alter table public.avisos alter column sucursales set not null;

-- cardinality (no array_length): array_length('{}',1) es NULL y un CHECK con NULL
-- PASA, así que un arreglo vacío se colaría. cardinality('{}') = 0, que sí lo rechaza.
alter table public.avisos drop constraint if exists avisos_sucursales_no_vacio;
alter table public.avisos add constraint avisos_sucursales_no_vacio
  check (cardinality(sucursales) >= 1);

comment on column public.avisos.sucursales is
  'Nombres canónicos de sucursal destino (>=1). Empleado ve/recibe solo si su sucursal está aquí; gestión ve todo el historial. Migración 068.';

-- 4) SELECT: gestión ve todo; empleado solo los de su sucursal.
drop policy if exists avisos_select_autenticados on public.avisos;
drop policy if exists avisos_select_por_sucursal on public.avisos;
create policy avisos_select_por_sucursal
  on public.avisos for select
  using (
    (select public.current_role()) in ('admin', 'rh', 'psicologa')
    or (
      select u.sucursal from public.usuarios u
      where u.id = (select public.current_usuario_id())
    ) = any (sucursales)
  );

-- 5) La campana: el trigger de la 065 ahora notifica SOLO a la plantilla activa cuya
--    sucursal esté en el destino del aviso (además de excluir al autor).
create or replace function public.notificar_aviso_nuevo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'aviso', 'Nuevo aviso: ' || new.titulo, left(coalesce(new.cuerpo, ''), 120), '/'
  from public.usuarios u
  where coalesce(u.inactivo, false) = false
    and u.id <> new.creado_por
    and u.sucursal = any (new.sucursales);
  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (local):
--   insert into avisos (titulo, cuerpo, creado_por, sucursales)
--     values ('Prueba', 'Cuerpo', <id>, ARRAY['McDental Palmas']);
--   -> notificaciones solo para usuarios con sucursal = 'McDental Palmas'.
--   insert ... sucursales := ARRAY[]::text[]  -> rechazado por avisos_sucursales_no_vacio.
--
-- ROLLBACK:
--   drop policy if exists avisos_select_por_sucursal on public.avisos;
--   create policy avisos_select_autenticados on public.avisos for select
--     using ((select public.current_role()) is not null);
--   -- (restaurar notificar_aviso_nuevo sin el filtro de sucursal, ver migración 065)
--   alter table public.avisos drop constraint if exists avisos_sucursales_no_vacio;
--   alter table public.avisos drop column if exists sucursales;
-- ----------------------------------------------------------------------------
