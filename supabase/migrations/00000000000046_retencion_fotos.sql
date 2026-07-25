-- ============================================================================
-- Retención: las selfies de checada se borran a la semana; los rostros, cada 6 meses.
--
-- HASTA AHORA NO SE BORRABA NADA. Nunca. 60 empleados x 2 checadas x 250 días son unas
-- 30.000 fotos al año — y guardar la cara de la plantilla, con hora y coordenada al lado,
-- indefinidamente, no es un problema de espacio: es un problema legal. Un dato biométrico se
-- conserva el tiempo necesario para su finalidad, y la finalidad de la selfie de una checada
-- es comprobar ESA checada. A los seis meses ya no sirve para nada; solo es riesgo acumulado.
--
-- DOS RELOJES DISTINTOS:
--
--   - Selfie de checada: 7 días. Es la evidencia de un momento. Si RH va a mirar una checada
--     dudosa, lo hace esa semana; si no, no lo va a hacer nunca.
--   - Cara de referencia: vive mientras la persona trabaje aquí, pero se REHACE cada 6 meses
--     (la gente cambia: barba, gafas, peso) y al rehacerla se borran las fotos anteriores.
--
-- LO QUE NO SE BORRA: el REGISTRO de la checada. La hora, la ubicación, si la cara coincidió
-- y con cuánto parecido — todo eso se conserva íntegro. Es un documento laboral. Lo que se va
-- es la imagen.
--
-- LA TRAMPA QUE ESTA MIGRACIÓN EVITA:
--
-- Si al borrar la foto se dejara `selfie_path` en null a secas, TODAS las checadas de más de
-- una semana pasarían a "requiere revisión" — porque una checada sin foto está marcada como
-- sospechosa (es un hueco: alguien fichó sin dejar evidencia). El panel de RH se llenaría de
-- ruido viejo y las alertas de verdad se perderían dentro.
--
-- Por eso `foto_purgada`: distingue "nunca hubo foto" (sospechoso) de "la foto se borró
-- porque tocaba" (normal). Son dos cosas que se parecen en la base y no se parecen en nada
-- en la realidad.
-- ============================================================================

alter table public.asistencias
  add column if not exists foto_purgada boolean not null default false;

comment on column public.asistencias.foto_purgada is
  'true = la selfie se borró por política de retención (7 días). NO es lo mismo que una checada sin foto: esa es un hueco sospechoso, esta es el funcionamiento normal. Si no se distinguieran, todas las checadas viejas saldrían marcadas en el panel de RH.';

-- Índice para el barrido semanal: busca fotos viejas que aún no se han purgado.
create index if not exists idx_asistencias_purga
  on public.asistencias (fecha)
  where selfie_path is not null and foto_purgada = false;


-- ¿Cuándo hay que volver a tomarle la cara?
alter table public.rostros
  add column if not exists vence_en timestamptz;

comment on column public.rostros.vence_en is
  'Cuándo caduca la cara de referencia (6 meses desde la aprobación). La gente cambia —barba, gafas, peso— y una referencia vieja empieza a rechazar a su propio dueño. Al volver a registrarse, las fotos anteriores se borran.';

-- A los rostros que ya existen se les pone fecha desde su aprobación.
update public.rostros
set vence_en = coalesce(revisado_en, created_at) + interval '6 months'
where vence_en is null;


-- Los intentos fallidos de cotejo tampoco se purgaban NUNCA. El contador solo mira los
-- últimos 15 minutos, así que las filas viejas no molestaban a nadie... pero ahí seguían,
-- creciendo sin techo. La tabla de cuota de la IA (migración 033) sí se autolimpia; esta se
-- quedó sin hacerlo.
--
-- Se conservan 30 días: los recientes son la señal que RH mira ("alguien intentó suplantar a
-- Ana cuatro veces"); los de hace un mes ya no le dicen nada a nadie.
create index if not exists idx_cotejo_intentos_purga
  on public.cotejo_intentos (creado_en);

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select count(*) from public.asistencias where foto_purgada;  -> 0 al principio
--   select vence_en from public.rostros;  -> aprobación + 6 meses
--
--   El barrido lo hace api/limpiar-fotos.js, llamado por un cron de Vercel: borrar de
--   Storage NO se puede hacer desde SQL (storage.objects tiene un trigger que lo impide, para
--   que no queden archivos huérfanos sin fila que los referencie).
--
-- ROLLBACK:
--   alter table public.asistencias drop column if exists foto_purgada;
--   alter table public.rostros drop column if exists vence_en;
-- ----------------------------------------------------------------------------
