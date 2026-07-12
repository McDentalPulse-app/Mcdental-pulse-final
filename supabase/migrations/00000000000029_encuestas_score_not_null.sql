-- ============================================================================
-- Hace imposible una encuesta sin score válido.
--
-- Contexto: `encuestas.score` era nullable, y la app filtraba los scores válidos con
-- `Number.isFinite(Number(e.score))` — que NO descarta null, porque Number(null) === 0.
-- Una fila con score null se colaba como un score real de 0: semáforo rojo, prioridad
-- "Crítica" y "agendar intervención inmediata" para alguien de quien no se sabía nada,
-- además de hundir el promedio de su sucursal.
--
-- El código ya está corregido (src/utils/pulseScore.js -> tieneScoreValido), pero eso
-- solo arregla la lectura. Esta migración cierra la ESCRITURA: si la columna no admite
-- null, el dato malo no puede ni entrar.
--
-- Se aplica ahora porque los datos están limpios y no hay nada que sanear
-- (verificado 2026-07-12: 36 encuestas, 0 con score null). Más adelante, con filas
-- inválidas ya dentro, esta misma migración obligaría a un backfill previo.
--
-- Cómo entraba un null en la práctica: si un admin dejaba la encuesta sin ninguna
-- pregunta de tipo "escala", EncuestaEmpleado.handleSubmit dividía entre cero
-- (Math.round((0 / 0) * 100) === NaN) y NaN viaja a JSON como null. Ese camino ya
-- está cortado en el cliente con un mensaje explícito; esto es la red de abajo.
-- ============================================================================

-- Salvaguarda: si alguna fila incumple, la migración aborta con un mensaje entendible
-- en vez del error genérico de constraint violation de Postgres.
do $$
declare
  invalidas integer;
begin
  select count(*) into invalidas
  from public.encuestas
  where score is null or score < 0 or score > 100;

  if invalidas > 0 then
    raise exception
      'No se puede aplicar la restricción: hay % encuesta(s) con score nulo o fuera de 0-100. Corrige esas filas primero (recalculando el score desde `respuestas`, o eliminándolas) y vuelve a correr esta migración.',
      invalidas;
  end if;
end $$;

alter table public.encuestas
  alter column score set not null;

alter table public.encuestas
  add constraint encuestas_score_rango
  check (score >= 0 and score <= 100);

-- `semaforo` se deja nullable a propósito: getEncuestaSemaforo() (src/utils/encuestaDetail.js)
-- lo deriva del score cuando falta, así que un null ahí es recuperable — a diferencia del
-- score, que no se puede reconstruir. Sí se acota a los tres valores válidos para que no
-- entre un string arbitrario.
alter table public.encuestas
  add constraint encuestas_semaforo_valido
  check (semaforo is null or semaforo in ('verde', 'amarillo', 'rojo'));

-- ----------------------------------------------------------------------------
-- Verificación tras aplicar:
--   insert into public.encuestas (empleado_id, semana, respuestas, score)
--   values (public.current_usuario_id(), '2099-W01', '{}'::jsonb, null);
--   -> debe fallar con "null value in column score violates not-null constraint".
--
--   ... values (public.current_usuario_id(), '2099-W01', '{}'::jsonb, 150);
--   -> debe fallar con "violates check constraint encuestas_score_rango".
--
--   Una encuesta normal (score entre 0 y 100) debe seguir guardándose sin cambios.
-- ----------------------------------------------------------------------------
