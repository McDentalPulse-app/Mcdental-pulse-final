-- Banco NUEVO de bloques rotativos, y encenderlos.
--
-- ============================================================================
-- QUÉ ES ESTO Y POR QUÉ AHORA
-- ============================================================================
--
-- La rotación quincenal existe desde la migración 105 y funciona: el bloque se DERIVA de la
-- semana (src/utils/encuestaBloques.js), sin cron ni calendario. Lo que faltaba era contenido.
--
-- Los cuatro bloques que había se quedaron `activo = false` desde el 2026-07-30, así que la
-- encuesta llevaba desde entonces siendo solo el núcleo. Se sustituyen por seis nuevos.
--
-- BORRARLOS ES SEGURO, y se comprobó antes de escribir esto:
--
--     select count(*) from encuestas e
--      where exists (select 1 from encuesta_preguntas p
--                     where p.bloque_id is not null and e.respuestas ? p.id::text);
--     -- 0, sobre 121 encuestas
--
-- Nadie contestó nunca una pregunta de bloque, porque ninguno llegó a estar activo. No hay
-- historial que preservar. Si esto se repitiera en el futuro con bloques YA usados, NO se
-- borran: se ponen en `activo = false` y se quedan, porque el detalle de las encuestas viejas
-- lee el enunciado desde aquí y sin la fila saldrían como "Pregunta registrada" sin texto.
--
-- ============================================================================
-- SOLO BIENESTAR (decisión del 2026-08-04)
-- ============================================================================
--
-- Esto es una encuesta de BIENESTAR, y los bloques se quedan dentro de ese terreno. Una
-- primera versión de este banco preguntaba por insumos, instalaciones y organización de
-- turnos: son cosas legítimas de saber, pero son operación, no bienestar, y mezclarlas cambia
-- lo que la encuesta significa para quien la contesta. También se descartó un bloque sobre el
-- trato con pacientes.
--
-- Los seis bloques cubren facetas del bienestar que el NÚCLEO no toca:
--
--     el núcleo ya pregunta ...  estado emocional, estrés, satisfacción, relaciones, jefe
--                                directo, carga, problema personal, motivación, renuncia
--     los bloques añaden ......  descanso, reconocimiento, confianza para hablar, cómo anda
--                                el cuerpo, la vida fuera del trabajo, y sentido/crecimiento
--
-- ESCALAS SIEMPRE EN EL MISMO SENTIDO: más alto = mejor. Es la convención del núcleo y la que
-- da por hecha `formatEscalaValor` al traducir el número a "Muy alto / Alto / Moderado…". Por
-- eso el bloque del cuerpo pregunta "¿qué tan bien se ha sentido tu cuerpo?" y no "¿cuántas
-- molestias tuviste?": invertir una sola escala haría que un 9 significara lo contrario que en
-- todas las demás, y quien lea el informe no tiene por qué acordarse de cuál era cuál.
--
-- ============================================================================
-- REGLAS QUE CUMPLE EL CONTENIDO
-- ============================================================================
--
--   · Las preguntas de bloque NO puntúan en el Pulse Score (`repartirPreguntas`). Es
--     deliberado: el score compara semanas entre sí, y una escala que aparece una quincena y
--     desaparece la siguiente movería el número sin que hubiera cambiado nada del bienestar.
--     El "mismo peso" es DENTRO del bloque, no contra el núcleo.
--
--   · Ninguna usa un área reservada (`AREAS_RESERVADAS` en encuestaBloques.js): Riesgo,
--     Comentarios, Emocional, Estrés, Liderazgo, Motivación, Relaciones, Satisfacción, Carga
--     y Personal son del núcleo. Un bloque que usara "Riesgo" le robaría la fuente al riesgo
--     de renuncia, que es la respuesta más importante de la encuesta.
--
--   · Formato igual al de siempre: 2 escalas + 1 abierta o sí/no por bloque.
--
--   · `orden` 11, 12 y 13 dentro de cada bloque, detrás de las 10 del núcleo.
--
-- Con SEIS bloques activos el ciclo dura DOCE semanas: a cada persona le vuelve a tocar el
-- mismo tema tres meses después, no cada dos.
--
-- ============================================================================

begin;

-- 1. Fuera los cuatro que nunca se usaron. El orden importa: la FK es ON DELETE RESTRICT.
delete from encuesta_preguntas where bloque_id is not null;
delete from encuesta_bloques;

-- 2. Los seis nuevos, ya encendidos.
insert into encuesta_bloques (id, nombre, descripcion, orden, activo) values
  ('a1000000-0000-4000-8000-000000000001', 'Descanso y energía',
   'Si llegan con batería y si alcanzan a desconectar al salir.', 1, true),
  ('a1000000-0000-4000-8000-000000000002', 'Reconocimiento',
   'Si sienten que su trabajo se nota y que cuenta para alguien.', 2, true),
  ('a1000000-0000-4000-8000-000000000003', 'Confianza para hablar',
   'Si pueden decir lo que piensan y pedir ayuda sin que les cueste.', 3, true),
  ('a1000000-0000-4000-8000-000000000004', 'Cómo anda tu cuerpo',
   'Sueño y desgaste físico, que es por donde el estrés se nota primero.', 4, true),
  ('a1000000-0000-4000-8000-000000000005', 'Tu vida fuera del trabajo',
   'Si les queda tiempo y cabeza para lo suyo y para su gente.', 5, true),
  ('a1000000-0000-4000-8000-000000000006', 'Sentido y crecimiento',
   'Si lo que hacen les significa algo y si sienten que avanzan.', 6, true);

