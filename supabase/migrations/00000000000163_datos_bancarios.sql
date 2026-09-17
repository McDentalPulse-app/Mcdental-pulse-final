-- ============================================================================
-- 163 — Datos bancarios para el depósito de nómina.
--
-- Pedido del dueño: que cada persona capture su banco, su CLABE y su número de tarjeta
-- desde «Mi perfil», y que RH, Administración y la psicóloga los consulten en la ficha del
-- empleado, con una leyenda de que mantenerlos al día es responsabilidad de cada quien.
--
-- POR QUÉ COLUMNAS EN `usuarios` Y NO UNA TABLA NUEVA: el esquema ya resuelve lo difícil.
-- Desde la migración 030 un empleado solo puede LEER SU PROPIA FILA de public.usuarios
-- (policy usuarios_select_own); gestión lee todas (usuarios_select_privilegiados). Y lo que
-- ve el resto de la plantilla es public.usuarios_directorio, una vista security definer con
-- LISTA BLANCA de columnas: una columna nueva no aparece ahí sola, hay que añadirla a mano.
-- O sea que estas cuatro columnas nacen privadas por construcción. Es el mismo camino que
-- tomó `sueldo` en la migración 156, que es dato del mismo tipo (nómina, sensible, solo
-- para gestión), y repetir un patrón que ya funciona vale más que inventar otro.
--
-- SE GUARDAN SOLO DÍGITOS, sin espacios ni guiones: la pantalla formatea al mostrar. Si no,
-- la misma cuenta capturada por dos personas queda distinta en la base y no hay forma de
-- compararlas.
--
-- EL DÍGITO VERIFICADOR (CLABE módulo 10 ponderado, Luhn en la tarjeta) SE VALIDA EN EL
-- CLIENTE, no aquí, y es deliberado: un número bien formado pero equivocado solo perjudica a
-- quien lo tecleó, que es el dueño del dato — es un typo, no una frontera de confianza. Lo
-- que sí es frontera, y por eso sí está aquí, es que nadie meta letras ni longitudes raras
-- entrando por PostgREST. La lección de la migración 162 aplica en su justa medida: una
-- pantalla no es un candado PARA LO QUE PROTEGE DE OTROS.
--
-- DECISIONES DEL DUEÑO (2026-09-17, ver plans/plan-datos-bancarios.md §1):
--   D1 — se capturan CLABE Y tarjeta, y se muestran las dos.
--   D2 — ven el número completo: RH, Administración y la psicóloga.
--   D3 — queda registrada la fecha del último cambio, visible en la ficha.
--   D4 — y también QUIÉN lo cambió.
--   D5 — la psicóloga SOLO VE: editar datos bancarios ajenos queda en admin/admin_plus/rh.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Las columnas. Todas anulables: nadie nace con datos bancarios, y «sin capturar»
--    (null) tiene que poder distinguirse de un dato en blanco.
-- ----------------------------------------------------------------------------

alter table public.usuarios
  add column if not exists banco text,
  add column if not exists clabe text,
  add column if not exists tarjeta text,
  add column if not exists datos_bancarios_actualizado_en timestamptz,
  -- uuid PELADO, SIN foreign key a usuarios(id), y es una decisión, no un olvido.
  --
  -- Con FK hay dos comportamientos posibles y los dos son malos aquí:
  --   · NO ACTION (el default): el día que se dé de baja a la persona de RH que alguna vez
  --     corrigió la CLABE de otro, el borrado FALLA con un error de FK opaco. Y no habría
  --     forma de destrabarlo desde la app, porque el trigger del sello (más abajo) restaura
  --     el valor anterior en cuanto alguien intenta limpiar la columna.
  --   · ON DELETE SET NULL: la acción referencial es un UPDATE sobre esta fila, que dispara
  --     ese mismo trigger; como en ese UPDATE no cambian banco/clabe/tarjeta, entra la rama
  --     `else` y RESTAURA el autor, deshaciendo el SET NULL. O sea que ni siquiera funciona.
  --
  -- Y por encima de la mecánica: un rastro de auditoría registra un HECHO HISTÓRICO. «La
  -- cuenta la cambió esta persona el 17 de septiembre» sigue siendo verdad aunque esa persona
  -- ya no trabaje aquí, y es justo cuando más falta hace saberlo. Un rastro que se borra solo
  -- al dar de baja a alguien no sirve para lo único que existe.
  --
  -- El riesgo que la FK cubriría —un uuid que no apunta a nadie— no es alcanzable: el valor
  -- lo pone el trigger desde current_usuario_id(), que devuelve un id real o null. La pantalla
  -- resuelve el nombre contra la lista de usuarios y, si no lo encuentra, lo dice.
  add column if not exists datos_bancarios_actualizado_por uuid;

