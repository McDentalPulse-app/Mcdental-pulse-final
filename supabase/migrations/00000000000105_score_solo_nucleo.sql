-- 105 — El Pulse Score se calcula SOLO con el núcleo, igual que en el cliente.
--
-- Qué estaba roto: el trigger recorría TODAS las preguntas de escala activas —núcleo y
-- bloques— y exigía respuesta numérica de cada una. Pero el empleado solo ve el núcleo más
-- el bloque de esa quincena (`preguntasDeLaSemana`), y con los cuatro bloques en
-- `activo = false` no ve ningún bloque: manda 6 respuestas y el trigger pedía 14. Resultado:
-- ninguna encuesta se pudo guardar desde el 2026-07-27, en ningún rol.
--
-- Por qué el núcleo y no "lo que se mostró": el score es la media del núcleo A PROPÓSITO
-- (ver `repartirPreguntas` en encuestaBloques.js). Si una escala de bloque puntuara, el
-- score dejaría de ser comparable entre quincenas y con eso se caen el historial, la
-- tendencia y el foco rojo por sucursal. Las respuestas de bloque se siguen guardando en
-- `respuestas` y se siguen reportando; simplemente no entran al cálculo.
--
-- La validación no se afloja: del núcleo se sigue exigiendo respuesta numérica en rango.

create or replace function public.encuestas_calcular_score()
returns trigger
language plpgsql
as $$
declare
  pregunta   record;
  n_escala   integer := 0;
  suma       numeric := 0;
  valor      numeric;
  bruto      jsonb;
  score_calc integer;
begin
  for pregunta in
    select id from public.encuesta_preguntas
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

    suma := suma + valor;
  end loop;

  -- Misma guarda que calcularScoreEncuesta() en el cliente: sin preguntas de escala,
  -- el promedio dividiría entre cero.
  if n_escala = 0 then
    raise exception
      'La encuesta no tiene preguntas de escala activas en el núcleo: no se puede calcular el Pulse Score.';
  end if;

  -- `numeric`, NO coma flotante: round() sobre float8 usa redondeo bancario (half-to-even)
  -- y divergiría del Math.round de JS en los empates (.5). Sobre numeric redondea
  -- half-away-from-zero, que para valores positivos es exactamente lo mismo que Math.round.
  score_calc := round((suma / (n_escala * 10)) * 100);

  new.score := score_calc;
  new.semaforo := case
    when score_calc >= 80 then 'verde'
    when score_calc >= 60 then 'amarillo'
    else 'rojo'
  end;

  return new;
end;
$$;
