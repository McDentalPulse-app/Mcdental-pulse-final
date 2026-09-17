-- ============================================================================
-- 160 — Una escala puede ir al revés: marcar si 1 es lo bueno o lo malo.
--
-- EL FALLO QUE ESTO CORRIGE, y que llevaba vivo desde el principio: el Pulse Score suma
-- las escalas del núcleo dando por hecho que MÁS ES MEJOR, sin excepciones. Pero una de
-- las preguntas del núcleo es «¿Qué tan estresado/a te has sentido en el trabajo?», donde
-- más es PEOR. Quien contestaba 10 —muy estresado— se sumaba 10 puntos de bienestar.
--
-- Medido contra los datos reales antes de escribir nada: de 615 encuestas guardadas, al
-- corregir la dirección de esa pregunta CAMBIAN LAS 615, y 173 (el 28%) cambian de
-- semáforo. La media se mueve solo -0.2 puntos, y ahí está el motivo de que nadie lo viera
-- en dos años: en el agregado no se nota nada, pero una de cada cuatro personas está
-- pintada del color equivocado. Y el error va en la peor dirección posible para una
-- herramienta de bienestar: premia con hasta 15 puntos a quien peor está.
--
-- LO QUE ESTA MIGRACIÓN NO HACE, por decisión del dueño: no marca ninguna pregunta como
-- invertida. Solo añade la capacidad, con `false` de default — o sea que el día que se
-- aplique, NINGÚN score cambia. RH decide pregunta por pregunta desde el editor, viendo el
-- texto de cada una. Y tampoco se recalcula el histórico: las 615 encuestas ya guardadas
-- conservan su número (el trigger es BEFORE INSERT). Eso deja un quiebre conocido en la
-- serie el día que se marque la primera pregunta, y es un precio aceptado a cambio de no
-- reescribir informes que direccion y psicología ya leyeron.
--
-- CÓMO SE INVIERTE: `11 - valor`. Con la escala de 1 a 10 eso mapea 1↔10, 2↔9, 3↔8... es
-- exacto y simétrico, sin decimales ni valores fuera de rango. La validación de rango se
-- hace sobre el valor CRUDO (el que mandó el empleado), no sobre el invertido: si alguien
-- manda un 14, el error tiene que hablar del 14 y no de un -3 que nadie escribió.
--
-- ORDEN DE DESPLIEGUE: esta migración va ANTES que el frontend. `preguntaToRow` manda
-- `invertida` en CADA guardado de preguntas, así que un frontend nuevo contra una base sin
-- esta columna rompe el editor entero con un error de columna desconocida de PostgREST. Al
-- revés no pasa nada: la base con la columna y el frontend viejo conviven sin ruido, porque
-- todo nace en `false`. Es el mismo acoplamiento que estableció la 159 con `peso`.
--
-- LA LEYENDA NO ES COSMÉTICA. Sin decirle al empleado hacia dónde va la escala, marcar una
-- pregunta como invertida no arregla el problema: lo mueve de sitio. Por eso el frontend
-- que acompaña a esta migración enseña siempre, debajo de los números, si 1 es «muy
-- negativo» o «muy positivo». Aplicar esta migración sin ese frontend no rompe nada
-- (ninguna pregunta nace invertida), pero marcar una pregunta sin él sí.
-- ============================================================================

begin;

alter table public.encuesta_preguntas
  add column if not exists invertida boolean not null default false;

comment on column public.encuesta_preguntas.invertida is
  'true = en esta escala 1 es lo BUENO y 10 lo malo (p. ej. «¿qué tan estresado?»). '
  'El score usa 11 - valor. Solo aplica a tipo = escala; en las demás no significa nada.';

-- ----------------------------------------------------------------------------
-- El score, ahora con la dirección de cada pregunta. Todo lo demás se conserva: el peso de
-- la 159, el filtro de núcleo de la 105, la validación de rango y el `security definer`.
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
  orientado  numeric;
  bruto      jsonb;
  score_calc integer;
begin
  for pregunta in
    select id, peso, invertida from public.encuesta_preguntas
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
    -- Sobre el valor CRUDO, antes de invertir: el mensaje debe nombrar lo que se mandó.
    if valor < 1 or valor > 10 then
      raise exception 'Respuesta fuera del rango 1-10 en una pregunta de escala: %.', valor;
    end if;

    -- 11 - valor mapea 1↔10, 2↔9, 3↔8... exacto y simétrico dentro del mismo rango.
    orientado := case when pregunta.invertida then 11 - valor else valor end;

    suma := suma + orientado * pregunta.peso;
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
  -- El cliente multiplica antes de dividir por el mismo motivo (ver pulseScore.js).
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

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en una transacción con rollback, para no dejar rastro):
--
--   1) Sin ninguna pregunta invertida, insertar una encuesta -> el score debe salir IGUAL
--      que antes de esta migración. Es la prueba de que aplicarla no mueve nada por sí sola.
--
--   2) Marcar invertida una escala y repetir la MISMA encuesta -> el score debe moverse en
--      el sentido contrario al valor de esa respuesta (un 10 debe empezar a restar).
--
--   3) Una respuesta fuera de rango debe seguir fallando, y el mensaje debe nombrar el
--      valor CRUDO que se mandó.
--
--   4) Con invertida = true y respuesta 10, el aporte debe ser el mismo que con
--      invertida = false y respuesta 1 (simetría exacta de 11 - valor).
--
-- ROLLBACK:
--   alter table public.encuesta_preguntas drop column invertida;
--   -- y restaurar encuestas_calcular_score() desde la migración 159.
-- ----------------------------------------------------------------------------
