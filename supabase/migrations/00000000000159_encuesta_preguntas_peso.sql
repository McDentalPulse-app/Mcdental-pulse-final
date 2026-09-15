-- ============================================================================
-- 159 — Pesos por pregunta, y borrado de preguntas sin perder el histórico.
--
-- Dos cosas que RH no podía hacer desde la app y ahora sí:
--
--   a) PESOS. Hasta hoy el Pulse Score era la media SIMPLE de las escalas del núcleo: las
--      diez preguntas pesaban exactamente igual, así que "¿cómo describes tu estado
--      emocional?" contaba lo mismo que cualquier otra. Con `peso` una pregunta puede
--      contar doble o triple sin tener que duplicarla.
--
--      Con todos los pesos en 1 —que es el default, y por tanto el estado en el que queda
--      la base justo después de esta migración— la fórmula da EXACTAMENTE el mismo número
--      que antes: media ponderada con todos los pesos iguales ES la media simple. Y el
--      histórico no se toca de todas formas, porque el trigger es BEFORE INSERT y solo
--      corre sobre encuestas nuevas.
--
--      `smallint` de 1 a 5 y no `numeric`: mantiene la suma ponderada en enteros, que es
--      más fácil de explicar y de auditar que un 1.75. Ojo con lo que esto NO garantiza:
--      que los pesos sean enteros no basta para que el cálculo del cliente coincida con
--      este. Lo que lo garantiza es el orden de las operaciones —multiplicar antes de
--      dividir, en los dos lados—; el cliente lo hacía al revés y devolvía 57 donde este
--      `numeric` devuelve 58 (ver el comentario de calcularScoreEncuesta en
--      src/utils/pulseScore.js). Aquí no hace falta reordenar nada porque `numeric` es
--      decimal exacto, pero cualquier reescritura de esta fórmula debe respetar el mismo
--      orden que la del cliente.
--
--   b) BORRADO. Una pregunta ya contestada NO se puede borrar: las respuestas viven en el
--      jsonb `encuestas.respuestas` indexadas por el id de la pregunta, así que borrarla
--      deja números huérfanos que ningún reporte sabe ya leer. El editor de la app
--      comprueba eso mismo antes de ofrecer el botón, pero esa comprobación mira las
--      encuestas que el navegador tiene cargadas — este trigger es la garantía de verdad,
--      y cubre también a quien entre por la API o por el SQL editor.
--
--      Para reformular una pregunta contestada el camino sigue siendo el de siempre:
--      desactivarla y crear otra.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- a) La columna.
-- ----------------------------------------------------------------------------

alter table public.encuesta_preguntas
  add column if not exists peso smallint not null default 1
    check (peso between 1 and 5);

comment on column public.encuesta_preguntas.peso is
  'Cuánto cuenta esta pregunta en el Pulse Score (1 = normal, 5 = cuenta por cinco). '
  'Solo tiene efecto en las escalas del núcleo: las de bloque no puntúan. Entero a '
  'propósito, para que el cálculo del servidor y el del cliente no puedan divergir.';

-- ----------------------------------------------------------------------------
-- b) El score, ahora ponderado. Misma validación de siempre, nada se afloja.
--
-- Vuelve `security definer`: la migración 031 lo puso con un motivo explícito —leer
-- encuesta_preguntas no debe depender del RLS de quien inserta— y la 105 lo perdió sin
-- quererlo, porque CREATE OR REPLACE reemplaza la definición ENTERA y omitir el atributo
-- lo devuelve a security invoker. Hoy funciona de casualidad (la policy de select es para
-- cualquier autenticado); si esa policy se estrechara algún día, las encuestas dejarían de
-- guardarse sin que nadie relacionara una cosa con la otra.
-- ----------------------------------------------------------------------------

create or replace function public.encuestas_calcular_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pregunta   record;
  n_escala   integer := 0;
  suma       numeric := 0;
  peso_total numeric := 0;
  valor      numeric;
  bruto      jsonb;
  score_calc integer;
begin
  for pregunta in
    select id, peso from public.encuesta_preguntas
     where tipo = 'escala' and activa and bloque_id is null
  loop
    n_escala := n_escala + 1;
    bruto := new.respuestas -> pregunta.id::text;

    -- Debe existir y ser un número. Un texto ("Sí") o un null no valen: sin la
    -- respuesta no hay score que calcular, y aceptarlo abriría de nuevo la puerta a
    -- mandar un score inventado.
    if bruto is null or jsonb_typeof(bruto) <> 'number' then
      raise exception
        'Falta la respuesta (o no es numérica) de una pregunta de escala: no se puede calcular el Pulse Score.';
    end if;

    valor := bruto::text::numeric;
    if valor < 1 or valor > 10 then
      raise exception 'Respuesta fuera del rango 1-10 en una pregunta de escala: %.', valor;
    end if;

    suma := suma + valor * pregunta.peso;
    peso_total := peso_total + pregunta.peso;
  end loop;

  -- Misma guarda que calcularScoreEncuesta() en el cliente: sin preguntas de escala,
  -- el promedio dividiría entre cero. `peso_total` no necesita guarda propia: el CHECK
  -- de la columna impide un peso de 0, así que con n_escala > 0 siempre es > 0.
  if n_escala = 0 then
    raise exception
      'La encuesta no tiene preguntas de escala activas en el núcleo: no se puede calcular el Pulse Score.';
  end if;

  -- `numeric`, NO coma flotante: round() sobre float8 usa redondeo bancario (half-to-even)
  -- y divergiría del Math.round de JS en los empates (.5). Sobre numeric redondea
  -- half-away-from-zero, que para valores positivos es exactamente lo mismo que Math.round.
  score_calc := round((suma / (peso_total * 10)) * 100);

  new.score := score_calc;
  new.semaforo := case
    when score_calc >= 80 then 'verde'
    when score_calc >= 60 then 'amarillo'
    else 'rojo'
  end;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- c) No se borra una pregunta que alguien ya contestó.
