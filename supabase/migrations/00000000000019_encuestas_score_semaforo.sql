-- pulse_score existía pero nunca se poblaba: el campo real que la app calcula
-- y persiste al enviar la encuesta es "score" (0-100) + "semaforo" (verde/amarillo/rojo),
-- leídos tal cual por el dashboard y el resto de la app (nunca se recalculan).
alter table public.encuestas rename column pulse_score to score;
alter table public.encuestas alter column score type integer using round(score);
alter table public.encuestas add column semaforo text;
