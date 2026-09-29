-- ============================================================================
-- 174 — El estado de cada día y su descuento, calculado en la base.
--
-- NÚMERO CAMBIADO AL GUARDARLA EN EL REPO (2026-09-29). Se escribió y se aplicó en producción
-- como la 172 (hacia el 2026-09-21, desde la sesión de la app nativa), pero nunca se commiteó, y
-- mientras tanto prod/main usó 171 y 172 para otras dos. No hay registro de migraciones
-- aplicadas, así que el número solo ordena el repo. Que este SQL sea EXACTAMENTE el que corre en
-- producción se comprueba contra la base (pg_get_functiondef) antes de dar nada por bueno.
--
-- POR QUÉ EXISTE. El estado de un día (presente, retardo, falta…) y lo que se descuenta por él
-- NO se guardan en ninguna tabla: se recalculan cada vez que alguien abre la nómina en la web,
-- con reglas que viven en JavaScript (`src/utils/asistencia.js` y `src/utils/nomina.js`). La app
-- nativa necesita esos mismos números para que nadie se entere de su descuento el día del pago.
--
-- Copiar las reglas a Kotlin habría dejado DOS implementaciones de "cuánto te cobran". El día
-- que se separaran, una de las dos le cobraría de más a alguien real. Así que se traen aquí, una
-- sola vez, y que las consuman la app y —cuando se quiera— la web.
--
-- ESTA FUNCIÓN SOLO LEE. No escribe, no guarda el resultado, no toca el cálculo de nómina.
--
-- SEGURIDAD. Es `security definer` porque necesita leer `usuarios.sueldo_semanal` y los
-- horarios, que un empleado no puede leer por RLS. Por eso la PRIMERA línea del cuerpo comprueba
-- quién pregunta: sin ese guard, esto sería una puerta trasera para leer la asistencia y el
-- sueldo de cualquiera saltándose las políticas.
-- ============================================================================

begin;

-- La app entró en uso el 2026-07-21: antes de esa fecha no hay checadas porque no había app, y
-- contar esos días como falta sería cobrarle a la gente por no usar algo que no existía.
-- Mismo valor que FECHA_INICIO_ASISTENCIA en src/utils/asistencia.js.
create or replace function public.asistencia_fecha_inicio()
returns date language sql immutable as $$ select date '2026-07-21' $$;

-- Hasta el 2026-07-31 la app estaba en pruebas: un día sin checar ahí es 'prueba', no falta.
-- Mismo valor que FIN_PERIODO_PRUEBA.
create or replace function public.asistencia_fin_prueba()
returns date language sql immutable as $$ select date '2026-07-31' $$;

-- Se borra antes de crear porque la firma de salida cambió durante el desarrollo y
-- `create or replace` no puede cambiar el tipo devuelto. Es idempotente: correr esta migración
-- dos veces deja lo mismo.
drop function if exists public.resumen_asistencia_semana(uuid, date, date);

