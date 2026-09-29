begin;
-- Vuelca, en un solo JSON, TODO lo que hace falta para comparar la función 174 contra las
-- reglas de JavaScript: los datos crudos de entrada y el resultado que da la función.
--
-- Se ejecuta con el JWT de un admin (ver paridad-asistencia.mjs): así una sola sesión puede
-- pedir el resumen de cualquier empleado, que es justo lo que el guard de la función permite a
-- admin/rh/psicóloga. No hace falta inventar un token por persona.
--
-- Parámetros por psql -v: desde, hasta, sub (auth_user_id del admin).

set local role authenticated;
select set_config('request.jwt.claims',
                  json_build_object('sub', :'sub', 'role', 'authenticated')::text,
                  true);

with empleados as (
  select u.id, u.name as nombre, u.puesto, u.sueldo_semanal, u.monto_retardo_personal,
         coalesce(s.zona_horaria, 'America/Monterrey') as zona
    from public.usuarios u
    left join public.sucursales s on s.nombre = u.sucursal
   where u.archivado is not true
     and u.auth_user_id is not null
)
select json_build_object(
  'desde', :'desde',
  'hasta', :'hasta',
  'config', (select json_build_object('montoRetardo', n.monto_retardo) from public.nomina_config n limit 1),
  'empleados', (
    select json_agg(json_build_object(
      'id', e.id,
      'nombre', e.nombre,
      'puesto', e.puesto,
      'sueldoSemanal', e.sueldo_semanal,
      'montoRetardoPersonal', e.monto_retardo_personal,
      'zona', e.zona,
      'hoy', (now() at time zone e.zona)::date,
      'horarios', coalesce((
        select json_agg(json_build_object(
          'diaSemana', h.dia_semana,
          'horaEntrada', to_char(h.hora_entrada, 'HH24:MI'),
          'toleranciaMin', h.tolerancia_min))
          from public.horarios h where h.empleado_id = e.id), '[]'::json),
      'checadas', coalesce((
        select json_agg(json_build_object(
          'fecha', to_char(a.fecha, 'YYYY-MM-DD'),
          'tipo', a.tipo,
          'marcadaEn', a.marcada_en,
          'anulada', coalesce(a.anulada, false)))
          from public.asistencias a
         where a.empleado_id = e.id
           and a.fecha between :'desde'::date and :'hasta'::date), '[]'::json),
      'permisos', coalesce((
        select json_agg(json_build_object(
          'fecha', to_char(p.fecha, 'YYYY-MM-DD'),
          'fechaFin', to_char(coalesce(p.fecha_fin, p.fecha), 'YYYY-MM-DD'),
          'estado', p.estado))
          from public.permisos p where p.empleado_id = e.id), '[]'::json),
      'vacaciones', coalesce((
        select json_agg(json_build_object(
          'fechaInicio', to_char(v.fecha_inicio, 'YYYY-MM-DD'),
          'fechaFin', to_char(v.fecha_fin, 'YYYY-MM-DD'),
          'estado', v.estado))
          from public.vacaciones v where v.empleado_id = e.id), '[]'::json),
      -- El recibo de la semana, para comparar contra calcularNomina().
      'recibo', (
        select json_build_object(
          'sueldoSemanal', r.sueldo_semanal,
          'descuento', r.descuento,
          'pagoFinal', r.pago_final,
          'sinSueldo', r.sin_sueldo,
          'retardos', r.retardos,
          'faltas', r.faltas)
          from public.recibo_semana(e.id, :'desde'::date, :'hasta'::date) r),
      -- Lo que dice la función: esto es lo que se compara contra el cálculo de JavaScript.
      'sql', coalesce((
        select json_agg(json_build_object(
          'fecha', to_char(r.fecha, 'YYYY-MM-DD'),
          'estado', r.estado,
          'minutosRetardo', r.minutos_retardo,
          'descuento', r.descuento) order by r.fecha)
          from public.resumen_asistencia_semana(e.id, :'desde'::date, :'hasta'::date) r), '[]'::json)
    ))
    from empleados e
  )
);

rollback;
