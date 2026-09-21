-- 117 · Una persona, un voto: la mediana deja de poder secuestrarla una sola.
--
-- EL FALLO (Fase 3 de plan-red-de-seguridad.md). `centros` calculaba la mediana sobre TODAS las
-- checadas, así que quien ficha más pesa más. Los umbrales pedían «>= 3 personas», pero contaban
-- personas en el conjunto sin exigir que coincidieran ENTRE SÍ.
--
-- Medido en McDental Palmas: 9 checadas de Sandra desde la Oficina Administrativa contra 4 de dos
-- doctoras en la clínica. Trece checadas de tres personas, decía el texto. La realidad era una
-- persona repetida nueve veces, y la mediana se mudó con ella: la RPC llegó a proponer como
-- ubicación de la clínica un punto a 996 m, en otro edificio. Aceptar esa propuesta habría vuelto
-- a bloquear a la clínica entera.
--
-- EL ARREGLO: primero el punto habitual de CADA persona (su propia mediana), y luego la mediana de
-- esos puntos. Cada quien vale un voto, fiche una vez o cincuenta.
--
-- Medido contra los datos reales, las 23 sucursales con checadas utilizables:
--   · 22 no se mueven — el centro cambia entre 0 y 3 m, y en todas las personas concuerdan;
--   · Palmas mueve su centro 980 m (vuelve A LA CLÍNICA) y solo 2 de 3 concuerdan.
--
-- ═══ LOS DOS BRANCHES LLEVAN GUARDIANES DISTINTOS, Y NO ES UN DESCUIDO ═══
--
--   · `propuesta` exige ACUERDO (>= 3 personas dentro de 75 m del centro). Es un punto que alguien
--     va a aceptar con un clic, así que ante la duda mejor no proponer nada. Si la gente de una
--     clínica ficha en sitios distintos, lo honesto es callarse.
--
--   · `lejos` NO exige acuerdo, solo el centro. Es una alarma de gente encerrada fuera, y aquí el
--     error caro es el silencio. Con el acuerdo como condición, Palmas habría dejado de disparar
--     `lejos` — o sea que habría desactivado el único detector que sí funcionó en el incidente.
--     Sensibilidad para la alarma, confianza para la sugerencia.
--
-- De hecho este cambio hace `lejos` MÁS sensible, y está medido contra las checadas reales de
-- Palmas (Sandra 9 en la oficina, Juana 2 y Valeria 2 en la clínica):
--
--     mediana VIEJA (una checada, un voto)  ->   13 m de la geocerca mala  ->  «ok», sin alarma
--     mediana NUEVA (una persona, un voto)  ->  992 m de la geocerca mala  ->  dispara `lejos`
--
-- Dos votos contra uno devuelven el centro a la clínica. La alarma que no llegó el 4 de agosto
-- habría llegado el primer día, y con el número correcto.

create or replace function public.revisar_geocercas()
returns table (
  sucursal_id   uuid,
  nombre        text,
  motivo        text,
  detalle       text,
  lat_sugerida  numeric,
  lng_sugerida  numeric
)
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
-- SU PUNTO CIEGO: exige CERO checadas después. Si una sola persona sigue fichando —por ejemplo la
-- que movió la geocerca hasta donde ella está— la clínica no cuenta como muda aunque el resto esté
-- bloqueado. Ese caso lo cubre ahora `personas_que_dejaron_de_fichar()` (mig. 116), que mira a la
-- persona en vez de a la clínica.
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

-- ============ 2) EL PUNTO HABITUAL DE CADA PERSONA ============
-- Mediana y no promedio: con el promedio, una sola checada desde otra ciudad arrastra el punto.
-- La mediana ni se entera. Medido contra la Oficina Administrativa (194 checadas), la mediana
-- cayó a 6 m del punto capturado a mano estando ahí.
--
-- Sin mínimo de checadas por persona a propósito: con la mediana de medianas, quien tiene una sola
-- checada aporta un voto igual que quien tiene cincuenta, y el guardián de acuerdo de abajo ya
-- tolera un voto raro. Exigir 2 por persona dejaba de vigilar Madero y Tampico Obregón, que
-- perdieron una votante cuando alguien dejó de fichar — o sea que castigaba justo a las clínicas
-- con un problema.
por_persona as (
  select c.sucursal_id, c.empleado_id,
         percentile_cont(0.5) within group (order by c.lat)::numeric as plat,
         percentile_cont(0.5) within group (order by c.lng)::numeric as plng
    from checadas c
   group by c.sucursal_id, c.empleado_id
),

-- ============ 3) EL CENTRO DE LA CLÍNICA: la mediana de esos puntos ============
centros as (
  select p.sucursal_id,
         count(*)::int as personas,
         percentile_cont(0.5) within group (order by p.plat)::numeric as mlat,
         percentile_cont(0.5) within group (order by p.plng)::numeric as mlng
    from por_persona p
   group by p.sucursal_id
  having count(*) >= 3
),

-- Volumen, solo para el texto de la propuesta.
volumen as (
  select c.sucursal_id, count(*) as muestras, count(distinct c.fecha) as dias
    from checadas c group by c.sucursal_id
),

-- ============ 4) ¿CUÁNTAS PERSONAS COINCIDEN CON ESE CENTRO? ============
-- 75 m: por encima del error típico del GPS de esta app (mediana 11 m, 98% <= 50 m) y por debajo
-- de la distancia entre dos edificios distintos. Es la frontera entre "el mismo sitio" y "otro".
acuerdo as (
  select ce.sucursal_id, count(*)::int as concuerdan
    from centros ce
    join por_persona p on p.sucursal_id = ce.sucursal_id
   where public.distancia_metros(p.plat, p.plng, ce.mlat, ce.mlng) <= 75
   group by ce.sucursal_id
)

select m.id, m.nombre, 'muda'::text,
       format('Nadie ha podido fichar desde que se fijó su ubicación, y antes fichaban %s personas. Lo más probable es que la geocerca esté mal puesta y los esté bloqueando.',
              m.personas_antes),
       null::numeric, null::numeric
  from mudas m

union all

-- ALARMA: sensibilidad. Sin guardián de acuerdo (ver la cabecera).
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

-- SUGERENCIA: confianza. Con guardián de acuerdo, porque alguien la va a aceptar con un clic.
select s.id, s.nombre, 'propuesta'::text,
       format('Sin ubicación configurada, pero %s personas de %s coinciden en el mismo punto (%s checadas en %s días).',
              a.concuerdan, ce.personas, v.muestras, v.dias),
       ce.mlat, ce.mlng
  from centros ce
  join public.sucursales s on s.id = ce.sucursal_id
  join acuerdo a           on a.sucursal_id = ce.sucursal_id
  join volumen v           on v.sucursal_id = ce.sucursal_id
 where s.activa
   and s.lat is null
   and a.concuerdan >= 3;
$$;
