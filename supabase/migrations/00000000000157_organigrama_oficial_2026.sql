-- ============================================================================
-- 157 — El organigrama de la base se alinea con el ORGANIGRAMA OFICIAL MCDENTAL 2026.
--
-- El dueño entregó el PDF oficial. Al compararlo contra los datos vivos, la jerarquía YA
-- coincidía casi por completo: los 18 nombres del PDF existen y bajo Ana Goretty Salas cuelgan
-- exactamente los cinco coordinadores que el PDF dibuja. Esta migración cierra las diferencias
-- reales, que eran cuatro y de las que se aplican tres (la cuarta se descarta y se explica).
--
-- 1. LA CAJA «GERENTE GENERAL». El PDF la dibuja SIN NOMBRE, entre Dirección General y la
--    Gerencia de RH. En la base no existía: Ana Salas colgaba directo de Mario Ruiz.
--    Instrucción del dueño: «nomas dejalo tal cual esta en el pdf», o sea la caja con su
--    título y sin titular. Como en esta app una caja del organigrama ES una fila de
--    `usuarios`, la plaza vacante se crea como fila — con dos cuidados que la mantienen fuera
--    de todo lo que trata a la gente como gente (ver abajo).
--
-- 2. ANDREA HERNÁNDEZ pasa a depender de Noemi Tamar Hernández, y su puesto pasa de
--    «Asistente de gerencia» a «Asistente Administrativo», que es como la nombra el PDF.
--
-- 3. LUZ ESMERALDA GÓMEZ y PERLA ODETTE ALAMILLO no tenían jefe y quedaban FUERA del
--    organigrama, flotando como raíces sueltas. El PDF pone la recepción en la rama de
--    Clínicas, y en la base todas las demás recepcionistas cuelgan de Elizabeth Martínez
--    (Coordinador Clínicas). Ahí van.
--
-- LO QUE NO SE HACE, A PROPÓSITO: el PDF encadena «Dentistas → Recepcionistas → Personal de
-- limpieza». Esas son cajas GENÉRICAS de puesto, sin nombres: convención de dibujo, no una
-- línea de mando. Colgar literalmente a las recepcionistas de las dentistas afirmaría que las
-- dentistas son sus jefas, que no es el caso. La pantalla ya agrupa por puesto, así que se ve
-- como el PDF sin afirmar una jerarquía que nadie ha dicho que exista.
--
-- LA CUENTA «Sistemas» tampoco se toca: es una cuenta técnica, no una persona, y no pertenece
-- a un organigrama de personal.
-- ============================================================================

begin;

-- ── 1. La plaza vacante de Gerencia General ─────────────────────────────────
--
-- DOS CUIDADOS, y ninguno es cosmético:
--
--  · `auth_user_id` queda NULL. No es una cuenta: no puede iniciar sesión ni checar. Hoy no
--    hay NI UNA sola fila vigente sin auth_user_id (verificado antes de escribir esto), así
--    que "sin cuenta" identifica sin ambigüedad una plaza sin titular. El cliente usa
--    exactamente esa señal para pintarla como «Vacante» y no como «De baja».
--
--  · `inactivo = true`. Es lo que la mantiene FUERA de Nómina, Asistencia, Horarios, Rostros,
--    Reuniones y los conteos de plantilla, que filtran por ese campo. El organigrama, en
--    cambio, sí incluye a los inactivos (mig. 153), que es justo lo que hace falta para que la
--    caja se dibuje.
insert into public.usuarios (name, username, synthetic_email, puesto, role, inactivo, jefe_id, area_id)
values (
  'Gerente General',
  'gerente.general',
  'gerente.general@mcdental.internal',
  'Plaza vacante',
  'empleado',
  true,
  '880e948f-5b81-40cd-9a94-32677c58d5fa',  -- Lic. Mario Ruiz (Director General)
  '0c1def1e-5a99-4071-866b-f830372fbe52'   -- área: Dirección General
)
on conflict (username) do nothing;

-- El trigger `trg_crear_turno_estandar` (INSERT sobre usuarios) le acaba de crear SEIS turnos
-- de lunes a sábado, 10:00-19:00. A una plaza sin titular no le corresponde ningún horario: el
-- día que alguien le quitara el `inactivo` empezaría a acumular faltas de una persona que no
-- existe. Se borran aquí, dentro de la MISMA transacción en la que se crearon.
delete from public.horarios
where empleado_id = (select id from public.usuarios where username = 'gerente.general');

-- ── 2. Ana Salas pasa a depender de la Gerencia General ─────────────────────
-- Es el orden del PDF: Director General -> Gerente General -> Gerente de RH.
update public.usuarios
set jefe_id = (select id from public.usuarios where username = 'gerente.general')
where id = 'f319b8af-2416-4289-aa66-3afbb9fea5ff';  -- ANA GORETTY SALAS

-- ── 3. Andrea Hernández, bajo Tamar y con el puesto del PDF ─────────────────
update public.usuarios
set jefe_id = 'bba5ff33-8b55-4877-9e3e-b7da697e7079',  -- NOEMI TAMAR HERNANDEZ REYES
    puesto  = 'Asistente Administrativo'
where id = '061669be-6187-4c5b-80f7-e878e2221ad2';     -- ANDREA HERNANDEZ GUERRERO

-- ── 4. Las dos recepcionistas que estaban fuera del árbol ───────────────────
update public.usuarios
set jefe_id = '80b5eef2-b88f-4a38-8287-260a8931c951'   -- ELIZABETH MARTINEZ FERRETIZ
where id in (
  'f5e96af4-3478-485f-b14b-19e709bdc0c4',              -- LUZ ESMERALDA GOMEZ NETRO
  '7dc47eef-e1ad-4862-afec-0cade69b66d8'               -- PERLA ODETTE ALAMILLO LOPEZ
);

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select name, puesto, inactivo, auth_user_id is null as sin_cuenta
--     from public.usuarios where username = 'gerente.general';
--     -> 1 fila, inactivo = t, sin_cuenta = t
--
--   select count(*) from public.horarios
--    where empleado_id = (select id from public.usuarios where username='gerente.general');
--     -> 0   (el trigger creó 6 y esta migración los borró)
--
--   select count(*) from public.usuarios where archivado = false and jefe_id is null;
--     -> 2   (Mario Ruiz, que es la raíz de verdad, y la cuenta técnica «Sistemas»)
--
-- ROLLBACK:
--   update public.usuarios set jefe_id = '880e948f-5b81-40cd-9a94-32677c58d5fa'
--    where id = 'f319b8af-2416-4289-aa66-3afbb9fea5ff';
--   update public.usuarios set jefe_id = '519f996a-...'::uuid  -- ver abajo
--    ,   puesto = 'Asistente de gerencia'
--    where id = '061669be-6187-4c5b-80f7-e878e2221ad2';
--     (su jefe anterior era MARIANA PADRON CRUZ)
--   update public.usuarios set jefe_id = null
--    where id in ('f5e96af4-3478-485f-b14b-19e709bdc0c4','7dc47eef-e1ad-4862-afec-0cade69b66d8');
--   delete from public.usuarios where username = 'gerente.general';
-- ----------------------------------------------------------------------------