-- 3. Sus preguntas.
insert into encuesta_preguntas (texto, tipo, area, opciones, orden, activa, bloque_id) values

  -- Q1 · Descanso y energía
  ('¿Qué tan descansado/a llegaste a trabajar estas dos semanas?',
   'escala', 'Descanso', null, 11, true, 'a1000000-0000-4000-8000-000000000001'),
  ('¿Qué tanto lograste desconectar del trabajo al terminar tu turno?',
   'escala', 'Desconexión', null, 12, true, 'a1000000-0000-4000-8000-000000000001'),
  ('¿Qué te ayudaría a llegar con más energía a tu jornada?',
   'abierta', 'Qué ayudaría', null, 13, true, 'a1000000-0000-4000-8000-000000000001'),

  -- Q2 · Reconocimiento
  ('¿Qué tanto sentiste que tu trabajo se nota y se valora?',
   'escala', 'Reconocimiento', null, 11, true, 'a1000000-0000-4000-8000-000000000002'),
  ('¿Qué tan a gusto te fuiste a casa con lo que lograste estas dos semanas?',
   'escala', 'Logro propio', null, 12, true, 'a1000000-0000-4000-8000-000000000002'),
  ('¿Hay algo que hiciste estas dos semanas y sientes que pasó desapercibido?',
   'abierta', 'Lo que no se vio', null, 13, true, 'a1000000-0000-4000-8000-000000000002'),

  -- Q3 · Confianza para hablar
  ('¿Qué tanta confianza sientes para decir lo que piensas en tu equipo?',
   'escala', 'Confianza para opinar', null, 11, true, 'a1000000-0000-4000-8000-000000000003'),
  ('¿Qué tan cómodo/a te sientes pidiendo ayuda cuando la necesitas?',
   'escala', 'Pedir ayuda', null, 12, true, 'a1000000-0000-4000-8000-000000000003'),
  ('¿Hay algo que te gustaría decir y no has encontrado el momento?',
   'abierta', 'Lo que no se ha dicho', null, 13, true, 'a1000000-0000-4000-8000-000000000003'),

  -- Q4 · Cómo anda tu cuerpo
  ('¿Qué tan bien has dormido estas dos semanas?',
   'escala', 'Sueño', null, 11, true, 'a1000000-0000-4000-8000-000000000004'),
  ('¿Qué tan bien se ha sentido tu cuerpo al terminar la jornada?',
   'escala', 'Desgaste físico', null, 12, true, 'a1000000-0000-4000-8000-000000000004'),
  ('¿Hay alguna molestia física que se te esté haciendo constante?',
   'sino', 'Molestia constante', null, 13, true, 'a1000000-0000-4000-8000-000000000004'),

  -- Q5 · Tu vida fuera del trabajo
  ('¿Qué tanto tiempo tuviste para tus cosas y para tu gente?',
   'escala', 'Tiempo propio', null, 11, true, 'a1000000-0000-4000-8000-000000000005'),
  ('¿Qué tan tranquilo/a estuviste en tus días de descanso?',
   'escala', 'Tranquilidad', null, 12, true, 'a1000000-0000-4000-8000-000000000005'),
  ('¿Qué es lo que más te está quitando tiempo o tranquilidad ahora mismo?',
   'abierta', 'Lo que pesa', null, 13, true, 'a1000000-0000-4000-8000-000000000005'),

  -- Q6 · Sentido y crecimiento
  ('¿Qué tanto sientes que lo que haces tiene sentido?',
   'escala', 'Sentido', null, 11, true, 'a1000000-0000-4000-8000-000000000006'),
  ('¿Qué tanto sientes que estás creciendo, en lo personal y en lo profesional?',
   'escala', 'Crecimiento', null, 12, true, 'a1000000-0000-4000-8000-000000000006'),
  ('¿Hay algo que te gustaría aprender o hacer distinto?',
   'abierta', 'Qué te gustaría', null, 13, true, 'a1000000-0000-4000-8000-000000000006');

-- 4. Red de seguridad: que ninguna pise un área del núcleo.
--    Si esto falla, la transacción entera se deshace y la encuesta se queda como estaba.
do $$
declare
  chocan text;
begin
  select string_agg(distinct p.area, ', ') into chocan
    from encuesta_preguntas p
   where p.bloque_id is not null
     -- `translate` y no `unaccent`: la extensión no está instalada en esta base, y añadirla
     -- solo para comparar diez palabras sería pagar de más. Quita las tildes que aparecen en
     -- las áreas del núcleo ("Estrés", "Motivación", "Satisfacción").
     and lower(translate(p.area, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) = any (array[
       'riesgo','comentarios','emocional','estres','liderazgo','motivacion',
       'relaciones','satisfaccion','carga','personal']);
  if chocan is not null then
    raise exception 'Áreas de bloque que chocan con el núcleo: %', chocan;
  end if;
end $$;

commit;
