-- ============================================================================
-- 176 · Los cumpleaños de mi clínica, SOLO día y mes.
--
-- NÚMERO CAMBIADO AL GUARDARLA EN EL REPO (2026-09-29). Se escribió y se aplicó en producción
-- como la 174 (hacia el 2026-09-28, desde la sesión de la app nativa), pero nunca se commiteó, y
-- mientras tanto prod/main usó 171 y 172 para otras dos. No hay registro de migraciones
-- aplicadas, así que el número solo ordena el repo. COMPROBADO el 2026-09-29 contra la base: el
-- cuerpo que corre en producción es exactamente este (salvo el número de migración en los textos).
--
-- Para el calendario del inicio de la app nativa: el dueño pidió que cada persona vea los
-- cumpleaños de sus compañeros, con su foto (2026-09-28).
--
-- LA MIGRACIÓN 030 LOS OCULTÓ A PROPÓSITO y esto NO deshace esa decisión: `usuarios_directorio`
-- sigue sin fechas, y la tabla `usuarios` sigue sin poder leerla un empleado. Lo que se abre
-- aquí es lo mínimo para felicitar a alguien:
--
--   · Día y mes, NUNCA el año: con el año se deduce la edad, y eso no hace falta para un
--     calendario de cumpleaños.
--   · Solo de la MISMA CLÍNICA que quien pregunta (más su propia fila): los compañeros con los
--     que trabaja, no la plantilla entera de 124 personas.
--   · Solo personas activas.
--   · Nombre y foto, que ya son visibles para cualquiera en el directorio.
--
-- SECURITY DEFINER porque tiene que leer `usuarios` saltándose la RLS; por eso fija
-- `search_path` y devuelve columnas cerradas. La clínica sale de la fila de QUIEN LLAMA
-- (current_usuario_id), no de un parámetro: no se pueden pedir los de otra sucursal.
--
-- El cumpleaños sale de `fecha_cumpleanos` ("MM-DD") y, si está vacío, de `fecha_nacimiento`,
-- igual que resolveFechaCumpleanos() en src/utils/helpers.js. Lo que no tenga forma "MM-DD"
-- válida se descarta en vez de devolver una fecha inventada.
-- ============================================================================

create or replace function public.cumpleanos_de_mi_clinica()
returns table (id uuid, name text, avatar_url text, mes smallint, dia smallint)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select u.id, u.sucursal
    from public.usuarios u
    where u.id = public.current_usuario_id()
  ),
  fechas as (
    select
      u.id,
      u.name,
      u.avatar_url,
      coalesce(nullif(trim(u.fecha_cumpleanos), ''), to_char(u.fecha_nacimiento, 'MM-DD')) as mmdd
    from public.usuarios u
    join yo on u.id = yo.id or (yo.sucursal is not null and u.sucursal = yo.sucursal)
    where not u.inactivo
  )
  select f.id, f.name, f.avatar_url, substr(f.mmdd, 1, 2)::smallint, substr(f.mmdd, 4, 2)::smallint
  from fechas f
  where f.mmdd ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';
$$;

revoke all on function public.cumpleanos_de_mi_clinica() from public, anon;
grant execute on function public.cumpleanos_de_mi_clinica() to authenticated;

comment on function public.cumpleanos_de_mi_clinica() is
  'Cumpleaños (solo día y mes) de las personas activas de la clínica de quien llama, más la suya. Para el calendario del inicio de la app nativa. Mig. 176.';

-- ============================================================================
-- VERIFICACIÓN (a mano, como empleado, con claims simulados):
--   select * from public.cumpleanos_de_mi_clinica();
--     -> solo filas de su sucursal + la suya; ninguna columna con año.
--   select * from public.usuarios where id <> <mi id>;   -> sigue devolviendo 0 filas.
-- ============================================================================
