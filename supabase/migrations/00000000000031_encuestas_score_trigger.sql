-- ============================================================================
-- El Pulse Score se calcula en el servidor, no en el navegador.
--
-- Hasta ahora `score` y `semaforo` se calculaban en el cliente y se insertaban tal
-- cual. La policy `encuestas_insert_own` (mig 016) solo valida `empleado_id`, y la
-- migración 029 añadió CHECK (0..100), pero nada comprobaba que el score
-- CORRESPONDIERA con las `respuestas`. Cualquiera podía enviar un "verde" que no se
-- sostiene en sus propias respuestas y ocultar una señal roja real — justo lo
-- contrario del propósito de la herramienta.
--
-- Este trigger recalcula score y semaforo a partir de `respuestas` e ignora lo que
-- mande el cliente. Además rechaza la encuesta si faltan respuestas de escala: no se
-- puede guardar un score sin los datos que lo justifican.
--
-- La fórmula está validada contra los datos reales: este mismo cálculo reproduce los
-- 36/36 scores ya guardados en producción, con diferencia 0. El trigger NO cambia
-- ningún número existente (además, es BEFORE INSERT: no toca las filas actuales).
--
-- El cliente no necesita cambiar. Puede seguir enviando score/semaforo —se
-- sobreescriben— y como addEncuesta() hace .select().single(), recibe de vuelta el
-- valor autoritativo de la base. Eso significa que no hay orden de despliegue que
-- respetar: la app actual funciona igual con o sin este trigger.
-- ============================================================================

create or replace function public.encuestas_calcular_score()
returns trigger
language plpgsql
-- SECURITY DEFINER: leer encuesta_preguntas no debe depender del RLS de quien inserta.
security definer
set search_path = public
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
    select id from public.encuesta_preguntas where tipo = 'escala' and activa
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
      'La encuesta no tiene preguntas de escala activas: no se puede calcular el Pulse Score.';
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

drop trigger if exists trg_encuestas_calcular_score on public.encuestas;

create trigger trg_encuestas_calcular_score
  before insert on public.encuestas
  for each row execute function public.encuestas_calcular_score();

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en una transacción con rollback, para no dejar rastro):
--
--   1) Score FALSIFICADO: insertar con score = 100 y respuestas que dan otra cosa.
--      -> la fila guardada debe traer el score REAL, no el 100.
--
--   2) Respuestas INCOMPLETAS: insertar omitiendo una respuesta de escala.
--      -> debe FALLAR ("Falta la respuesta ... de una pregunta de escala").
--
--   3) Encuesta honesta: insertar con respuestas completas.
--      -> debe guardarse con el score que corresponde, y el semáforo coherente.
--
-- ROLLBACK:
--   drop trigger if exists trg_encuestas_calcular_score on public.encuestas;
--   drop function if exists public.encuestas_calcular_score();
--
-- Nota para importaciones masivas: el trigger también corre para service_role (los
-- triggers no se saltan como el RLS). Una importación de encuestas sin respuestas de
-- escala completas será rechazada — que es justo lo que se quiere.
-- ----------------------------------------------------------------------------
