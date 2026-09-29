-- ============================================================================
-- 177 — El resumen y el recibo de la semana, al día con las reglas de la web.
--
-- POR QUÉ. La 174 y la 175 portaron a SQL las reglas de `src/utils/asistencia.js` y
-- `src/utils/nomina.js` tal como estaban el 2026-09-21. Entre el 23 y el 26 la web cambió cómo
-- se cobra, y la base se quedó atrás: la app enseñaba a cada quien un descuento que ya no era el
-- de su nómina. Lo que faltaba:
--
--   · FESTIVO (a70248b): un festivo del calendario que la persona no cedió, o el día que ganó con
--     un intercambio aprobado, no es falta.
--   · SALIDA ANTICIPADA (508d4bf y siguientes): $100 por irse 10 minutos o más antes de la hora
--     de salida de su turno, o por no marcar la salida (o que la pusiera el sistema). Desde el
--     2026-09-21. Se SUMA a lo del día. La de sábado/domingo se cobra la semana siguiente.
--   · RETARDO SIN SALIDA (cce307c): el retardo se cobra aunque el día siga sin salida.
--   · Un permiso de SALIDA ANTICIPADA perdona la salida pero no el retardo de la mañana (72309b3).
--   · SUELDO FIJO (01307ca, mig. 172): sin descuentos por asistencia.
--   · FECHA DE INGRESO: los días anteriores a que la persona entrara no existen (ya estaba en la
--     web y la 174 no lo hacía).
--
-- MISMA FIRMA DE ENTRADA, y la salida solo AÑADE columnas: las versiones de la app que ya están
-- instaladas siguen leyendo lo que leían. Cambia una cosa que sí ven: `resumen_asistencia_semana`
-- devuelve además, marcados con `arrastre`, los días del FIN DE SEMANA ANTERIOR cuya salida se
-- cobra esta semana (es lo que la web pinta como renglón aparte).
--
-- SOLO LEE. Nada de esto escribe; la nómina de la web sigue calculándose en JavaScript. Por eso
-- la paridad (scripts/paridad-asistencia.*) es la que manda: da por buena la web.
-- ============================================================================

begin;

-- Desde cuándo se cobra la salida anticipada. FECHA_INICIO_SALIDA_ANTICIPADA en asistencia.js.
create or replace function public.asistencia_inicio_salida_anticipada()
returns date language sql immutable as $$ select date '2026-09-21' $$;

-- La recreación va en este orden porque las dos cambian lo que devuelven, y `create or replace`
-- no puede cambiar el tipo de salida. recibo_semana llama a resumen_asistencia_semana, pero
-- desde plpgsql, que no crea dependencia: se pueden borrar en cualquier orden.
drop function if exists public.recibo_semana(uuid, date, date);
drop function if exists public.resumen_asistencia_semana(uuid, date, date);

