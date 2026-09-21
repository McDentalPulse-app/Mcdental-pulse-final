-- 116 · Detectar a la PERSONA que dejó de fichar, no solo a la clínica muda.
--
-- POR QUÉ EXISTE (incidente de McDental Palmas, 3 al 6 de agosto de 2026): la geocerca se movió
-- 996 m y tres de las cuatro personas de la clínica quedaron bloqueadas. Ningún detector lo vio,
-- y no por falta de vigilancia sino porque todos miraban la CLÍNICA en agregado:
--
--   · `muda` (revisar_geocercas) exige CERO checadas tras fijar la geocerca. Sandra siguió
--     fichando desde donde ella misma la había movido, así que la clínica nunca contó como muda.
--   · `lejos` compara la geocerca con la MEDIANA de las checadas. Las 9 de Sandra en la oficina
--     contra 4 en la clínica movieron la mediana con ella: comparar daba 13 m, «ok». El agregado
--     no escondía el problema, lo certificaba como correcto.
--
-- Una persona no se puede esconder detrás de la media de sus compañeros. De ahí este detector.
--
-- ES AGNÓSTICO A LA CAUSA a propósito: no sabe de geocercas. Detecta silencio donde antes había
-- datos, venga de una geocerca mal puesta, de un rostro sin aprobar, de un teléfono nuevo o de la
-- app caída. Una checada rechazada NO deja fila (api/checar.js devuelve 403 antes de escribir),
-- así que el silencio es la única señal que queda.
--
-- ═══ LA MEDIDA ES «DÍAS DESDE QUE SÍ PUDO FICHAR», NO «AUSENCIAS EN LA SEMANA» ═══
--
-- El primer intento contaba días perdidos sueltos en los últimos 7. Contra los datos reales
-- devolvió 18 personas, de las que 16 eran ruido —seis habían fichado ESE MISMO DÍA— y se dejaba
-- fuera justo a las dos doctoras bloqueadas de Palmas. Medir ausencias sueltas es medir
-- ausentismo, que es trabajo de RH; lo que aquí se busca es una persona que se quedó SIN PODER,
-- y eso es una racha que llega hasta hoy.
--
-- Los falsos positivos son el riesgo real, no los falsos negativos: un detector que confunda unas
-- vacaciones con un bloqueo manda avisos que se ignoran, y entonces deja de servir — el mismo
-- final que tuvo el aviso de `lejos`. Por eso se descuenta toda ausencia legítima registrada, se
-- exige un mínimo de 2 días, y se acotan los dos casos a gente de la que SÍ se espera que fiche.

create or replace function public.personas_que_dejaron_de_fichar()
returns table (
  empleado_id      uuid,
  nombre           text,
  sucursal         text,
  motivo           text,
  dias_perdidos    integer,
  ultima_fecha     date,
  detalle          text
)
language sql
stable
security definer
set search_path = public
as $$
with hoy as (
  -- Una sola zona para todos, igual que estado_del_sistema(). Con un umbral de 2 días, la hora de
  -- Hermosillo (una menos) no cambia ninguna conclusión.
  select (now() at time zone 'America/Monterrey')::date as d
),

-- De quién se espera que fiche. Se filtra por ROL y no por «tiene horario asignado»: la primera
-- versión usaba el horario y sacó a la dirección entera (admin, RH y psicóloga tienen horario
-- cargado pero no fichan nunca), tres nombres de ruido en la primera ejecución.
fichadores as (
  select u.id, u.name, u.sucursal, u.fecha_ingreso
    from public.usuarios u
   where not u.inactivo
     and not u.archivado
     and u.role in ('empleado', 'doctor')
),

ultima_entrada as (
  select a.empleado_id,
         max(a.fecha)      as ultima,
         count(*)::integer as entradas
    from public.asistencias a
   where a.tipo = 'entrada'
     and not coalesce(a.anulada, false)
   group by a.empleado_id
),

