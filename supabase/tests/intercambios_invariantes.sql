-- Invariantes del índice de exclusividad de intercambios_dia (migraciones 113, 151, 152),
-- comprobados contra una base REAL.
--
-- POR QUÉ ESTE ARCHIVO: la migración 151 documentó su propio bloque de "VERIFICACIÓN" en un
-- comentario (5 casos), y la 152 otro más (5 casos) — pero eran solo comentarios, nadie los
-- volvía a correr. La revisión adversarial de la 151 lo señaló como hallazgo LOW ("agregar un
-- test automático para que el próximo cambio a ese índice tenga una prueba, no solo el
-- comentario"). Esto convierte esos dos bloques en algo que sí se ejecuta.
--
-- CÓMO SE EJECUTA (no toca ni un dato real: todo va dentro de una transacción con rollback):
--   docker exec -i pulse-db psql -U postgres -d postgres -f - < intercambios_invariantes.sql
--
-- CÓMO SE LEE: cada línea imprime OK o FALLA. Si alguna dice FALLA, el índice cambió de
-- comportamiento sin que el código que lo modificó se diera cuenta.
--
-- Se apoya en usuarios y sucursales que ya existen (mismo patrón que rls_invariantes.sql) y
-- NO crea ningún usuario — solo filas de intercambios_dia, todas descartadas al final. Las
-- fechas destino son ficticias y lejanas (2027) para no chocar con datos reales de hoy.

-- (psql -f ya sigue tras un error por defecto; no hace falta \set ON_ERROR_STOP off)
\pset tuples_only on
\pset format unaligned

begin;

create temp table resultado(prueba text, ok boolean, detalle text);
-- Las comprobaciones corren con `set local role authenticated`, y ese rol no puede
-- escribir en una tabla temporal creada por postgres. Sin este grant, la primera
-- anotación posterior al cambio de rol aborta la transacción entera (mismo hallazgo
-- que ya resolvió rls_invariantes.sql).
grant all on resultado to public;

do $$
declare
  a          uuid;  -- empleado, sucursal cualquiera (no exenta)
  b          uuid;  -- otro empleado, MISMA sucursal que a
  c          uuid;  -- empleado de una sucursal DISTINTA
  admin1     uuid;  -- empleado de Oficina Administrativa (o alias legacy)
  admin2     uuid;  -- otro empleado de Oficina Administrativa (o alias legacy)
  suc_a      text;
  n          int;
begin
  -- Dos personas de la misma sucursal no exenta, con al menos 2 activos en esa sucursal.
  select sucursal into suc_a
    from usuarios
   where role in ('empleado', 'doctor') and not inactivo
     and coalesce(sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central')
   group by sucursal
  having count(*) >= 2
   limit 1;

  if suc_a is null then
    insert into resultado values ('datos de partida (sucursal con 2+)', false, 'no hay ninguna sucursal no exenta con 2 personas activas');
    return;
  end if;

  begin
    select id into a from usuarios
     where role in ('empleado', 'doctor') and not inactivo and sucursal = suc_a limit 1;
    select id into b from usuarios
     where role in ('empleado', 'doctor') and not inactivo and sucursal = suc_a and id <> a limit 1;
    select id into c from usuarios
     where role in ('empleado', 'doctor') and not inactivo
       and coalesce(sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central')
       and sucursal <> suc_a
     limit 1;
    select id into admin1 from usuarios
     where role in ('empleado', 'doctor') and not inactivo
       and coalesce(sucursal, '') in ('Oficina Administrativa', 'Oficina Central', 'Central')
     limit 1;
    select id into admin2 from usuarios
     where role in ('empleado', 'doctor') and not inactivo
       and coalesce(sucursal, '') in ('Oficina Administrativa', 'Oficina Central', 'Central')
       and id <> admin1
     limit 1;
  exception when others then
    insert into resultado values ('datos de partida (personas)', false, sqlerrm);
    return;
  end;

  if a is null or b is null or c is null or admin1 is null or admin2 is null then
    insert into resultado values
      ('datos de partida (personas)', false,
       format('a=%s b=%s c=%s admin1=%s admin2=%s', a, b, c, admin1, admin2));
    return;
  end if;
  insert into resultado values ('datos de partida', true, format('sucursal de prueba: %s', suc_a));

  -- ══ Migración 151: exclusividad por sucursal, Oficina Administrativa exenta ══

  insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
    values (a, '2027-10-01', '2027-10-05');
  insert into resultado values ('canje real: primer dueño de la fecha destino', true, 'insert aceptado');

  begin
    insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
      values (b, '2027-10-02', '2027-10-05');
    insert into resultado values
      ('canje real: MISMA sucursal, MISMA fecha destino → debe chocar', false, 'el insert pasó, no debería');
  exception when unique_violation then
    insert into resultado values
      ('canje real: MISMA sucursal, MISMA fecha destino → debe chocar', true, '23505 como se espera');
  end;

  begin
    insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
      values (c, '2027-10-03', '2027-10-05');
    insert into resultado values
      ('canje real: sucursal DISTINTA, misma fecha destino → no debe chocar', true, 'insert aceptado');
  exception when unique_violation then
    insert into resultado values
      ('canje real: sucursal DISTINTA, misma fecha destino → no debe chocar', false, 'chocó y no debería');
  end;

  insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
    values (admin1, '2027-10-06', '2027-10-20');
  begin
    insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
      values (admin2, '2027-10-07', '2027-10-20');
    insert into resultado values
      ('Oficina Administrativa: dos personas, misma fecha destino → exenta, no choca', true, 'insert aceptado');
  exception when unique_violation then
    insert into resultado values
      ('Oficina Administrativa: dos personas, misma fecha destino → exenta, no choca', false, 'chocó y no debería');
  end;

  -- ══ Migración 152: mismo festivo como destino (aviso sin canje) ══

  insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
    values (a, '2027-11-16', '2027-11-16');
  insert into resultado values ('aviso sin canje: primera persona registra el mismo festivo', true, 'insert aceptado');

  begin
    insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
      values (b, '2027-11-16', '2027-11-16');
    insert into resultado values
      ('aviso sin canje: MISMA sucursal, MISMO festivo=destino → NO debe chocar', true, 'insert aceptado');
  exception when unique_violation then
    insert into resultado values
      ('aviso sin canje: MISMA sucursal, MISMO festivo=destino → NO debe chocar', false, 'chocó y no debería (el festivo es libre para todos)');
  end;

  -- El canje real de más arriba (a, fecha_destino=2027-10-05) SÍ debe seguir exclusivo:
  -- confirma que el fix de la 152 no aflojó de más el índice.
  begin
    insert into intercambios_dia (empleado_id, fecha_festivo, fecha_destino)
      values (b, '2027-10-04', '2027-10-05');
    insert into resultado values
      ('152 no debilitó el canje real: sigue chocando', false, 'el insert pasó, no debería');
  exception when unique_violation then
    insert into resultado values
      ('152 no debilitó el canje real: sigue chocando', true, '23505 como se espera');
  end;

  -- intercambios_destinos_ocupados(), visto como "a": debe incluir el canje real (2027-10-05,
  -- de c, misma pregunta desde la sucursal de a solo si comparten sucursal — c es de otra, así
  -- que lo que debe verse ocupado para "a" es su PROPIO canje real) y NO debe incluir el aviso
  -- sin canje (2027-11-16).
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from usuarios where id = a))::text, true);
  set local role authenticated;

  select count(*) into n from intercambios_destinos_ocupados() d where d = '2027-11-16';
  insert into resultado values
    ('ocupados: el aviso sin canje NO aparece como tomado', n = 0, format('filas: %s', n));

  select count(*) into n from intercambios_destinos_ocupados() d where d = '2027-10-05';
  insert into resultado values
    ('ocupados: el canje real SÍ aparece como tomado', n = 1, format('filas: %s', n));

  reset role;
end $$;

select case when ok then '  OK   ' else '  FALLA' end || ' · ' || prueba ||
       coalesce('   (' || detalle || ')', '')
from resultado;

select '';
select count(*) filter (where not ok) || ' fallo(s) de ' || count(*) || ' comprobaciones'
from resultado;

rollback;