create function public.resumen_asistencia_semana(
  p_empleado uuid,
  p_desde    date,
  p_hasta    date
)
returns table (
  fecha            date,
  estado           text,
  minutos_retardo  integer,
  entrada          timestamptz,
  salida           timestamptz,
  descuento        numeric(10,2),
  -- Si el sueldo de la persona no está capturado, el descuento por falta sale 0 porque ESO es
  -- lo que calcula la web (`descuentoDelDia` con sueldo null da 0). Pero 0 ahí no significa "no
  -- te descuento nada", significa "no sé cuánto". La web resuelve la ambigüedad con su bandera
  -- `sinSueldo`; aquí va la misma, para que la pantalla pueda decirlo con palabras en vez de
  -- enseñar $0.00 con cara de cuenta hecha.
  sueldo_capturado boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_zona        text;
  v_puesto      text;
  v_sueldo      numeric(10,2);
  v_monto_pers  numeric(10,2);
  v_monto_gral  numeric(10,2);
  v_hoy         date;
  v_corte       date;
begin
  -- EL GUARD. Cada quien lo suyo; RH, admin y psicóloga ven de cualquiera.
  if p_empleado is distinct from public.current_usuario_id()
     and coalesce(public.current_role()::text, '') not in ('admin', 'rh', 'psicologa') then
    raise exception 'no autorizado';
  end if;

  if p_hasta < p_desde then
    raise exception 'el rango va al revés: % a %', p_desde, p_hasta;
  end if;

  -- LA ZONA ES LA DE LA CLÍNICA, no la del servidor. Es el fallo que en la PWA le apuntaba 55
  -- minutos de retardo todos los días a quien llegaba puntual en Hermosillo (UTC-7).
  select coalesce(s.zona_horaria, 'America/Monterrey'), u.puesto, u.sueldo_semanal,
         u.monto_retardo_personal
    into v_zona, v_puesto, v_sueldo, v_monto_pers
    from public.usuarios u
    left join public.sucursales s on s.nombre = u.sucursal
   where u.id = p_empleado;

  if not found then
    raise exception 'ese empleado no existe';
  end if;

  select n.monto_retardo into v_monto_gral from public.nomina_config n limit 1;

  v_hoy   := (now() at time zone v_zona)::date;
  v_corte := public.asistencia_fecha_inicio();

  return query
  with dias as (
    -- Los días anteriores al arranque de la app no se devuelven: no son falta, es que no había
    -- nada que checar.
    select d::date as fecha
      from generate_series(greatest(p_desde, v_corte), p_hasta, interval '1 day') d
  ),
  horario as (
    select h.dia_semana, h.hora_entrada, h.tolerancia_min
      from public.horarios h
     where h.empleado_id = p_empleado
  ),
  checadas as (
    -- Se agrupa por `asistencias.fecha` —el día local que fijó el servidor al registrar— y no
    -- por el timestamp: es exactamente lo que hace construirDias() en la web, y así las dos
    -- cuentan el mismo día. Las anuladas no existen para este cálculo.
    select a.fecha,
           min(a.marcada_en) filter (where a.tipo = 'entrada') as entrada,
           max(a.marcada_en) filter (where a.tipo = 'salida')  as salida
      from public.asistencias a
     where a.empleado_id = p_empleado
       and coalesce(a.anulada, false) = false
       and a.fecha between greatest(p_desde, v_corte) and p_hasta
     group by a.fecha
  ),
  justificaciones as (
    -- Solo las APROBADAS justifican. Una pendiente no perdona nada todavía.
    select p.fecha as inicio, coalesce(p.fecha_fin, p.fecha) as fin
      from public.permisos p
     where p.empleado_id = p_empleado and p.estado = 'aprobado'
    union all
    select v.fecha_inicio, v.fecha_fin
      from public.vacaciones v
     where v.empleado_id = p_empleado and v.estado = 'aprobado'
  ),
  crudo as (
    select
      d.fecha,
      h.hora_entrada,
      h.tolerancia_min,
      c.entrada,
      c.salida,
      exists (
        select 1 from justificaciones j
         where d.fecha between j.inicio and j.fin
      ) as justificado,
      -- Minutos DESPUÉS de la hora de entrada, leídos en la zona de la clínica. Llegar antes da
      -- 0, no un número negativo: nadie tiene un retardo de −5 minutos.
      --
      -- LOS SEGUNDOS NO CUENTAN, y esto no es un detalle: se comparan hora y minuto, como hace
      -- `minutosLocales()` en la web. Restar los timestamps completos y redondear daba UN MINUTO
      -- DE MÁS en medio expediente, y con una tolerancia de 10 ese minuto convertía un día
      -- presente en un retardo de $100. Lo encontró la prueba de paridad, no una revisión.
      -- Además es la dirección humana: llegar a las 9:10:59 es llegar a las 9:10.
      case
        when c.entrada is null or h.hora_entrada is null then 0
        else greatest(
          0,
          (extract(hour   from (c.entrada at time zone v_zona))::integer * 60
           + extract(minute from (c.entrada at time zone v_zona))::integer)
          - (extract(hour   from h.hora_entrada)::integer * 60
             + extract(minute from h.hora_entrada)::integer)
        )
      end as retardo_min
      from dias d
      left join horario  h on h.dia_semana = extract(isodow from d.fecha)::smallint
      left join checadas c on c.fecha = d.fecha
  ),
  clasificado as (
    select
      r.fecha,
      case
        -- El orden de estas ramas ES la regla; cambiarlo cambia lo que se le cobra a alguien.
        when r.hora_entrada is null                       then 'descanso'
        when r.entrada is null and r.salida is null then
          case
            when r.justificado                            then 'justificado'
            -- El día en curso todavía no es falta: la persona aún puede llegar.
            when r.fecha >= v_hoy                         then 'pendiente'
            when r.fecha <= public.asistencia_fin_prueba() then 'prueba'
            else 'falta'
          end
        when r.salida is null                             then 'incompleto'
        when r.retardo_min > coalesce(r.tolerancia_min, 0) and r.justificado then 'justificado'
        -- Estrictamente mayor: entrar en el minuto exacto del límite NO es retardo.
        when r.retardo_min > coalesce(r.tolerancia_min, 0) then 'retardo'
        else 'presente'
      end as estado,
      r.retardo_min,
      r.entrada,
      r.salida
      from crudo r
  )
  select
    c.fecha,
    c.estado,
    case when c.estado in ('retardo', 'incompleto', 'justificado') then c.retardo_min else 0 end,
    c.entrada,
    c.salida,
    case c.estado
      -- El personal gana sobre el de becario, que gana sobre el general. Misma prioridad que
      -- descuentoDelDia() en src/utils/nomina.js.
      when 'retardo' then coalesce(
        v_monto_pers,
        -- 'becari' y no 'becario': el puesto puede decir "Becaria marketing", y buscando el
        -- masculino se le cobraban $100 en vez de $50 a las mujeres. Es exactamente el regex
        -- /becari/i de esBecario() en nomina.js. Lo encontró la prueba de paridad.
        case when lower(coalesce(v_puesto, '')) like '%becari%' then 50::numeric end,
        v_monto_gral,
        0::numeric
      )
      -- El sueldo semanal entre 7. Sin sueldo capturado da 0, IGUAL que la web: la diferencia
      -- entre "cero" y "no lo sé" viaja en `sueldo_capturado`, no escondida en el monto.
      when 'falta' then round(coalesce(v_sueldo, 0) / 7.0, 2)
      else 0::numeric
    end,
    (v_sueldo is not null and v_sueldo > 0)
    from clasificado c
   order by c.fecha;
end;
$$;

revoke all on function public.resumen_asistencia_semana(uuid, date, date) from public;
grant execute on function public.resumen_asistencia_semana(uuid, date, date) to authenticated;

comment on function public.resumen_asistencia_semana(uuid, date, date) is
  'Estado y descuento de cada día de un rango, calculado con las mismas reglas que src/utils/asistencia.js y src/utils/nomina.js. Solo lee. Cada empleado puede pedir LO SUYO; admin/rh/psicologa, el de cualquiera. Migración 174.';

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   · Paridad contra la web: scripts/paridad-asistencia.mjs compara esta función contra las
--     reglas JS para todos los empleados activos y las últimas 8 semanas. Criterio: 0 diferencias.
--   · Autorización, con el JWT de un empleado normal:
--       select * from public.resumen_asistencia_semana('<otro-empleado>', '2026-09-15', '2026-09-21');
--       -> ERROR: no autorizado
--
-- ROLLBACK:
--   drop function if exists public.resumen_asistencia_semana(uuid, date, date);
--   drop function if exists public.asistencia_fecha_inicio();
--   drop function if exists public.asistencia_fin_prueba();
-- ----------------------------------------------------------------------------
