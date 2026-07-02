-- Sincronización en vivo de encuestas:
-- 1) Publicar la tabla en supabase_realtime para que los dashboards (admin,
--    psicóloga) reciban INSERTs al instante vía subscribeEncuestas()
--    (src/services/supabase/encuestasService.js). Mientras esta migración no
--    se aplique, el polling de GlobalContext cubre la sincronización.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'encuestas'
  ) then
    alter publication supabase_realtime add table public.encuestas;
  end if;
end $$;

-- 2) Blindaje contra doble envío: la UI ya lo impide (yaContesto en
--    EncuestaEmpleado), pero sin constraint una condición de carrera (doble
--    click / dos pestañas) podría duplicar la encuesta de la semana y
--    duplicar su peso en promedios y participación. Verificado 2026-07-02:
--    no existen duplicados (empleado_id, semana) en los datos actuales.
create unique index if not exists uq_encuestas_empleado_semana
  on public.encuestas (empleado_id, semana);
