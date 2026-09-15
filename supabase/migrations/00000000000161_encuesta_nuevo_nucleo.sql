-- ============================================================================
-- 161 — El núcleo de la encuesta pasa a ser otro: ocho preguntas nuevas.
--
-- Petición del dueño. Las seis escalas que puntuaban desde el principio (Emocional,
-- Estrés, Satisfacción, Relaciones, Liderazgo, Motivación) salen, y entran ocho que
-- preguntan por liderazgo, comunicación, equipo y condiciones de trabajo. Se conservan,
-- porque él lo pidió expresamente, las dos de sí/no, la de riesgo de renuncia y la abierta.
--
-- LO QUE ESTO CUESTA, y se aceptó sabiéndolo: el Pulse Score deja de ser comparable con
-- todo el histórico. Hasta hoy salía de aquellas seis escalas; a partir de la próxima
-- encuesta sale de estas ocho, que miden otra cosa. La tendencia, la comparación entre
-- sucursales y el foco rojo arrancan de cero esa semana. No es un efecto colateral que se
-- nos haya pasado: es el precio de cambiar el cuestionario, y no hay forma de evitarlo
-- salvo no cambiarlo.
--
-- LAS VIEJAS NO SE BORRAN, SE DESACTIVAN. Tienen 615 encuestas contestadas detrás y sus
-- respuestas se guardan por id: borrarlas dejaría números que ningún reporte sabría leer
-- (el trigger de la migración 159 lo impediría de todos modos). Desactivadas dejan de
-- aparecer en la encuesta y el histórico sigue entero y legible.
--
-- POR QUÉ LAS ÁREAS SON NUEVAS Y NO REUTILIZAN LAS DE ANTES: `resumenEscalas`
-- (src/utils/encuestaDetail.js) construye el contexto que se manda a la IA con el ÁREA de
-- cada escala — "Emocional=8, Estrés=6". Si una pregunta nueva heredara el área de una
-- vieja, la serie que la IA compara mezclaría dos preguntas distintas bajo el mismo nombre
-- y leería como un cambio de comportamiento lo que solo es un cambio de cuestionario.
-- Ninguna de las ocho pisa tampoco AREAS_RESERVADAS (encuestaBloques.js).
--
-- NADA DE ESTO NECESITA DESPLEGAR FRONTEND: el editor y la encuesta leen lo que haya en la
-- base. Sí conviene aplicarlo cuando no haya nadie a mitad de contestar — quien tenga la
-- encuesta abierta y la envíe después del cambio recibirá un error, porque el trigger le
-- pedirá las ocho escalas nuevas que su pantalla no le llegó a mostrar.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Fuera las seis escalas de siempre. Por ÁREA y no por id: los ids son uuid y
--    distintos en cada base, el área es la misma en todas.
--    El `orden` se manda al fondo (100+) para que no se mezclen con las nuevas en el
--    catálogo del editor, donde las inactivas se siguen viendo.
-- ----------------------------------------------------------------------------
update public.encuesta_preguntas
   set activa = false,
       orden = orden + 100
 where tipo = 'escala'
   and bloque_id is null
   and activa
   and area in ('Emocional', 'Estrés', 'Satisfacción', 'Relaciones', 'Liderazgo', 'Motivación');

-- ----------------------------------------------------------------------------
-- 2. Las ocho nuevas. Todas de escala 1-10, todas del núcleo (puntúan), peso 1 y
--    sin invertir: en las ocho, un número alto es algo BUENO.
-- ----------------------------------------------------------------------------
insert into public.encuesta_preguntas (texto, tipo, area, orden, activa) values
  ('¿Mi jefe directo me proporciona retroalimentación útil y constructiva sobre mi desempeño?',
   'escala', 'Retroalimentación', 1, true),
  ('¿El liderazgo de la empresa comunica claramente los objetivos y la visión de la organización?',
   'escala', 'Visión', 2, true),
  ('¿Siento que mis opiniones y sugerencias son tomadas en cuenta por mis superiores?',
   'escala', 'Voz propia', 3, true),
  ('¿Existe un ambiente de confianza, respeto y colaboración mutua en mi equipo de trabajo?',
   'escala', 'Ambiente de equipo', 4, true),
  ('¿Los conflictos dentro de mi área se resuelven de manera abierta y constructiva?',
   'escala', 'Conflictos', 5, true),
  ('¿La comunicación entre los diferentes departamentos de la empresa es fluida y eficaz?',
   'escala', 'Comunicación interna', 6, true),
  ('¿Tengo las herramientas, equipos y materiales necesarios para realizar mi trabajo diariamente?',
   'escala', 'Herramientas', 7, true),
  ('¿Considero que mi espacio físico de trabajo es un entorno cómodo y seguro?',
   'escala', 'Espacio de trabajo', 8, true);