-- ----------------------------------------------------------------------------

create or replace function public.encuesta_preguntas_bloquear_borrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claves text[];
begin
  -- `legacy_id` entra en la lista porque las encuestas migradas de Firestore guardaron la
  -- respuesta bajo la clave numérica vieja, no bajo el uuid. Mirar solo el uuid dejaría
  -- borrar justo las preguntas con más histórico detrás.
  claves := array[old.id::text];
  if old.legacy_id is not null then
    claves := claves || old.legacy_id::text;
  end if;

  -- ponytail: recorre encuestas entera por cada borrado. Borrar una pregunta es algo que
  -- pasa un puñado de veces al año, así que no compensa un índice GIN sobre `respuestas`.
  if exists (
    select 1
      from public.encuestas e,
           lateral unnest(claves) as k
     where jsonb_typeof(e.respuestas) = 'object'
       and e.respuestas ? k
       and e.respuestas -> k <> 'null'::jsonb
       and e.respuestas -> k <> '""'::jsonb
  ) or exists (
    -- Forma antigua: `respuestas` como ARRAY, con el valor en la posición legacy_id - 1
    -- (readRespuesta, en src/utils/encuestaDetail.js, todavía la lee así). Hace falta una
    -- rama propia porque sobre un array el operador `?` comprueba si existe un ELEMENTO de
    -- texto igual a la clave, no un índice: la rama de arriba no vería esas filas y el
    -- trigger dejaría borrar una pregunta contestada.
    select 1
      from public.encuestas e
     where jsonb_typeof(e.respuestas) = 'array'
       and old.legacy_id is not null
       -- Acotado antes de castear: `legacy_id` es bigint (la migración 018 lo ensanchó a
       -- propósito), y un valor por encima de int32 reventaría el cast con un «integer out
       -- of range» crudo — fallando el borrado de una pregunta que quizá nadie contestó, y
       -- sin el mensaje explicativo del trigger. Fuera de este rango no hay array que mirar:
       -- ningún array tiene 2.147 millones de posiciones.
       and old.legacy_id between 1 and 2147483647
       and e.respuestas -> ((old.legacy_id - 1)::int) is not null
       and e.respuestas -> ((old.legacy_id - 1)::int) <> 'null'::jsonb
       and e.respuestas -> ((old.legacy_id - 1)::int) <> '""'::jsonb
  ) then
    raise exception
      'La pregunta "%" ya tiene respuestas guardadas y no se puede borrar. Desactívala: deja de aparecer en la encuesta y el histórico se conserva.',
      old.texto
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_encuesta_preguntas_bloquear_borrado on public.encuesta_preguntas;

create trigger trg_encuesta_preguntas_bloquear_borrado
  before delete on public.encuesta_preguntas
  for each row execute function public.encuesta_preguntas_bloquear_borrado();

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en una transacción con rollback, para no dejar rastro):
--
--   1) Con todos los pesos en 1, insertar una encuesta -> el score debe salir IGUAL que
--      con la fórmula vieja (media simple). Es la prueba de que esta migración no mueve
--      ningún número por sí sola.
--
--   2) Subir el peso de una escala a 3 e insertar la MISMA encuesta -> el score debe
--      moverse hacia el valor de esa pregunta.
--
--   3) Borrar una pregunta que nadie contestó -> debe funcionar.
--
--   4) Borrar una pregunta contestada -> debe FALLAR con "ya tiene respuestas guardadas".
--
-- ROLLBACK:
--   drop trigger if exists trg_encuesta_preguntas_bloquear_borrado on public.encuesta_preguntas;
--   drop function if exists public.encuesta_preguntas_bloquear_borrado();
--   alter table public.encuesta_preguntas drop column peso;
--   -- y restaurar encuestas_calcular_score() desde la migración 105.
--
-- Nota: a partir de aquí, una migración que necesite borrar preguntas en bloque (como hizo
-- la 108 con los bloques viejos) tiene que desactivar el trigger primero, o limitarse a
-- borrar preguntas sin respuestas.
-- ----------------------------------------------------------------------------
