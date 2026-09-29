begin;
-- Vuelca, en un solo JSON, TODO lo que hace falta para comparar las funciones 177
-- (resumen_asistencia_semana y recibo_semana) contra las reglas de JavaScript: los datos crudos de
-- entrada y lo que devuelven las funciones, SEMANA A SEMANA.
--
-- Semana a semana y no un rango suelto, porque así se cobra: la salida anticipada del fin de
-- semana pasa al recibo siguiente (inicioConArrastre), y eso solo se puede comparar recibo por
-- recibo.
--
-- Se ejecuta con el JWT de un admin: así una sola sesión puede pedir lo de cualquiera, que es lo
-- que el guard de las funciones permite a admin/rh/psicóloga. Termina en ROLLBACK: no escribe nada.
--
-- Parámetros por psql -v: desde (un LUNES), hasta (un DOMINGO), sub (auth_user_id del admin).

set local role authenticated;
select set_config('request.jwt.claims',
                  json_build_object('sub', :'sub', 'role', 'authenticated')::text,
                  true);

with semanas as (
  select l::date as lunes, (l + interval '6 days')::date as domingo
    from generate_series(:'desde'::date, :'hasta'::date - 6, interval '7 days') l
),
empleados as (
  -- Los mismos que salen en la Nómina de la web: activos, sin archivar, y las cuentas ocultas
  -- solo si tienen sueldo fijo.
  select u.id, u.name as nombre, u.puesto, u.sueldo_semanal, u.monto_retardo_personal,
         coalesce(u.sueldo_fijo, false) as sueldo_fijo, u.fecha_ingreso,
         coalesce(s.zona_horaria, 'America/Monterrey') as zona
    from public.usuarios u
    left join public.sucursales s on s.nombre = u.sucursal
   where u.archivado is not true
     and coalesce(u.inactivo, false) = false
     and (coalesce(u.oculto, false) = false or coalesce(u.sueldo_fijo, false))
)
select json_build_object(
  'desde', :'desde',
  'hasta', :'hasta',
  'semanas', (select json_agg(json_build_object('lunes', lunes, 'domingo', domingo) order by lunes) from semanas),
  'config', (select json_build_object('montoRetardo', n.monto_retardo) from public.nomina_config n limit 1),
  'festivos', coalesce((select json_agg(to_char(f.fecha, 'YYYY-MM-DD')) from public.festivos f), '[]'::json),
  'empleados', (
    select json_agg(json_build_object(
      'id', e.id,
      'nombre', e.nombre,
      'puesto', e.puesto,
      'sueldoSemanal', e.sueldo_semanal,
      'montoRetardoPersonal', e.monto_retardo_personal,
      'sueldoFijo', e.sueldo_fijo,
      'fechaIngreso', to_char(e.fecha_ingreso, 'YYYY-MM-DD'),
      'zona', e.zona,
      'hoy', (now() at time zone e.zona)::date,
      'horarios', coalesce((
        select json_agg(json_build_object(
          'diaSemana', h.dia_semana,
          'horaEntrada', to_char(h.hora_entrada, 'HH24:MI'),
          'horaSalida', to_char(h.hora_salida, 'HH24:MI'),
          'toleranciaMin', h.tolerancia_min))
          from public.horarios h where h.empleado_id = e.id), '[]'::json),
      'checadas', coalesce((
        select json_agg(json_build_object(
          'fecha', to_char(a.fecha, 'YYYY-MM-DD'),
          'tipo', a.tipo,
          'marcadaEn', a.marcada_en,
          'origen', a.origen,
          'anulada', coalesce(a.anulada, false)))
          from public.asistencias a
         where a.empleado_id = e.id
           and a.fecha between :'desde'::date - 2 and :'hasta'::date), '[]'::json),
      'permisos', coalesce((
        select json_agg(json_build_object(
          'fecha', to_char(p.fecha, 'YYYY-MM-DD'),
          'fechaFin', to_char(coalesce(p.fecha_fin, p.fecha), 'YYYY-MM-DD'),
          'estado', p.estado,
          'causa', p.causa))
          from public.permisos p where p.empleado_id = e.id), '[]'::json),
      'vacaciones', coalesce((
        select json_agg(json_build_object(
          'fechaInicio', to_char(v.fecha_inicio, 'YYYY-MM-DD'),
          'fechaFin', to_char(v.fecha_fin, 'YYYY-MM-DD'),
          'estado', v.estado))
          from public.vacaciones v where v.empleado_id = e.id), '[]'::json),
      'intercambios', coalesce((
        select json_agg(json_build_object(
          'fechaFestivo', to_char(i.fecha_festivo, 'YYYY-MM-DD'),
          'fechaDestino', to_char(i.fecha_destino, 'YYYY-MM-DD'),
          'estado', i.estado))
          from public.intercambios_dia i where i.empleado_id = e.id), '[]'::json),
      -- Lo que dicen las funciones, semana a semana: esto es lo que se compara contra la web.
      'porSemana', (
        select json_agg(json_build_object(
          'lunes', sm.lunes,
          'recibo', (
            select json_build_object(
              'sueldoSemanal', r.sueldo_semanal,
              'descuento', r.descuento,
              'pagoFinal', r.pago_final,
              'sinSueldo', r.sin_sueldo,
              'retardos', r.retardos,
              'faltas', r.faltas,
              'salidasAnticipadas', r.salidas_anticipadas,
              'montoRetardos', r.monto_retardos,
              'montoFaltas', r.monto_faltas,
              'montoSalidas', r.monto_salidas)
              from public.recibo_semana(e.id, sm.lunes, sm.domingo) r),
          'dias', coalesce((
            select json_agg(json_build_object(
              'fecha', to_char(r.fecha, 'YYYY-MM-DD'),
              'estado', r.estado,
              'minutosRetardo', r.minutos_retardo,
              'descuento', r.descuento,
              'descuentoSalida', r.descuento_salida,
              'salidaAnticipada', r.salida_anticipada,
              'arrastre', r.arrastre) order by r.fecha)
              from public.resumen_asistencia_semana(e.id, sm.lunes, sm.domingo) r), '[]'::json)
        ) order by sm.lunes)
        from semanas sm)
    ))
    from empleados e
  )
);

rollback;