-- Formato, no contenido. `~` con anclas a los dos extremos: sin el `$` final, '12…18abc'
-- pasaría. El null se deja pasar explícitamente porque un CHECK con null da NULL (que el
-- CHECK acepta), pero escribirlo evita que el siguiente lector tenga que recordarlo.
alter table public.usuarios
  drop constraint if exists usuarios_clabe_formato;
alter table public.usuarios
  add constraint usuarios_clabe_formato
  check (clabe is null or clabe ~ '^[0-9]{18}$');

alter table public.usuarios
  drop constraint if exists usuarios_tarjeta_formato;
alter table public.usuarios
  add constraint usuarios_tarjeta_formato
  check (tarjeta is null or tarjeta ~ '^[0-9]{16}$');

-- El banco es de catálogo cerrado en la pantalla, pero aquí solo se acota la longitud: la
-- lista de bancos cambia (fusiones, altas) y un CHECK con nombres se quedaría viejo y
-- obligaría a una migración por cada banco nuevo. Lo que importa en la base es que no entre
-- un texto arbitrariamente largo.
alter table public.usuarios
  drop constraint if exists usuarios_banco_longitud;
alter table public.usuarios
  add constraint usuarios_banco_longitud
  check (banco is null or char_length(banco) between 1 and 60);

comment on column public.usuarios.clabe is
  'CLABE interbancaria de 18 dígitos para el depósito de nómina. Solo dígitos, sin separadores. '
  'El dígito verificador se valida en el cliente (src/utils/bancos.js).';
comment on column public.usuarios.tarjeta is
  'Número de tarjeta de 16 dígitos para el depósito de nómina. Solo dígitos, sin separadores.';
comment on column public.usuarios.datos_bancarios_actualizado_por is
  'Quién hizo el último cambio de banco/clabe/tarjeta. Lo fija el trigger, NUNCA el cliente.';

-- ----------------------------------------------------------------------------
-- 2) El sello del último cambio (D3 + D4).
--
-- LA FECHA Y EL AUTOR NO LOS MANDA EL CLIENTE, los pone este trigger. Si el cliente pudiera
-- escribirlos, se podría posfechar un cambio o atribuírselo a otro, y entonces el rastro no
-- valdría para lo único que existe: saber quién movió una cuenta y cuándo.
--
-- La rama `else` es la mitad importante y la menos obvia: cuando la solicitud NO toca ningún
-- dato bancario, se RESTAURAN los valores anteriores. Sin ella, un update que solo mandara
-- `datos_bancarios_actualizado_en` con otra fecha la escribiría sin haber cambiado nada —
-- justo la manipulación que el sello debe impedir.
--
-- `current_usuario_id()` puede ser null (service role, migraciones, seed). Se acepta tal
-- cual: un sello sin autor es honesto, e inventar uno sería peor.
-- ----------------------------------------------------------------------------

create or replace function public.usuarios_sellar_datos_bancarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.banco is not null or new.clabe is not null or new.tarjeta is not null then
      new.datos_bancarios_actualizado_en  := now();
      new.datos_bancarios_actualizado_por := public.current_usuario_id();
    else
      new.datos_bancarios_actualizado_en  := null;
      new.datos_bancarios_actualizado_por := null;
    end if;
    return new;
  end if;

  if new.banco   is distinct from old.banco
  or new.clabe   is distinct from old.clabe
  or new.tarjeta is distinct from old.tarjeta then
    new.datos_bancarios_actualizado_en  := now();
    new.datos_bancarios_actualizado_por := public.current_usuario_id();
  else
    new.datos_bancarios_actualizado_en  := old.datos_bancarios_actualizado_en;
    new.datos_bancarios_actualizado_por := old.datos_bancarios_actualizado_por;
  end if;

  return new;
end;
$$;

-- El nombre empieza por «datos» A PROPÓSITO: los triggers BEFORE ROW de una misma tabla se
-- disparan en orden ALFABÉTICO, así que este corre antes que
-- trg_usuarios_prevent_privilege_escalation ('d' < 'p') y que trg_usuarios_updated_at.
-- El orden no cambia el resultado (el trigger de abajo resta estas columnas de su
-- comparación), pero deja el comportamiento fijado en vez de depender de la suerte.
drop trigger if exists trg_usuarios_datos_bancarios_sello on public.usuarios;