create function public.resumen_asistencia_semana(
  p_empleado uuid,
  p_desde    date,
  p_hasta    date
)
returns table (
  fecha                     date,
  estado                    text,
  minutos_retardo           integer,
  entrada                   timestamptz,
  salida                    timestamptz,
  -- TODO lo que se cobra ese día en ESTE recibo: lo del estado más la salida anticipada.
  descuento                 numeric(10,2),
  sueldo_capturado          boolean,
  -- La parte de `descuento` que es salida anticipada ($100 o 0).
  descuento_salida          numeric(10,2),
  -- Se fue antes, o no marcó la salida. Es un hecho del día: puede no cobrarse en este recibo
  -- (ver `salida_diferida`).
  salida_anticipada         boolean,
  sin_marcar_salida         boolean,
  minutos_salida_anticipada integer,
  -- Salida anticipada de sábado/domingo de ESTA semana: se cobrará en la siguiente.
  salida_diferida           boolean,
  -- Día del fin de semana ANTERIOR, que solo está aquí porque su salida se cobra esta semana.
  arrastre                  boolean,
  -- Ese día cuenta como retardo cobrado (un RETARDO, o un día sin salida en el que llegó tarde).
  cobra_retardo             boolean,
  -- Sueldo fijo: los estados se enseñan, pero no descuentan nada.
  sueldo_fijo               boolean
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
  v_fijo        boolean;
  v_ingreso     date;
  v_hoy         date;
  v_corte       date;
  v_inicio      date;
begin
  -- EL GUARD. Cada quien lo suyo; RH, admin y psicóloga ven de cualquiera. Es security definer
  -- porque lee sueldo y horarios, que un empleado no puede leer por RLS: sin esta línea, esto
  -- sería una puerta trasera al sueldo de cualquiera.
  if p_empleado is distinct from public.current_usuario_id()
     and coalesce(public.current_role()::text, '') not in ('admin', 'rh', 'psicologa') then
    raise exception 'no autorizado';
  end if;

  if p_hasta < p_desde then
    raise exception 'el rango va al revés: % a %', p_desde, p_hasta;
  end if;

  -- LA ZONA ES LA DE LA CLÍNICA, no la del servidor (Hermosillo va una hora por detrás).
  select coalesce(s.zona_horaria, 'America/Monterrey'), u.puesto, u.sueldo_semanal,
         u.monto_retardo_personal, coalesce(u.sueldo_fijo, false), u.fecha_ingreso
    into v_zona, v_puesto, v_sueldo, v_monto_pers, v_fijo, v_ingreso
    from public.usuarios u
    left join public.sucursales s on s.nombre = u.sucursal
   where u.id = p_empleado;

  if not found then
    raise exception 'ese empleado no existe';
  end if;

  select n.monto_retardo into v_monto_gral from public.nomina_config n limit 1;

  v_hoy := (now() at time zone v_zona)::date;
  -- El corte de construirDias(): el más tardío entre el arranque de la app y su ingreso.
  v_corte := greatest(public.asistencia_fecha_inicio(), coalesce(v_ingreso, public.asistencia_fecha_inicio()));
  -- Desde el SÁBADO ANTERIOR, como inicioConArrastre(): su salida se cobra en esta semana.
  v_inicio := greatest(p_desde - 2, v_corte);

  return query
  with dias as (
    select d::date as fecha
      from generate_series(v_inicio, p_hasta, interval '1 day') d
  ),
  horario as (
    select h.dia_semana, h.hora_entrada, h.hora_salida, h.tolerancia_min
      from public.horarios h
     where h.empleado_id = p_empleado
  ),
  vivas as (
    -- Por `asistencias.fecha` —el día local que fijó el servidor— como construirDias(). Las
    -- anuladas no existen para este cálculo.
    select a.fecha, a.tipo::text as tipo, a.marcada_en, a.origen::text as origen
      from public.asistencias a
     where a.empleado_id = p_empleado
       and coalesce(a.anulada, false) = false
       and a.fecha between v_inicio and p_hasta
  ),
  checadas as (
    -- La PRIMERA entrada y la ÚLTIMA salida (emparejarChecadas). De la salida importa también
    -- quién la puso: la del job de medianoche (`sistema`) cuenta como no marcada.
    select d.fecha,
           (select min(v.marcada_en) from vivas v where v.fecha = d.fecha and v.tipo = 'entrada') as entrada,
           ult.marcada_en as salida,
           ult.origen     as origen_salida
      from dias d
      left join lateral (
        select v.marcada_en, v.origen
          from vivas v
         where v.fecha = d.fecha and v.tipo = 'salida'
         order by v.marcada_en desc
         limit 1
      ) ult on true
  ),
  crudo as (
    select
      d.fecha,
      h.hora_entrada,
      h.hora_salida,
      h.tolerancia_min,
      c.entrada,
      c.salida,
      c.origen_salida,
      -- `justificacion` de clasificarDia(): cualquier permiso o vacación aprobados.
      (exists (select 1 from public.permisos p
                where p.empleado_id = p_empleado and p.estado = 'aprobado'
                  and d.fecha between p.fecha and coalesce(p.fecha_fin, p.fecha))
       or exists (select 1 from public.vacaciones v
                   where v.empleado_id = p_empleado and v.estado = 'aprobado'
                     and d.fecha between v.fecha_inicio and v.fecha_fin)) as justificado,
      -- `justificacionRetardo`: igual, pero un permiso de SALIDA ANTICIPADA no perdona el retardo.
      (exists (select 1 from public.permisos p
                where p.empleado_id = p_empleado and p.estado = 'aprobado'
                  and d.fecha between p.fecha and coalesce(p.fecha_fin, p.fecha)
                  and coalesce(p.causa::text, '') <> 'salida_anticipada')
       or exists (select 1 from public.vacaciones v
                   where v.empleado_id = p_empleado and v.estado = 'aprobado'
                     and d.fecha between v.fecha_inicio and v.fecha_fin)) as justifica_retardo,
      -- esFestivoEfectivo(): festivo de calendario que no cedió, o el destino que ganó.
      ((exists (select 1 from public.festivos f where f.fecha = d.fecha)
        and not exists (select 1 from public.intercambios_dia i
                         where i.empleado_id = p_empleado and i.estado = 'aprobado'
                           and i.fecha_festivo = d.fecha))
       or exists (select 1 from public.intercambios_dia i
                   where i.empleado_id = p_empleado and i.estado = 'aprobado'
                     and i.fecha_destino = d.fecha)) as festivo,
      -- Minutos DESPUÉS de la hora de entrada, en hora y minuto locales (los segundos no
      -- cuentan: 9:10:59 es llegar a las 9:10, como minutosLocales()).
      case
        when c.entrada is null or h.hora_entrada is null then 0
        else greatest(0,
          (extract(hour from (c.entrada at time zone v_zona))::integer * 60
           + extract(minute from (c.entrada at time zone v_zona))::integer)
          - (extract(hour from h.hora_entrada)::integer * 60 + extract(minute from h.hora_entrada)::integer))
      end as retardo_min,
      -- Minutos ANTES de la hora de salida, mismo criterio.
      case
        when c.salida is null or h.hora_salida is null then 0
        else greatest(0,
          (extract(hour from h.hora_salida)::integer * 60 + extract(minute from h.hora_salida)::integer)
          - (extract(hour from (c.salida at time zone v_zona))::integer * 60
             + extract(minute from (c.salida at time zone v_zona))::integer))
      end as antes_min
      from dias d
      left join horario  h on h.dia_semana = extract(isodow from d.fecha)::smallint
      left join checadas c on c.fecha = d.fecha
  ),
  hechos as (
    select r.*,
      r.entrada is not null and r.retardo_min > coalesce(r.tolerancia_min, 0) as es_retardo,
      -- aplicaSalida: turno, entrada, sin permiso/vacación, y desde la fecha de arranque.
      (r.hora_entrada is not null and r.entrada is not null and not r.justificado
       and r.fecha >= public.asistencia_inicio_salida_anticipada()) as aplica_salida
      from crudo r
  ),
  salidas as (
    select h.*,
      -- coalesce: una salida sin origen es una salida real (`origen === "sistema"` da false), y
      -- sin él la comparación daría null y arrastraría null hasta el cobro.
      (h.aplica_salida and case when h.salida is not null then coalesce(h.origen_salida, '') = 'sistema'
                                else h.fecha < v_hoy end) as sin_marcar
      from hechos h
  ),
  clasificado as (
    select s.*,
      (s.sin_marcar or (s.aplica_salida and s.antes_min >= 10)) as es_salida,
      case
        -- El orden de estas ramas ES la regla (clasificarDia); cambiarlo cambia lo que se cobra.
        when s.hora_entrada is null then 'descanso'
        when s.entrada is null and s.salida is null then
          case
            when s.festivo                                   then 'festivo'
            when s.justificado                               then 'justificado'
            when s.fecha >= v_hoy                            then 'pendiente'
            when s.fecha <= public.asistencia_fin_prueba()   then 'prueba'
            else 'falta'
          end
        when s.salida is null                                then 'incompleto'
        when s.es_retardo and s.justifica_retardo            then 'justificado'
        when s.es_retardo                                    then 'retardo'
        else 'presente'
      end as estado_dia
      from salidas s
  ),
  cobro as (
    select c.*,
      c.fecha < p_desde                          as es_arrastre,
      extract(isodow from c.fecha) >= 6          as fin_de_semana,
      -- cobraRetardo(): un RETARDO, o un día sin salida en el que llegó tarde sin justificante.
      (c.estado_dia = 'retardo'
       or (c.estado_dia = 'incompleto' and c.es_retardo and not c.justifica_retardo)) as cobra_ret
      from clasificado c
  ),
  montos as (
    select k.*,
      -- descuentoDelDia(): el personal gana sobre el de becario, que gana sobre el general.
      case
        when v_fijo or k.es_arrastre then 0::numeric
        when k.cobra_ret then coalesce(
          v_monto_pers,
          case when lower(coalesce(v_puesto, '')) like '%becari%' then 50::numeric end,
          v_monto_gral,
          0::numeric)
        when k.estado_dia = 'falta' then round(coalesce(v_sueldo, 0) / 7.0, 2)
        else 0::numeric
      end as del_estado,
      -- La salida del fin de semana, una semana después: en su semana no, en la siguiente sí.
      case
        when v_fijo then 0::numeric
        when k.es_salida and (case when k.es_arrastre then k.fin_de_semana else not k.fin_de_semana end)
          then 100::numeric
        else 0::numeric
      end as de_salida
      from cobro k
  )
  select
    m.fecha,
    m.estado_dia,
    case when m.estado_dia in ('presente', 'retardo', 'incompleto', 'justificado') then m.retardo_min else 0 end,
    m.entrada,
    m.salida,
    round(m.del_estado + m.de_salida, 2)::numeric(10,2),
    (v_sueldo is not null and v_sueldo > 0),
    m.de_salida::numeric(10,2),
    m.es_salida,
    m.sin_marcar,
    case when m.es_salida then m.antes_min else 0 end,
    (not m.es_arrastre and m.fin_de_semana and m.es_salida),
    m.es_arrastre,
    (not m.es_arrastre and m.cobra_ret),
    v_fijo
    from montos m
   -- Del fin de semana anterior solo lo que se cobra aquí: el resto ya tuvo su semana.
   where not m.es_arrastre or m.de_salida > 0
   order by m.fecha;
end;
$$;

revoke all on function public.resumen_asistencia_semana(uuid, date, date) from public;
grant execute on function public.resumen_asistencia_semana(uuid, date, date) to authenticated;

comment on function public.resumen_asistencia_semana(uuid, date, date) is
  'Estado y descuento de cada día de una semana, con las mismas reglas que construirDias() y calcularNomina() de la web (festivos, salida anticipada y su arrastre, sueldo fijo). Solo lee. Cada empleado, lo suyo; admin/rh/psicologa, el de cualquiera. Migración 177.';


create function public.recibo_semana(
  p_empleado uuid,
  p_desde    date,
  p_hasta    date
)
returns table (
  sueldo_semanal      numeric(10,2),
  descuento           numeric(10,2),
  pago_final          numeric(10,2),
  sin_sueldo          boolean,
  retardos            integer,
  faltas              integer,
  justificados        integer,
  -- El desglose de calcularNomina(), para que la app no tenga que sumar nada.
  salidas_anticipadas integer,
  monto_retardos      numeric(10,2),
  monto_faltas        numeric(10,2),
  monto_salidas       numeric(10,2),
  sueldo_fijo         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bruto numeric(10,2);
  v_sin   boolean;
  v_fijo  boolean;
begin
  if p_empleado is distinct from public.current_usuario_id()
     and coalesce(public.current_role()::text, '') not in ('admin', 'rh', 'psicologa') then
    raise exception 'no autorizado';
  end if;

  select u.sueldo_semanal, coalesce(u.sueldo_fijo, false)
    into v_bruto, v_fijo
    from public.usuarios u where u.id = p_empleado;

  -- Igual que `sinSueldo`: null o <= 0 es "no capturado", no "gana cero".
  v_sin := (v_bruto is null or v_bruto <= 0);

  return query
  with d as (
    select * from public.resumen_asistencia_semana(p_empleado, p_desde, p_hasta)
  ),
  t as (
    select
      coalesce(sum(d.descuento), 0)::numeric(10,2)                                     as total,
      coalesce(sum(d.descuento_salida), 0)::numeric(10,2)                              as salidas,
      coalesce(sum(d.descuento - d.descuento_salida) filter (where d.cobra_retardo), 0)::numeric(10,2) as ret
      from d
  )
  select
    case when v_sin then 0::numeric else v_bruto end,
    t.total,
    case when v_sin then 0::numeric else greatest(0, v_bruto - t.total) end,
    v_sin,
    -- Con sueldo fijo la web no le pasa días a calcularNomina(): no hay retardos ni faltas.
    case when v_fijo then 0 else (select count(*) from d where d.cobra_retardo)::integer end,
    case when v_fijo then 0 else (select count(*) from d where not d.arrastre and d.estado = 'falta')::integer end,
    (select count(*) from d where not d.arrastre and d.estado = 'justificado')::integer,
    (select count(*) from d where d.descuento_salida > 0)::integer,
    t.ret,
    (t.total - t.salidas - t.ret)::numeric(10,2),
    t.salidas,
    v_fijo
    from t;
end;
$$;

revoke all on function public.recibo_semana(uuid, date, date) from public;
grant execute on function public.recibo_semana(uuid, date, date) to authenticated;

comment on function public.recibo_semana(uuid, date, date) is
  'Sueldo, descuento, desglose y pago final de una semana, con las mismas reglas que calcularNomina(). Solo lee. Cada empleado, lo suyo; admin/rh/psicologa, el de cualquiera. Migración 177.';

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   · Paridad contra la web (scripts/paridad-asistencia.*): todos los empleados activos, las
--     últimas 8 semanas, semana a semana y con arrastre. Criterio: 0 diferencias.
--   · Con el JWT de un empleado normal, pedir lo de otro -> ERROR: no autorizado.
--
-- ROLLBACK: volver a aplicar 174 y 175 (en ese orden), que recrean las versiones anteriores.
-- ----------------------------------------------------------------------------