-- El punto desde el que se cuenta: el día siguiente a la última entrada, o el ingreso si nunca
-- ha fichado. Y se acota a gente RECIENTEMENTE viva en el sistema: quien lleva más de 30 días
-- fuera no es una alarma nueva, es un expediente que alguien tiene que cerrar.
arranque as (
  select f.id as empleado_id, f.name, f.sucursal, f.fecha_ingreso,
         ue.ultima, coalesce(ue.entradas, 0) as entradas,
         case when ue.ultima is not null
              then ue.ultima + 1
              else greatest(coalesce(f.fecha_ingreso, date '1900-01-01'), date '2026-08-01')
         end as desde
    from fichadores f
    left join ultima_entrada ue on ue.empleado_id = f.id
   where (ue.ultima is not null and ue.ultima >= (select d from hoy) - 30)
      or (ue.ultima is null and coalesce(f.fecha_ingreso, date '1900-01-01') >= (select d from hoy) - 30)
),

-- Los días laborables que han pasado desde ese arranque y hasta AYER, descontando todo lo que
-- justifica no haber ido. Hasta ayer y no hasta hoy: contar una mañana en curso avisaría de
-- gente que va a fichar en veinte minutos.
--
-- El periodo de prueba de la app (hasta el 2026-07-31) no eran faltas, eran días en que esto no
-- se usaba. Gemelo de FIN_PERIODO_PRUEBA en src/utils/asistencia.js; fecha fija ya pasada.
perdidos as (
  select a.empleado_id, count(*)::integer as dias_perdidos
    from arranque a
    cross join generate_series(a.desde, (select d from hoy) - 1, interval '1 day') g(dia)
   where g.dia::date > date '2026-07-31'
     and exists (
       select 1 from public.horarios h
        where h.empleado_id = a.empleado_id
          and h.dia_semana = extract(isodow from g.dia)::int
     )
     and not exists (select 1 from public.festivos f where f.fecha = g.dia::date)
     and not exists (
       select 1 from public.vacaciones v
        where v.empleado_id = a.empleado_id
          and v.estado = 'aprobado'
          and g.dia::date between v.fecha_inicio and coalesce(v.fecha_fin, v.fecha_inicio)
     )
     and not exists (
       select 1 from public.permisos p
        where p.empleado_id = a.empleado_id
          and p.estado = 'aprobado'
          and g.dia::date between p.fecha and coalesce(p.fecha_fin, p.fecha)
     )
   group by a.empleado_id
  -- DOS días y no uno: con uno, cualquier despiste de una mañana es una alarma, y una alarma que
  -- se equivoca a menudo deja de leerse.
  having count(*) >= 2
)

-- ============ 1) FICHABA Y DEJÓ DE FICHAR ============
-- Basta UNA entrada previa. La primera versión exigía 3 y por eso se le escaparon las dos
-- doctoras de Palmas, que tenían 2 cada una: quien consiguió fichar aunque fuera una vez es
-- alguien a quien el sistema le funcionaba y dejó de funcionarle.
select a.empleado_id, a.name, a.sucursal,
       'dejo_de_fichar'::text,
       p.dias_perdidos,
       a.ultima,
       format('%s fichaba (última entrada el %s) y lleva %s días laborables sin poder registrar entrada, sin vacaciones ni permiso aprobado. Una checada rechazada no deja rastro, así que esto puede ser un bloqueo y no una ausencia.',
              a.name, to_char(a.ultima, 'DD/MM'), p.dias_perdidos)
  from perdidos p
  join arranque a on a.empleado_id = p.empleado_id
 where a.entradas >= 1

union all

-- ============ 2) ENTRÓ Y NUNCA HA FICHADO ============
-- El caso de Cinthya: entró el 3 de agosto, cuenta creada el 4, bloqueada desde su primer día.
-- Cero checadas en tres días de trabajo, y nadie se enteró hasta que ella escribió a Soporte TI.
-- Nada vigilaba la primera semana de nadie.
select a.empleado_id, a.name, a.sucursal,
       'nunca_ficho'::text,
       p.dias_perdidos,
       null::date,
       format('%s entró el %s y NUNCA ha registrado una entrada, con %s días laborables ya pasados. O no ha podido, o no sabe cómo, o le falta algo de su alta (rostro, contraseña, sucursal).',
              a.name, to_char(a.fecha_ingreso, 'DD/MM/YYYY'), p.dias_perdidos)
  from perdidos p
  join arranque a on a.empleado_id = p.empleado_id
 where a.entradas = 0;
$$;

revoke all on function public.personas_que_dejaron_de_fichar() from public;
grant execute on function public.personas_que_dejaron_de_fichar() to service_role;
