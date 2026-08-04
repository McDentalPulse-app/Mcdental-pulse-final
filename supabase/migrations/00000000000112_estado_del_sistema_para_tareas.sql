-- Que la tarea de fondo pueda leer el estado del sistema.
--
-- `estado_del_sistema()` (migración 109) sirve a la pantalla de Configuración, y su candado
-- comprueba `current_role()`, que sale de `usuarios` por `auth.uid()`. La tarea de fondo entra
-- con la llave de servicio: no es una persona, no tiene fila en `usuarios`, y `auth.uid()` es
-- nulo. Con el candado tal cual, la tarea recibía "No autorizado.".
--
-- La alternativa habría sido duplicar las comprobaciones en JavaScript dentro de la tarea. No:
-- entonces la pantalla y el aviso podrían decir cosas distintas del mismo sistema, y el día que
-- discreparan nadie sabría a cuál creer. Una sola verdad, dos consumidores.

create or replace function public.estado_del_sistema()
returns table (
  clave     text,
  titulo    text,
  estado    text,   -- 'ok' | 'atencion' | 'critico' | 'sin_datos'
  detalle   text,
  valor     numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rol rol_usuario;
  v_exigir boolean;
  v_semana text := to_char(now() at time zone 'America/Monterrey', 'IYYY-"W"IW');
begin
  -- Entrecomillado: `current_role` es palabra reservada de SQL. La función propia de la app se
  -- llama igual, así que sin las comillas Postgres lee el valor especial y no la llama.
  select "current_role"() into v_rol;

  -- Personas: solo gestión. Máquinas: la llave de servicio, que es la que usan las tareas de
  -- fondo del propio servidor y nunca llega desde el navegador de nadie.
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or current_user = 'service_role'
    or (v_rol is not null and v_rol in ('admin', 'rh', 'psicologa'))
  ) then
    raise exception 'No autorizado.';
  end if;

  select a.exigir_rostro into v_exigir from ajustes a limit 1;

  -- ── Respaldo externo ──────────────────────────────────────────────────────
  return query
  with ultimo as (
    select recibido_en, ok from respaldo_latidos order by recibido_en desc limit 1
  ), horas as (
    select extract(epoch from (now() - (select recibido_en from ultimo))) / 3600 as h
  )
  select
    'respaldo_externo',
    'Respaldo fuera del servidor',
    case
      when (select recibido_en from ultimo) is null then 'critico'
      when (select h from horas) > 96 then 'critico'
      when (select h from horas) > 36 then 'atencion'
      else 'ok'
    end,
    case
      when (select recibido_en from ultimo) is null then 'Nunca ha llegado una copia verificada.'
      else 'Última copia verificada hace ' || round((select h from horas))::text || ' h.'
    end,
    round((select h from horas), 1);

  -- ── Quién no puede checar ─────────────────────────────────────────────────
  return query
  with sin_rostro as (
    select count(*)::numeric as n
      from usuarios u
     where not coalesce(u.inactivo, false)
       and not coalesce(u.archivado, false)
       and u.role in ('empleado', 'doctor')
       and not exists (
         select 1 from rostros r where r.empleado_id = u.id and r.estado = 'aprobado'
       )
  )
  select
    'sin_rostro',
    'Personas que no pueden checar',
    case
      when not coalesce(v_exigir, false) then 'ok'
      when (select n from sin_rostro) = 0 then 'ok'
      else 'atencion'
    end,
    case
      when not coalesce(v_exigir, false)
        then 'El rostro no es obligatorio: ' || (select n from sin_rostro)::text ||
             ' sin registrar, pero pueden checar igual.'
      when (select n from sin_rostro) = 0 then 'Toda la plantilla tiene su rostro aprobado.'
      else (select n from sin_rostro)::text || ' personas no pueden registrar entrada.'
    end,
    (select n from sin_rostro);

  -- ── El checador ───────────────────────────────────────────────────────────
  return query
  with hoy as (
    select count(*)::numeric as n
      from asistencias
     where tipo = 'entrada'
       and not coalesce(anulada, false)
       and fecha = (now() at time zone 'America/Monterrey')::date
  ), momento as (
    select extract(isodow from (now() at time zone 'America/Monterrey')) as dow,
           extract(hour   from (now() at time zone 'America/Monterrey')) as hora
  )
  select
    'checador',
    'Checador',
    case
      when (select dow from momento) > 6 then 'ok'
      when (select hora from momento) < 11 then 'ok'
      when (select n from hoy) = 0 then 'critico'
      else 'ok'
    end,
    (select n from hoy)::text || ' entradas registradas hoy.',
    (select n from hoy);

  -- ── Cotejo de caras ───────────────────────────────────────────────────────
  -- OJO: `cotejo_intentos` es un registro de FRACASOS. Un reconocimiento correcto no deja fila.
  -- Contar `motivo is null` como acierto hacía que dijera "0 de 17 reconocidos" con el checador
  -- funcionando perfectamente. Los aciertos están en las checadas verificadas.
  return query
  with c as (
    select
      (select count(*) from cotejo_intentos
        where creado_en > now() - interval '24 hours')::numeric as fallos,
      (select count(*) from asistencias
        where rostro_verificado
          and marcada_en > now() - interval '24 hours')::numeric as aciertos
  ), t as (
    select fallos, aciertos, fallos + aciertos as total from c
  )
  select
    'cotejo',
    'Cotejo de caras (24 h)',
    case
      when (select total from t) = 0 then 'sin_datos'
      when (select fallos from t) / (select total from t) > 0.5 then 'critico'
      when (select fallos from t) / (select total from t) > 0.3 then 'atencion'
      else 'ok'
    end,
    case
      when (select total from t) = 0 then 'Nadie ha checado con rostro en 24 h.'
      else (select aciertos from t)::text || ' reconocidos y ' ||
           (select fallos from t)::text || ' reintentos fallidos.'
    end,
    case when (select total from t) = 0 then null
         else round(100 * (select fallos from t) / (select total from t)) end;

  -- ── Encuestas de la semana ────────────────────────────────────────────────
  return query
  with e as (
    select count(*)::numeric as n from encuestas where semana = v_semana
  ), plantilla as (
    select count(*)::numeric as n from usuarios
     where not coalesce(inactivo, false) and not coalesce(archivado, false)
       and role in ('empleado', 'doctor')
  )
  select
    'encuestas',
    'Encuestas de esta semana',
    case
      when (select n from plantilla) = 0 then 'sin_datos'
      when (select n from e) = 0 then 'atencion'
      else 'ok'
    end,
    (select n from e)::text || ' de ' || (select n from plantilla)::text ||
      ' han contestado (' || v_semana || ').',
    (select n from e);
end;
$$;

revoke all on function public.estado_del_sistema() from public;
grant execute on function public.estado_del_sistema() to authenticated;
grant execute on function public.estado_del_sistema() to service_role;
