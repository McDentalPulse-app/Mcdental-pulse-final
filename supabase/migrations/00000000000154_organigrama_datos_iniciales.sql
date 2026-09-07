-- ============================================================================
-- Organigrama: datos reales iniciales (migración 154).
--
-- Complementa la 153 (esquema). Crea las 6 áreas de la empresa y asigna
-- jefe_id/area_id a las ~100 personas vigentes, según el organigrama que
-- entregó el dueño y el mapeo caja-por-caja confirmado en
-- plan-organigrama.md §9.1.
--
-- Idempotente: el insert de áreas usa ON CONFLICT (nombre ya es unique desde
-- la 153), y los UPDATE por username/puesto fijan el mismo valor si se
-- vuelven a correr — no acumulan ni duplican nada.
-- ============================================================================

-- ── 1. Las 6 áreas ───────────────────────────────────────────────────────
insert into areas (nombre, orden) values
  ('Dirección General', 1),
  ('Recursos Humanos', 2),
  ('TIC', 3),
  ('Clínicas', 4),
  ('Marketing', 5),
  ('Administrativa', 6)
on conflict (nombre) do nothing;

-- ── 2. Los 18 con nombre: puesto (7 que corrigen grafía), jefe_id, area_id ──
update usuarios set puesto = 'Coordinador TIC', area_id = (select id from areas where nombre = 'TIC'),
  jefe_id = (select id from usuarios where username = 'ana salas')
  where username = 'alfredo burgos';

update usuarios set puesto = 'Coordinador Clínicas', area_id = (select id from areas where nombre = 'Clínicas'),
  jefe_id = (select id from usuarios where username = 'ana salas')
  where username = 'elizabeth martinez';

update usuarios set puesto = 'Coordinador Marketing', area_id = (select id from areas where nombre = 'Marketing'),
  jefe_id = (select id from usuarios where username = 'ana salas')
  where username = 'samantha perez';

-- puesto ya decía "Coordinadora administrativa", sin cambio
update usuarios set area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'ana salas')
  where username = 'mariana padron';

update usuarios set puesto = 'Auxiliar de Coordinación clínica', area_id = (select id from areas where nombre = 'Clínicas'),
  jefe_id = (select id from usuarios where username = 'elizabeth martinez')
  where username = 'frida mogollon';

update usuarios set puesto = 'Auxiliar de Coordinación clínica', area_id = (select id from areas where nombre = 'Clínicas'),
  jefe_id = (select id from usuarios where username = 'elizabeth martinez')
  where username = 'sandra galvan';

update usuarios set puesto = 'Especialista Desarrollo de Proyectos', area_id = (select id from areas where nombre = 'Marketing'),
  jefe_id = (select id from usuarios where username = 'samantha perez')
  where username = 'julio martinez';

-- puesto ya decía "Auxiliar de Marketing"
update usuarios set area_id = (select id from areas where nombre = 'Marketing'),
  jefe_id = (select id from usuarios where username = 'samantha perez')
  where username = 'georgina silva';

-- puesto ya decía "Auxiliar de Recursos Humanos"
update usuarios set area_id = (select id from areas where nombre = 'Recursos Humanos'),
  jefe_id = (select id from usuarios where username = 'ana salas')
  where username = 'maricruz izaguirre';

update usuarios set puesto = 'Especialista de Materiales', area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'mariana padron')
  where username = 'ana gomez';

update usuarios set puesto = 'Especialista Administrativo', area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'mariana padron')
  where username = 'noemi hernandez';

-- puesto ya decía "Auxiliar Contable"; cuelga de la Especialista de Materiales
update usuarios set area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'ana gomez')
  where username = 'edgar martinez';

-- puesto ya decía "Asistente Administrativo"
update usuarios set area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'mariana padron')
  where username = 'andrea guerrero';

update usuarios set puesto = 'Técnico de Mantenimiento', area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'andrea guerrero')
  where username = 'alexis castan';

update usuarios set puesto = 'Técnico de Mantenimiento', area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'andrea guerrero')
  where username = 'jesus bautista';

-- puesto ya decía "Limpieza"
update usuarios set area_id = (select id from areas where nombre = 'Administrativa'),
  jefe_id = (select id from usuarios where username = 'andrea guerrero')
  where username = 'maria covarruvias';