create trigger trg_usuarios_datos_bancarios_sello
  before insert or update on public.usuarios
  for each row execute function public.usuarios_sellar_datos_bancarios();

-- ----------------------------------------------------------------------------
-- 3) El candado de auto-edición, ampliado.
--
-- ⚠️ ESTA FUNCIÓN SE RECREA ÍNTEGRA A PARTIR DE LA VERSIÓN DE LA MIGRACIÓN 153. Todo lo que
-- había sigue aquí: la jerarquía de admin_plus, el ticket de arranque, el organigrama y los
-- seis módulos. Copiar aquí una versión más vieja habría BORRADO candados de autorización
-- vigentes, que es el riesgo más alto de esta migración (R3 del plan).
--
-- Dos cambios, y solo dos:
--   a) la guarda nueva de datos bancarios ajenos (D5), y
--   b) las cinco columnas nuevas sumadas a la resta del self-service.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_toca_admin boolean;
begin
  -- Gestión (admin/rh/psicologa; admin_plus cuenta como admin vía current_role())
  -- puede cambiar role/auth_user_id de rh/psicologa/doctor/empleado entre sí, igual
  -- que hoy. Nadie fuera de gestión puede tocar ninguno de los dos campos.
  if public.current_role() not in ('admin', 'rh', 'psicologa') then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo gestión puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo gestión puede cambiar el vínculo de autenticación.';
    end if;
  end if;

  -- Jerarquía: tocar una fila que ES o VA A SER admin/admin_plus está reservado a
  -- admin_plus real (rol_real(), no plegado) — ni siquiera un admin normal puede.
  if (new.role is distinct from old.role) or (new.auth_user_id is distinct from old.auth_user_id) then
    v_toca_admin := old.role in ('admin', 'admin_plus') or new.role in ('admin', 'admin_plus');

    if v_toca_admin and public.rol_real() is distinct from 'admin_plus' then
      -- Excepción de arranque: reclamar el ticket de un solo uso (mig. 140) — ya
      -- comprueba ahí adentro que quien llama es 'admin' de verdad, y es atómico.
      if not (new.role = 'admin_plus' and old.role not in ('admin', 'admin_plus')
              and public.reclamar_bootstrap_admin_plus()) then
        raise exception 'No autorizado: solo Admin+ puede tocar una cuenta admin o admin_plus.';
      end if;
    end if;
  end if;

  -- Organigrama (mig. 153): solo admin/admin_plus/rh mueven jefe_id/area_id.
  -- La psicóloga queda fuera de ESTO aunque siga en la lista de gestión de
  -- arriba — puede seguir editando puesto/sucursal, no el organigrama.
  if public.current_role() not in ('admin', 'rh')
     and (new.jefe_id is distinct from old.jefe_id
          or new.area_id is distinct from old.area_id) then
    raise exception 'No autorizado: solo Administración y RH pueden mover el organigrama.';
  end if;

  -- Módulos (mig. 142): los 6 interruptores nuevos son admin_plus-only sobre
  -- CUALQUIER fila, incluida la propia — nadie se los prende/apaga a sí mismo.
  if public.rol_real() is distinct from 'admin_plus' and (
       new.puede_ver_comisiones is distinct from old.puede_ver_comisiones
    or new.puede_usar_checador is distinct from old.puede_usar_checador
    or new.puede_usar_notas is distinct from old.puede_usar_notas
    or new.puede_ver_departamentos is distinct from old.puede_ver_departamentos
    or new.puede_ver_avisos is distinct from old.puede_ver_avisos
    or new.puede_ver_encuestas is distinct from old.puede_ver_encuestas
  ) then
    raise exception 'No autorizado: los módulos solo los cambia Admin+.';
  end if;

  -- DATOS BANCARIOS AJENOS (mig. 163, D5): la psicóloga los VE pero no los cambia. Va antes
  -- del bloque de self-service porque aquí lo que se mira es la fila AJENA.
  --
  -- La condición exige que la fila no sea la propia: la psicóloga es empleada también y
  -- tiene que poder capturar los suyos desde su perfil como cualquiera. admin_plus pasa
  -- porque current_role() lo pliega a 'admin', igual que en las guardas de arriba.
  --
  -- Para un empleado esto es defensa redundante —la RLS ya le impide escribir en filas
  -- ajenas— pero para la psicóloga es la ÚNICA defensa: ella sí tiene UPDATE sobre toda la
  -- tabla.
  if (new.banco   is distinct from old.banco
   or new.clabe   is distinct from old.clabe
   or new.tarjeta is distinct from old.tarjeta)
     and new.id is distinct from public.current_usuario_id()
     and public.current_role() not in ('admin', 'rh') then
    raise exception 'No autorizado: solo Administración y RH pueden cambiar los datos bancarios de otra persona.';
  end if;

  -- Self-service acotado para quien NO es gestión, sobre su propia fila, EXCEPTO cuando una
  -- RPC legítima marca su señal local a la transacción (sin cambios respecto a la 099).
  --
  -- A avatar_url y banner_url se suman ahora los tres campos bancarios (mig. 163) y sus dos
  -- columnas de sello. El sello ENTRA EN LA RESTA por necesidad, no por permisividad: el
  -- trigger trg_usuarios_datos_bancarios_sello ya las cambió cuando esta comprobación corre,
  -- así que sin restarlas guardar la CLABE propia fallaría SIEMPRE. Que el cliente no pueda
  -- falsear el sello no lo garantiza esta resta, lo garantiza aquel trigger, que sobrescribe
  -- lo que venga de fuera.
  if public.current_role() not in ('admin', 'rh', 'psicologa')
     and new.id = public.current_usuario_id()
     and coalesce(current_setting('app.marking_password_changed', true), 'off') <> 'on'
     and coalesce(current_setting('app.setting_color_acento', true), 'off') <> 'on' then
    if (to_jsonb(new) - 'avatar_url' - 'banner_url'
                      - 'banco' - 'clabe' - 'tarjeta'
                      - 'datos_bancarios_actualizado_en' - 'datos_bancarios_actualizado_por'
                      - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'banner_url'
                                       - 'banco' - 'clabe' - 'tarjeta'
                                       - 'datos_bancarios_actualizado_en' - 'datos_bancarios_actualizado_por'
                                       - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil, tu portada y tus datos bancarios.';
    end if;
  end if;

  return new;
end;
$$;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en transacción con ROLLBACK, para no dejar rastro):
--
--   LO QUE NO SE FILTRA — es la comprobación que sostiene todo el diseño:
--     1) select * from public.usuarios_directorio limit 1;
--        -> NO debe aparecer banco, clabe, tarjeta ni ninguna columna de sello.
--     2) (como empleado A) select clabe from public.usuarios where id = <B>;
--        -> 0 filas. La RLS solo le deja ver la suya.
--
--   QUIÉN PUEDE ESCRIBIR:
--     3) (empleado A) update usuarios set clabe='0123...' where id = A;   -> OK
--     4) (empleado A) update usuarios set username='hack' where id = A;   -> DEBE FALLAR
--     5) (psicóloga)  update usuarios set clabe='...' where id = <otro>;  -> DEBE FALLAR (D5)
--     6) (psicóloga)  update usuarios set clabe='...' where id = <ella>;  -> OK (es empleada)
--     7) (rh)         update usuarios set clabe='...' where id = <otro>;  -> OK
--
--   EL SELLO NO SE FALSEA:
--     8) update usuarios set clabe='<otra>' where id = A;
--        -> datos_bancarios_actualizado_en = now(), _por = quien llamó.
--     9) update usuarios set datos_bancarios_actualizado_en = '2020-01-01' where id = A;
--        -> el sello NO cambia (la rama else restaura el anterior).
--
--   EL FORMATO:
--    10) update usuarios set clabe = '12345' where id = A;        -> DEBE FALLAR (CHECK)
--    11) update usuarios set tarjeta = 'abcd...' where id = A;    -> DEBE FALLAR (CHECK)
--
--   LOS CANDADOS VIEJOS SIGUEN EN PIE (R3 — que recrear la función no borró nada):
--    12) (rh) update usuarios set puede_ver_comisiones = false where id = <otro>;
--        -> DEBE FALLAR: 'los módulos solo los cambia Admin+'.
--    13) (psicóloga) update usuarios set jefe_id = <x> where id = <otro>;
--        -> DEBE FALLAR: 'solo Administración y RH pueden mover el organigrama'.
--
-- ROLLBACK:
--   drop trigger if exists trg_usuarios_datos_bancarios_sello on public.usuarios;
--   drop function if exists public.usuarios_sellar_datos_bancarios();
--   alter table public.usuarios
--     drop column banco, drop column clabe, drop column tarjeta,
--     drop column datos_bancarios_actualizado_en, drop column datos_bancarios_actualizado_por;
--   -- y restaurar prevent_usuario_privilege_escalation() desde la migración 153.
-- ----------------------------------------------------------------------------
