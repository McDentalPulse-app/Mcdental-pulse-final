-- ============================================================================
-- Chat en vivo + reparación de la publicación de realtime (migración 085).
--
-- DOS COSAS, Y LA PRIMERA ES UN ARREGLO URGENTE.
--
-- 1) LA PUBLICACIÓN SE QUEDÓ VACÍA EN EL CORTE. Al migrar de Supabase Cloud a la
--    VPS (2026-07-27) se compararon a fondo tablas, columnas, funciones, triggers
--    y políticas RLS del esquema `public`, pero una publicación es un objeto de
--    CLÚSTER, no vive en ningún esquema, y se quedó fuera de la comparación —
--    igual que las políticas de `storage.objects`.
--
--    Consecuencia: desde el corte, `supabase_realtime` no tenía ni una tabla,
--    mientras que en Cloud tenía siete. Las suscripciones que la app ya hacía
--    (`subscribeNotificaciones`, `subscribeAsistencias`, la de encuestas) se
--    conectaban y no recibían nada. No fallaban: se quedaban calladas, que es
--    peor, porque la campana de notificaciones simplemente dejó de subir sola.
--
-- 2) `mensajes` se añade por primera vez, para el chat con la psicóloga.
--
-- La identidad de réplica se deja en `default` (solo la PK), que es exactamente
-- lo que tenía Cloud en las ocho tablas. `full` solo haría falta para leer el
-- registro ANTERIOR en un UPDATE, y aquí nadie lo necesita: cuando `leido` pasa
-- a true, al remitente le basta la fila nueva para encender el doble check.
-- ============================================================================

do $$
declare
  t text;
  tablas text[] := array[
    -- Las siete que había en Cloud y que hay que devolver a su sitio.
    'asistencias', 'avisos', 'comisiones', 'encuestas',
    'eventos_calendario', 'intercambios_dia', 'notificaciones',
    -- La nueva.
    'mensajes'
  ];
begin
  foreach t in array tablas loop
    -- Idempotente a propósito: `alter publication ... add table` revienta si la
    -- tabla ya está, y esta migración tiene que poder re-ejecutarse sin miedo
    -- mientras se termina de reconciliar la VPS con lo que había en Cloud.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'añadida a supabase_realtime: %', t;
    else
      raise notice 'ya estaba: %', t;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select tablename from pg_publication_tables
--    where pubname='supabase_realtime' order by 1;
--     -> las 8: asistencias, avisos, comisiones, encuestas, eventos_calendario,
--        intercambios_dia, mensajes, notificaciones.
--
--   No hacen falta políticas nuevas: realtime aplica la RLS de cada tabla al
--   entregar, así que `mensajes_select_participant` (migración de mensajes) ya
--   garantiza que a cada quien solo le llegan los mensajes en los que participa.
--
-- ROLLBACK:
--   alter publication supabase_realtime drop table public.mensajes;
--   (las otras siete NO se quitan: quitarlas volvería a romper lo que esto arregla)
-- ----------------------------------------------------------------------------