-- Mario: raíz del árbol (Director General), su propia área
update usuarios set area_id = (select id from areas where nombre = 'Dirección General'), jefe_id = null
  where username = 'mario';

-- Ana Salas: depende directo de Mario — no existe "Gerente General" como
-- persona (confirmado por el dueño en plan-organigrama.md §9.1).
update usuarios set area_id = (select id from areas where nombre = 'Recursos Humanos'),
  jefe_id = (select id from usuarios where username = 'mario')
  where username = 'ana salas';

-- ── 3. Grupos que la imagen no nombra uno por uno ───────────────────────────
-- Dentistas + Recepcionistas + Personal de limpieza (de clínica, distinto de
-- María Covarruvias que es limpieza de oficina): todos bajo Elizabeth Martinez
-- (Coordinador Clínicas), confirmado por el dueño.
update usuarios set jefe_id = (select id from usuarios where username = 'elizabeth martinez'),
  area_id = (select id from areas where nombre = 'Clínicas')
  where role = 'doctor' and not inactivo and not archivado;

update usuarios set jefe_id = (select id from usuarios where username = 'elizabeth martinez'),
  area_id = (select id from areas where nombre = 'Clínicas')
  where role = 'empleado' and not inactivo and not archivado
    and lower(btrim(puesto)) = 'recepcionista';

update usuarios set jefe_id = (select id from usuarios where username = 'elizabeth martinez'),
  area_id = (select id from areas where nombre = 'Clínicas')
  where role = 'empleado' and not inactivo and not archivado
    and lower(btrim(puesto)) = 'limpieza'
    and username <> 'maria covarruvias';

-- "Todos los de sistemas están a cargo de Alfredo" (confirmado por el dueño).
update usuarios set jefe_id = (select id from usuarios where username = 'alfredo burgos'),
  area_id = (select id from areas where nombre = 'TIC')
  where role = 'empleado' and not inactivo and not archivado
    and puesto in ('Becario Sistemas', 'Bancario Sistemas');

update usuarios set jefe_id = (select id from usuarios where username = 'samantha perez'),
  area_id = (select id from areas where nombre = 'Marketing')
  where role = 'empleado' and not inactivo and not archivado and puesto = 'Becaria marketing';

update usuarios set jefe_id = (select id from usuarios where username = 'mariana padron'),
  area_id = (select id from areas where nombre = 'Administrativa')
  where role = 'empleado' and not inactivo and not archivado and puesto = 'Administrativo';

-- "Lic. Mario es literal el Director General" (confirmado por el dueño): el
-- puesto "Servicio al clienteAux Lic. Mario" es un asistente directo suyo.
update usuarios set jefe_id = (select id from usuarios where username = 'mario'),
  area_id = (select id from areas where nombre = 'Dirección General')
  where role = 'empleado' and not inactivo and not archivado
    and puesto = 'Servicio al clienteAux Lic. Mario';

-- ============================================================================
-- VERIFICACIÓN (corrida en real el 2026-09-07, resultado esperado documentado
-- acá para la próxima vez que se corra esta migración):
--
-- select count(*) from usuarios where jefe_id is null and not inactivo and not archivado;
--   -> 2 (Mario, la raíz real, y `sistemas` — cuenta técnica admin_plus, no
--         es una persona del organigrama, queda sin asignar a propósito).
-- select a.nombre, a.orden, count(u.id) from areas a
--   left join usuarios u on u.area_id = a.id and not u.inactivo and not u.archivado
--   group by a.nombre, a.orden order by a.orden;
--   -> Dirección General 2 · Recursos Humanos 2 · TIC 4 · Clínicas 79 ·
--      Marketing 4 · Administrativa 9  (total 100)
-- select count(*) from usuarios where not inactivo and not archivado and jefe_id is not null;
--   -> 99
-- ============================================================================

-- ============================================================================
-- ROLLBACK:
-- update usuarios set jefe_id = null, area_id = null;
-- delete from areas;
-- (los 7 puesto corregidos NO se revierten solos — si hace falta, volver a
-- poner a mano la grafía vieja de cada uno, ver el mapeo en plan-organigrama.md §9.1)
-- ============================================================================