-- ----------------------------------------------------------------------------
-- 3. Las que se quedan van detrás de las ocho, en el orden en que se contestan mejor:
--    primero las de sí/no, luego la de renuncia y al final la abierta.
-- ----------------------------------------------------------------------------
update public.encuesta_preguntas set orden = 9  where activa and bloque_id is null and tipo = 'sino'    and area = 'Carga';
update public.encuesta_preguntas set orden = 10 where activa and bloque_id is null and tipo = 'sino'    and area = 'Personal';
update public.encuesta_preguntas set orden = 11 where activa and bloque_id is null and tipo = 'opcion'  and area = 'Riesgo';
update public.encuesta_preguntas set orden = 12 where activa and bloque_id is null and tipo = 'abierta' and area = 'Comentarios';

-- ----------------------------------------------------------------------------
-- 4. Red de seguridad. Si algo de esto no se cumple, la transacción entera se deshace y
--    la encuesta se queda exactamente como estaba.
-- ----------------------------------------------------------------------------
do $$
declare
  escalas   integer;
  total     integer;
  faltantes text;
begin
  select count(*) into escalas
    from public.encuesta_preguntas
   where tipo = 'escala' and activa and bloque_id is null;
  if escalas <> 8 then
    raise exception 'Esperaba 8 escalas activas en el núcleo y hay %. La encuesta no queda como se pidió.', escalas;
  end if;

  select count(*) into total
    from public.encuesta_preguntas
   where activa and bloque_id is null;
  if total <> 12 then
    raise exception 'Esperaba 12 preguntas activas en el núcleo (8 escalas + 2 sino + renuncia + abierta) y hay %.', total;
  end if;

  -- Las cuatro que se conservan tienen que seguir ahí: si una se quedó fuera por un área
  -- escrita distinta, el reporte de RH o el motor de riesgo se quedarían mudos en silencio.
  select string_agg(f.falta, ', ') into faltantes
    from (values ('Carga'), ('Personal'), ('Riesgo'), ('Comentarios')) as f(falta)
   where not exists (
     select 1 from public.encuesta_preguntas p
      where p.activa and p.bloque_id is null and p.area = f.falta
   );
  if faltantes is not null then
    raise exception 'Faltan preguntas que debían conservarse: %.', faltantes;
  end if;
end;
$$;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN después de aplicar:
--
--   select orden, tipo, area, activa, left(texto, 50)
--     from encuesta_preguntas where bloque_id is null order by activa desc, orden;
--
--   -> 12 activas (órdenes 1-12) y 6 inactivas (órdenes 101-108).
--
-- Y una encuesta de prueba en transacción con ROLLBACK debe calcular el score con las
-- OCHO escalas nuevas, no con las viejas.
--
-- ROLLBACK:
--   delete from encuesta_preguntas where area in ('Retroalimentación','Visión','Voz propia',
--     'Ambiente de equipo','Conflictos','Comunicación interna','Herramientas','Espacio de trabajo');
--   update encuesta_preguntas set activa = true, orden = orden - 100
--    where tipo='escala' and bloque_id is null and not activa and orden > 100;
--   -- y devolver Carga/Personal/Riesgo/Comentarios a 6/7/9/10.
--   -- Ojo: el delete solo funciona mientras NADIE haya contestado las nuevas.
-- ----------------------------------------------------------------------------
