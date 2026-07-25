-- Admin/RH/psicóloga pueden insertar un permiso ya APROBADO directo, para justificar una
-- falta que fue error del sistema (checador falló, horario mal cargado, etc.) sin pasar
-- por el flujo normal de solicitud+aprobación — no tendría sentido pedirle a RH que
-- apruebe su propia corrección.
--
-- Antes (migración 059) solo 'rh' podía saltarse el "estado=pendiente AND origen=empleado"
-- del propio empleado. Se amplía a 'admin' y 'psicologa', igual que el resto de paridad
-- de gestión (migración 050).

drop policy if exists permisos_insert_own_or_rh on public.permisos;
create policy permisos_insert_own_or_gestion
  on public.permisos for insert
  with check (
    (select public.current_role()) in ('admin', 'rh', 'psicologa')
    or (
      empleado_id = (select public.current_usuario_id())
      and estado = 'pendiente'
      and origen = 'empleado'
    )
  );
