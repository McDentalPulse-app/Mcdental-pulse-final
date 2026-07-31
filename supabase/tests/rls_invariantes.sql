-- Invariantes de seguridad de RLS, comprobados contra una base REAL.
--
-- POR QUÉ ESTE ARCHIVO: los 402 tests de vitest cubren utils/ — lógica pura — y ni uno
-- toca policies, endpoints ni servicios. Los tres fallos del 30 de julio (el tope de 8000
-- caracteres, la comparación de username, y `rh` fuera de las policies de mensajes)
-- estaban justo en esa capa. Esto la cubre en la parte que más duele: quién puede leer y
-- escribir qué.
--
-- CÓMO SE EJECUTA (no toca ni un dato: todo va dentro de una transacción con rollback):
--   docker exec -i pulse-db psql -U postgres -d postgres -f - < rls_invariantes.sql
--
-- CÓMO SE LEE: cada línea imprime OK o FALLA. Si alguna dice FALLA, hay un agujero.
--
-- Se apoya en usuarios que ya existen y NO crea ninguno: buscar por rol evita depender de
-- nombres concretos, que cambian entre la base local y producción.

\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

begin;

create temp table resultado(prueba text, ok boolean, detalle text);
-- Las comprobaciones corren con `set local role authenticated`, y ese rol no puede
-- escribir en una tabla temporal creada por postgres. Sin este grant, la primera
-- anotación aborta la transacción entera y no se ve ni un resultado.
grant all on resultado to public;

do $$
declare
  emp        uuid;  emp_auth  uuid;
  otro_emp   uuid;
  jefa       uuid;  jefa_auth uuid;
  n          int;
begin
  select id, auth_user_id into emp, emp_auth
    from usuarios where role = 'empleado' and not inactivo and auth_user_id is not null limit 1;
  select id into otro_emp
    from usuarios where role = 'empleado' and not inactivo and id <> emp limit 1;
  select id, auth_user_id into jefa, jefa_auth
    from usuarios where role = 'psicologa' and not inactivo and auth_user_id is not null limit 1;

  if emp is null or otro_emp is null or jefa is null then
    insert into resultado values ('datos de partida', false, 'faltan usuarios de prueba (empleado x2 + psicologa)');
    return;
  end if;
  insert into resultado values ('datos de partida', true, 'empleado, otro empleado y psicologa localizados');

  -- Un mensaje privado entre la psicóloga y OTRO empleado. El empleado bajo prueba no
  -- participa, así que no debería poder verlo jamás.
  insert into mensajes (de_id, para_id, texto, canal)
    values (jefa, otro_emp, 'confidencial de prueba', 'psicologa');

  -- ══ Se pasa a actuar COMO EL EMPLEADO ══
  perform set_config('request.jwt.claims', json_build_object('sub', emp_auth::text)::text, true);
  set local role authenticated;

  select count(*) into n from mensajes where texto = 'confidencial de prueba';
  insert into resultado values
    ('un empleado NO lee la conversación privada de otro', n = 0, format('filas visibles: %s', n));

  begin
    -- Autoaprobarse un permiso: la policy exige estado 'pendiente' y origen 'empleado'.
    insert into permisos (empleado_id, fecha, estado, origen)
      values (emp, current_date + 5, 'aprobado', 'empleado');
    insert into resultado values ('un empleado NO puede autoaprobarse un permiso', false, 'el insert pasó');
  exception when others then
    insert into resultado values ('un empleado NO puede autoaprobarse un permiso', true, 'rechazado por RLS');
  end;

  begin
    insert into permisos (empleado_id, fecha, estado, origen)
      values (emp, current_date + 6, 'pendiente', 'empleado');
    insert into resultado values ('un empleado SÍ puede pedir un permiso pendiente', true, 'insert aceptado');
  exception when others then
    insert into resultado values ('un empleado SÍ puede pedir un permiso pendiente', false, sqlerrm);
  end;

  begin
    -- El trigger prevent_usuario_privilege_escalation reserva `role` a gestión.
    update usuarios set role = 'admin' where id = emp;
    insert into resultado values ('un empleado NO puede hacerse admin', false, 'el update pasó');
  exception when others then
    insert into resultado values ('un empleado NO puede hacerse admin', true, 'bloqueado por el trigger');
  end;

  select count(*) into n from usuarios;
  insert into resultado values
    ('un empleado solo se ve a sí mismo en usuarios', n <= 1, format('usuarios visibles: %s', n));

  reset role;

  -- ══ Se pasa a actuar COMO LA PSICÓLOGA ══
  perform set_config('request.jwt.claims', json_build_object('sub', jefa_auth::text)::text, true);
  set local role authenticated;

  select count(*) into n from mensajes where texto = 'confidencial de prueba';
  insert into resultado values
    ('la psicóloga SÍ lee su propia conversación', n = 1, format('filas visibles: %s', n));

  select count(*) into n from usuarios;
  insert into resultado values
    ('gestión ve a toda la plantilla', n > 5, format('usuarios visibles: %s', n));

  reset role;
end $$;

select case when ok then '  OK   ' else '  FALLA' end || ' · ' || prueba ||
       coalesce('   (' || detalle || ')', '')
from resultado;

select '';
select count(*) filter (where not ok) || ' fallo(s) de ' || count(*) || ' comprobaciones'
from resultado;

rollback;
