-- 115 · «lejos» describe una avería, no un recado.
--
-- CONTEXTO (incidente de McDental Palmas, 3 al 6 de agosto de 2026): esta función avisó tres
-- días seguidos, el aviso se leyó, y nadie actuó. No falló la detección: falló que el aviso
-- llegara pesando lo mismo que un recordatorio.
--
-- EL PUNTO QUE SE PASÓ POR ALTO AL ESCRIBIRLA: el branch «lejos» solo se emite cuando
-- `distancia_metros(mediana, punto configurado) > radio_m`. Leído despacio, eso significa que la
-- gente que trabaja ahí está FUERA del área de marcado — o sea que no puede fichar. No existe
-- ningún caso de «lejos» que no sea gente bloqueada. Aun así el texto decía «Conviene revisar la
-- ubicación», que es como describir un incendio diciendo que conviene mirar la cocina.
--
-- Esta migración NO cambia la detección: mismas CTE, mismos umbrales, mismos motivos. Cambia lo
-- que el texto DICE, para que quien lo lea sepa que hay gente que no puede trabajar. La
-- severidad (`critica`) la pone la tarea de fondo, que se cambia en el mismo commit.

create or replace function public.revisar_geocercas()
returns table (
  sucursal_id   uuid,
  nombre        text,
  motivo        text,
  detalle       text,
  lat_sugerida  numeric,
  lng_sugerida  numeric
)
-- Atributos idénticos a los de la versión anterior (comprobado con pg_get_functiondef): si se
-- pierde STABLE, el planificador deja de poder cachearla dentro de una consulta. Los GRANT
-- (postgres y service_role) los conserva CREATE OR REPLACE.
language sql
stable
security definer
set search_path = public
as $$
with checadas as (
  -- Solo checadas utilizables: con GPS, no anuladas y con precisión decente. Un punto con 300 m
  -- de incertidumbre no dice dónde estuvo nadie.
  select a.sucursal_id, a.empleado_id, a.lat, a.lng, a.marcada_en, a.fecha
    from public.asistencias a
   where a.lat is not null
     and a.lng is not null
     and not a.anulada
     and coalesce(a.precision_m, 999) <= 50
     and a.marcada_en > now() - interval '21 days'
),

-- ============ 1) MUDA: fichaban, le pusimos geocerca, dejaron de fichar ============
-- Se comparan dos ventanas de 24 h alrededor del momento en que se fijó: las mismas horas,
-- para no confundir "bloqueados" con "es domingo". Se exige que hayan pasado 24 h desde que se
-- fijó, o el silencio sería simplemente que todavía no ha amanecido.
--
-- SU PUNTO CIEGO, documentado tras el incidente de Palmas: exige CERO checadas después. Si una
-- sola persona sigue fichando —por ejemplo la que movió la geocerca hasta donde ella está— la
-- clínica no cuenta como muda aunque el resto esté bloqueado. El caso parcial no lo ve nadie
-- todavía: ver Fase 2 de plan-red-de-seguridad.md.
mudas as (
  select s.id, s.nombre,
         count(distinct c_antes.empleado_id)   as personas_antes,
         count(c_despues.empleado_id)          as checadas_despues
    from public.sucursales s
    left join checadas c_antes
           on c_antes.sucursal_id = s.id
          and c_antes.marcada_en between s.geocerca_fijada_en - interval '7 days'
                                     and s.geocerca_fijada_en
    left join checadas c_despues
           on c_despues.sucursal_id = s.id
          and c_despues.marcada_en > s.geocerca_fijada_en
   where s.activa
     and s.lat is not null
     and s.geocerca_fijada_en is not null
     and s.geocerca_fijada_en < now() - interval '24 hours'
     and s.geocerca_fijada_en > now() - interval '14 days'
   group by s.id, s.nombre
  having count(distinct c_antes.empleado_id) >= 2
     and count(c_despues.empleado_id) = 0
),

-- ============ 2) LEJOS / PROPUESTA: dónde ficha de verdad la gente ============
-- Mediana y no promedio: con el promedio, una sola checada desde otra ciudad arrastra el centro.
-- La mediana ni se entera. Medido contra la Oficina Administrativa (194 checadas), la mediana
-- cayó a 6 m del punto que se capturó a mano estando ahí.
--
-- OJO, LIMITACIÓN CONOCIDA: los umbrales cuentan personas en el CONJUNTO, pero no exigen que las
-- personas coincidan ENTRE SÍ. Nueve checadas de una persona y cuatro de otras dos pasan por
-- "13 checadas de 3 personas en un mismo punto" cuando la mediana es en realidad la de una sola.
-- Eso es lo que hizo que la propuesta para Palmas apuntara a la Oficina Administrativa, a 996 m
-- de la clínica. Arreglo pendiente: Fase 3 de plan-red-de-seguridad.md.
centros as (
  select c.sucursal_id,
         count(*)                        as muestras,
         count(distinct c.empleado_id)   as personas,
         count(distinct c.fecha)         as dias,
         percentile_cont(0.5) within group (order by c.lat)::numeric as mlat,
         percentile_cont(0.5) within group (order by c.lng)::numeric as mlng
    from checadas c
   group by c.sucursal_id
  having count(*) >= 8
     and count(distinct c.empleado_id) >= 3
     and count(distinct c.fecha) >= 3
)

select m.id, m.nombre, 'muda'::text,
       format('Nadie ha podido fichar desde que se fijó su ubicación, y antes fichaban %s personas. Lo más probable es que la geocerca esté mal puesta y los esté bloqueando.',
              m.personas_antes),
       null::numeric, null::numeric
  from mudas m

union all

-- El texto dice la CONSECUENCIA primero. Antes empezaba por la distancia y terminaba en «conviene
-- revisar la ubicación»: un dato técnico y una sugerencia, para describir a gente que no puede
-- registrar su entrada.
select s.id, s.nombre, 'lejos'::text,
       format('Las %s personas que fichan en %s están FUERA del área de marcado y no pueden registrar entrada: fichan a %s m del punto configurado, y el radio es de %s m. Corrige la ubicación o quítala (sin ubicación, todos pueden fichar).',
              ce.personas, s.nombre,
              public.distancia_metros(ce.mlat, ce.mlng, s.lat, s.lng), s.radio_m),
       ce.mlat, ce.mlng
  from centros ce
  join public.sucursales s on s.id = ce.sucursal_id
 where s.activa
   and s.lat is not null
   and public.distancia_metros(ce.mlat, ce.mlng, s.lat, s.lng) > s.radio_m

union all

-- Las que nadie configuró pero que ya se pueden configurar solas con lo que se ha ido
-- registrando. No es una alarma: es trabajo hecho esperando un visto bueno.
select s.id, s.nombre, 'propuesta'::text,
       format('Sin ubicación configurada, pero %s checadas de %s personas en %s días coinciden en un mismo punto.',
              ce.muestras, ce.personas, ce.dias),
       ce.mlat, ce.mlng
  from centros ce
  join public.sucursales s on s.id = ce.sucursal_id
 where s.activa
   and s.lat is null;
$$;
