-- Vigilancia de geocercas: avisar cuando una está dejando a la gente fuera.
--
-- POR QUÉ HACE FALTA. Desde la migración 103 son las recepcionistas quienes fijan la ubicación
-- de su clínica. Es mucho mejor que viajar a 25 clínicas, pero abre un fallo nuevo: alguien la
-- captura desde su casa o desde el estacionamiento y al día siguiente su clínica entera no puede
-- fichar, porque estar 'fuera' BLOQUEA la checada.
--
-- EL PUNTO CIEGO QUE OBLIGA A ESTE DISEÑO. Lo intuitivo sería contar checadas con
-- ubicacion_estado='fuera'. No sirve: `api/checar.js` responde 403 y NO inserta fila. Una
-- checada bloqueada no deja rastro en ninguna parte. Así que el síntoma de una geocerca mala no
-- es "muchas fuera" — es SILENCIO. Una clínica que fichaba todos los días y de pronto deja de
-- aparecer. Eso es lo que busca 'muda'.
--
-- Se hace en SQL y no en el servidor de Node porque calcular medianas en JavaScript significa
-- traerse todas las checadas de todas las clínicas a memoria para tirarlas después.

create or replace function public.revisar_geocercas()
returns table (
  sucursal_id uuid,
  nombre      text,
  motivo      text,
  detalle     text,
  lat_sugerida numeric,
  lng_sugerida numeric
)
language sql
stable
security definer
set search_path to 'public'
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

select s.id, s.nombre, 'lejos'::text,
       format('La gente ficha a %s m del punto configurado (radio: %s m), con %s checadas de %s personas. Conviene revisar la ubicación.',
              public.distancia_metros(ce.mlat, ce.mlng, s.lat, s.lng), s.radio_m, ce.muestras, ce.personas),
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

-- Solo la llama el cron con la service role. Nadie de la app necesita esto.
--
-- OJO: `revoke from public` NO basta, y comprobarlo costó un susto. Supabase deja puesta una
-- regla de default privileges que concede EXECUTE de toda función nueva de `public` a `anon` y
-- `authenticated`; esa concesión es propia de cada rol y sobrevive al revoke de PUBLIC. Hay que
-- revocarles a ellos por nombre. Verificado después: `authenticated` recibe "permission denied"
-- y `service_role` sigue pudiendo.
revoke all on function public.revisar_geocercas() from public;
revoke all on function public.revisar_geocercas() from anon;
revoke all on function public.revisar_geocercas() from authenticated;
grant execute on function public.revisar_geocercas() to service_role;


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   drop function if exists public.revisar_geocercas();
