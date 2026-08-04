-- ¿Está todo bien? En una sola pregunta.
--
-- ============================================================================
-- POR QUÉ EXISTE
-- ============================================================================
--
-- Los avisos de la app funcionan: el vigilante del respaldo lleva seis días detectando que no
-- hay copia externa, ha avisado cada día, y el admin los ha leído. El respaldo sigue sin
-- funcionar. El problema no era detectar, era que **un aviso leído no es un problema resuelto**:
-- la campana enseña lo que PASÓ, no lo que ESTÁ pasando, y con 1.178 notificaciones y 272
-- recordatorios de encuesta sin leer, un aviso de verdad se pierde entre el ruido.
--
-- Esto devuelve el ESTADO ACTUAL. Se lee de un vistazo y no hay que marcarlo como leído: si el
-- respaldo vuelve, la fila se pone verde sola. Es lo que se ha estado consultando a mano con
-- SQL toda la semana, hecho una vez y en un solo sitio.
--
-- VIVE EN LA BASE y no en el cliente a propósito: la misma verdad la consultan la pantalla de
-- Configuración y la tarea de fondo que avisa. Si cada una calculara lo suyo, acabarían
-- discrepando y nadie sabría a cuál creer.
--
-- LO QUE NO PUEDE VER: el disco de la VPS y los dumps locales no están en la base. Los añade la
-- tarea de fondo en una fase posterior; por eso la función devuelve una lista y no un registro
-- fijo — para que crezca sin cambiar su firma ni la pantalla.
--
-- ============================================================================

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
  -- SECURITY DEFINER: sin este candado, cualquier autenticado leería cuánta gente no puede
  -- checar y cuántas encuestas se contestaron. Es información de operación, no de plantilla.
  -- Entrecomillado: `current_role` es palabra reservada de SQL. La función propia de la app se
  -- llama igual, así que sin las comillas Postgres lee el valor especial y no la llama.
  select "current_role"() into v_rol;
  if v_rol is null or v_rol not in ('admin', 'rh', 'psicologa') then
    raise exception 'No autorizado.';
  end if;

  select a.exigir_rostro into v_exigir from ajustes a limit 1;

  -- ── Respaldo externo ──────────────────────────────────────────────────────
  -- El modo de fallo peligroso es el CALLADO: la máquina de la oficina apagada y nadie se
  -- entera. 36 h de tolerancia, igual que api/revisar-respaldos.js — un retraso por un
  -- reinicio no es una alarma; día y medio sí.
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
  -- Solo es un problema si el rostro es OBLIGATORIO. Con la exigencia apagada, no tener
  -- rostro no impide fichar, así que avisar de ello sería ruido.
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
  -- Un día laborable sin ninguna checada a media mañana significa que el checador está caído
  -- para todos, y eso no puede esperar a que alguien se queje. Sábado y domingo no cuentan.
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
      when (select dow from momento) > 6 then 'ok'                       -- domingo
      when (select hora from momento) < 11 then 'ok'                     -- aún es temprano
      when (select n from hoy) = 0 then 'critico'
      else 'ok'
    end,
    (select n from hoy)::text || ' entradas registradas hoy.',
    (select n from hoy);

  -- ── Cotejo de caras ───────────────────────────────────────────────────────
  -- El anti-spoofing estuvo fallando en el 100% de las checadas durante días sin que nadie lo
  -- supiera (301 errores en 7 días, encontrados leyendo registros a mano). Un porcentaje alto
  -- de fallos suele ser un modelo roto, no gente que no se deja reconocer.
  --
  -- OJO CON `cotejo_intentos`: es un registro de FRACASOS. Un reconocimiento correcto no deja
  -- fila. La primera versión de esto contaba `motivo is null` como acierto y anunciaba
  -- "0 de 17 reconocidos" con el checador funcionando perfectamente — las filas antiguas
  -- tienen el motivo vacío solo porque esa columna se añadió el 2026-08-03 (migración 106).
  -- Los aciertos hay que contarlos donde de verdad están: en las checadas verificadas.
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

comment on function public.estado_del_sistema() is
  'Estado ACTUAL del sistema para la pantalla de Configuración y la tarea de fondo. '
  'Devuelve una fila por comprobación. Solo admin, RH y psicóloga.';
