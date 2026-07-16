-- Cierra 3 hallazgos de la auditoría de seguridad (frontend + backend + BD, 2026-07-16).
-- No se editan migraciones ya aplicadas: esta migración SUELTA y RECREA solo lo afectado.

-- =====================================================================================
-- a) La migración 050 amplió estas 5 policies a rh/psicologa pero las recreó SIN el
--    wrapper `(select ...)` que la migración 028 exige para forzar InitPlan (evaluar la
--    función UNA vez por consulta, no por fila — el propio comentario de la 028 lo llama
--    "el error de performance nº1 de RLS"). Notas psicológicas y reportes confidenciales
--    son justo las tablas que crecen sin techo, así que la regresión pesa ahí.
-- =====================================================================================

drop policy if exists encuestas_select_admin_rh_psicologa on public.encuestas;
create policy encuestas_select_admin_rh_psicologa
  on public.encuestas for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists encuesta_preguntas_write_gestion on public.encuesta_preguntas;
create policy encuesta_preguntas_write_gestion
  on public.encuesta_preguntas for all
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists notas_psicologicas_all_gestion on public.notas_psicologicas;
create policy notas_psicologicas_all_gestion
  on public.notas_psicologicas for all
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists reportes_confidenciales_select_gestion on public.reportes_confidenciales;
create policy reportes_confidenciales_select_gestion
  on public.reportes_confidenciales for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- De paso ancla `otorgado_por` al que llama, como ya hace avisos_insert_gestion (mig 058)
-- pero a esta policy nunca se le agregó.
drop policy if exists reconocimientos_write_gestion on public.reconocimientos;
create policy reconocimientos_write_gestion
  on public.reconocimientos for insert
  with check (
    otorgado_por = (select public.current_usuario_id())
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

-- =====================================================================================
-- b) vacaciones_insert_own_or_rh / permisos_insert_own_or_rh (migración 016) solo
--    validaban empleado_id, no estado/origen: un empleado podía insertar directo (sin
--    pasar por la UI) su propia solicitud ya con estado='aprobado' y origen='rh',
--    saltándose el flujo de aprobación por completo. Mismo patrón que ya se cerró en
--    usuarios (mig 023/025) y mensajes (mig 032), pero quedó suelto acá.
-- =====================================================================================

drop policy if exists vacaciones_insert_own_or_rh on public.vacaciones;
create policy vacaciones_insert_own_or_rh
  on public.vacaciones for insert
  with check (
    (select public.current_role()) = 'rh'
    or (
      empleado_id = (select public.current_usuario_id())
      and estado = 'pendiente'
      and origen = 'empleado'
    )
  );

drop policy if exists permisos_insert_own_or_rh on public.permisos;
create policy permisos_insert_own_or_rh
  on public.permisos for insert
  with check (
    (select public.current_role()) = 'rh'
    or (
      empleado_id = (select public.current_usuario_id())
      and estado = 'pendiente'
      and origen = 'empleado'
    )
  );

-- =====================================================================================
-- c) descuentos.monto no tenía CHECK: un error humano o de UI podía dejar un descuento
--    en $0 o negativo sin que la base lo impidiera.
--
--    NOT VALID a propósito: no se puede verificar desde acá si ya existen filas viejas
--    con monto <= 0, y un CHECK validado que choque con datos legacy tumbaría el push
--    entero. Así se exige solo para filas nuevas/editadas desde ahora; para blindar
--    también el histórico, correr después `validate constraint descuentos_monto_positivo`
--    (falla con el detalle de qué fila no cumple, si alguna).
-- =====================================================================================

alter table public.descuentos
  add constraint descuentos_monto_positivo check (monto > 0) not valid;
