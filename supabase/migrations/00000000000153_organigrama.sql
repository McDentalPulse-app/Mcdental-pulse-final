-- ============================================================================
-- Organigrama (migración 153).
--
-- Sin tabla de nodos a propósito: el árbol es `usuarios` consigo misma vía
-- jefe_id, y las "cajas de grupo" del organigrama (Dentistas, Recepcionistas,
-- Personal de limpieza) son hermanos con el mismo `puesto`, agrupados AL
-- PINTAR en el frontend. Así el conteo de cada caja no se puede desfasar de
-- la plantilla real: el conteo ES la consulta, no un número guardado a mano.
--
-- Ver plan-organigrama.md para el porqué de cada decisión.
-- ============================================================================

-- ── 1. Departamentos del organigrama ────────────────────────────────────────
-- Se llama `areas` y NO `departamentos` porque ese nombre ya está tomado por
-- el módulo estilo Teams (mig. 133-134): un canal de trabajo que crea un
-- jefe. Esto es otra cosa: estructura fija de la empresa.
--
-- El archivo de responsabilidades vive en esta misma fila y no en una tabla
-- aparte: es UNO por área y se reemplaza (sin historial, decisión del dueño).
create table public.areas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique check (length(btrim(nombre)) > 0),
  orden                 smallint not null default 0,
  color                 text,
  archivo_nombre        text,
  archivo_ruta          text,
  archivo_subido_por    uuid references public.usuarios(id),
  archivo_subido_en     timestamptz,
  created_at            timestamptz not null default now()
);

comment on table public.areas is
  'Departamentos del ORGANIGRAMA (TIC, Clínicas, Marketing, Administrativa...) y su archivo de responsabilidades. Distinto de public.departamentos (mig. 134), que son canales tipo Teams.';

-- ── 2. Las dos columnas del árbol ───────────────────────────────────────────
alter table public.usuarios
  add column if not exists jefe_id uuid references public.usuarios(id) on delete set null,
  add column if not exists area_id uuid references public.areas(id) on delete set null;

comment on column public.usuarios.jefe_id is
  'Jefe DIRECTO en el organigrama. Null = raíz (Dirección General) o todavía sin asignar.';
comment on column public.usuarios.area_id is
  'Departamento del organigrama. Null = sin asignar; sale como "Sin departamento".';

-- on delete set null y no cascade: dar de baja a un jefe NO puede borrar a su
-- equipo. Quedan colgando en la raíz, visibles y sin jefe — esa es la señal
-- de que hay que reasignarlos, no un borrado silencioso de gente vigente.
create index idx_usuarios_jefe on public.usuarios (jefe_id);
create index idx_usuarios_area on public.usuarios (area_id);

-- ── 3. Sin ciclos ───────────────────────────────────────────────────────────
-- A reporta a B y B reporta a A cuelga cualquier render recursivo. El
-- cliente también se defiende con un set de visitados, pero el candado real
-- va acá: así tampoco se puede crear el ciclo desde psql ni desde la API
-- directa.
create or replace function public.organigrama_sin_ciclos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.jefe_id is null then return new; end if;
  if new.jefe_id = new.id then
    raise exception 'Una persona no puede ser su propio jefe.';
  end if;
  if exists (
    with recursive cadena as (
      select new.jefe_id as id, 1 as nivel
      union all
      select u.jefe_id, c.nivel + 1
        from public.usuarios u join cadena c on u.id = c.id
       where u.jefe_id is not null and c.nivel < 50
    )
    select 1 from cadena where id = new.id
  ) then
    raise exception 'Ese cambio crearía un ciclo en el organigrama (esa persona ya depende de quien intentas asignarle).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_organigrama_sin_ciclos on public.usuarios;
create trigger trg_usuarios_organigrama_sin_ciclos
  before insert or update of jefe_id on public.usuarios
  for each row execute function public.organigrama_sin_ciclos();

-- ── 4. Quién puede MOVER el organigrama ─────────────────────────────────────
-- Pedido del dueño: admin, admin_plus y rh (no psicologa, aunque psicologa sí
-- puede seguir editando puesto/sucursal en Gestión de Personal — mig. 095/099,
-- sin cambios). Se cierra por columna en el trigger que ya existe para esto
-- (prevent_usuario_privilege_escalation), que es el patrón de la casa.
--
-- current_role() pliega admin_plus -> admin, así que 'admin' acá ya incluye
-- a Admin+.
--
-- CUERPO COMPLETO copiado tal cual de la base real (verificado 2026-09-07,
-- incluye ya los cambios de las migraciones 099/140/142/... hasta hoy) más
-- el bloque nuevo de jefe_id/area_id. No es el esqueleto de la mig. 025.
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

  -- Self-service acotado a avatar_url y banner_url para quien NO es gestión, sobre su
  -- propia fila, EXCEPTO cuando una RPC legítima marca su señal local a la transacción
  -- (sin cambios respecto a la migración 099).
  if public.current_role() not in ('admin', 'rh', 'psicologa')
     and new.id = public.current_usuario_id()
     and coalesce(current_setting('app.marking_password_changed', true), 'off') <> 'on'
     and coalesce(current_setting('app.setting_color_acento', true), 'off') <> 'on' then
    if (to_jsonb(new) - 'avatar_url' - 'banner_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'banner_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil y tu portada.';
    end if;
  end if;

  return new;
end;
$$;

-- ── 5. RLS + GRANT de `areas` ───────────────────────────────────────────────
-- Patrón `avisos` (mig. 058): todo autenticado LEE, solo gestión ESCRIBE.
-- El GRANT va en este MISMO archivo: la migración 147 salió sin él y tumbó
-- avisos/encuestas/comisiones en producción (RLS sola no alcanza sin GRANT).
alter table public.areas enable row level security;

grant select, insert, update, delete on public.areas to authenticated;
grant select, insert, update, delete on public.areas to service_role;

create policy areas_select_autenticados on public.areas for select
  using ((select public.current_role()) is not null);

create policy areas_write_gestion on public.areas for all
  using ((select public.current_role()) in ('admin', 'rh'))
  with check ((select public.current_role()) in ('admin', 'rh'));

-- ── 6. El directorio tiene que traer las dos columnas nuevas ────────────────
-- CRÍTICO: un empleado NO lee `usuarios` directo (mig. 030), lee esta vista.
-- Sin esto, el organigrama saldría vacío para empleado y doctor — que son la
-- mayoría de la plantilla. jefe_id y area_id no son PII (puesto y sucursal
-- ya se exponen acá).
--
-- Definición base y GRANTs copiados EXACTOS de la base real (verificado
-- 2026-09-07: authenticated tiene las 7 acciones, no solo SELECT — no se
-- reduce el permiso existente al recrear la vista), solo se agregan las 2
-- columnas nuevas al final del select.
drop view if exists public.usuarios_directorio;

create view public.usuarios_directorio as
select id, name, role, sucursal, puesto, avatar_url, inactivo, jefe_id, area_id
from public.usuarios;

alter view public.usuarios_directorio owner to postgres;

grant insert, select, update, delete, truncate, references, trigger
  on public.usuarios_directorio to postgres;
grant insert, select, update, delete, truncate, references, trigger
  on public.usuarios_directorio to service_role;
grant insert, select, update, delete, truncate, references, trigger
  on public.usuarios_directorio to authenticated;

-- ── 7. Bucket del archivo de responsabilidades ──────────────────────────────
-- Privado, propio (no se reusa 'expedientes': ese solo lo leen
-- admin/rh/psicologa + el dueño del expediente — mig. 017 — y este archivo lo
-- tiene que poder descargar TODO el mundo). Lista blanca DESDE el insert: la
-- migración 101 existe porque los 7 buckets originales nacieron sin ella y
-- fue un hallazgo de XSS almacenado real.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('responsabilidades', 'responsabilidades', false, 10485760, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do nothing;

-- Convención de path: <area_id>/<timestamp>-<nombre-saneado>
create policy responsabilidades_select_autenticados on storage.objects for select
  using (bucket_id = 'responsabilidades' and (select public.current_role()) is not null);

create policy responsabilidades_insert_gestion on storage.objects for insert
  with check (bucket_id = 'responsabilidades' and (select public.current_role()) in ('admin', 'rh'));

create policy responsabilidades_delete_gestion on storage.objects for delete
  using (bucket_id = 'responsabilidades' and (select public.current_role()) in ('admin', 'rh'));

-- ============================================================================
-- VERIFICACIÓN (correr a mano contra pulse-db real antes de dar por buena la
-- migración, con SET ROLE / claims simulados como en las migraciones 134/151):
--
-- 1. Como rh:        update usuarios set jefe_id = <x> where id = <y>  -> OK
-- 2. Como psicologa: el mismo update                                   -> falla "solo Administración y RH..."
-- 3. Como psicologa: update usuarios set puesto = 'X' where id = <own> -> SIGUE funcionando (no rompió 095/099)
-- 4. Como empleado:  update usuarios set avatar_url = ... where id = own -> SIGUE funcionando (no rompió 099/142)
-- 5. Ciclo: set jefe_id de A a B, luego de B a A                       -> falla "crearía un ciclo"
-- 6. Como empleado:  select jefe_id, area_id from usuarios_directorio -> devuelve filas
-- 7. Como empleado:  insert into areas (nombre) values ('x')           -> 0 filas / error RLS
-- 8. select bucket_id from storage.buckets where id = 'responsabilidades' -> 1 fila, public = false
-- ============================================================================

-- ============================================================================
-- ROLLBACK (si hace falta revertir esta migración):
--
-- drop policy if exists responsabilidades_select_autenticados on storage.objects;
-- drop policy if exists responsabilidades_insert_gestion on storage.objects;
-- drop policy if exists responsabilidades_delete_gestion on storage.objects;
-- delete from storage.objects where bucket_id = 'responsabilidades';
-- delete from storage.buckets where id = 'responsabilidades';
--
-- drop view if exists public.usuarios_directorio;
-- create view public.usuarios_directorio as
--   select id, name, role, sucursal, puesto, avatar_url, inactivo from usuarios;
-- alter view public.usuarios_directorio owner to postgres;
-- grant insert, select, update, delete, truncate, references, trigger
--   on public.usuarios_directorio to postgres, service_role, authenticated;
--
-- -- restaurar prevent_usuario_privilege_escalation() SIN el bloque de
-- -- jefe_id/area_id (el resto de la función queda igual que arriba, menos
-- -- ese bloque del punto 4).
--
-- drop trigger if exists trg_usuarios_organigrama_sin_ciclos on public.usuarios;
-- drop function if exists public.organigrama_sin_ciclos();
--
-- drop policy if exists areas_select_autenticados on public.areas;
-- drop policy if exists areas_write_gestion on public.areas;
-- alter table public.usuarios drop column if exists jefe_id;
-- alter table public.usuarios drop column if exists area_id;
-- drop table if exists public.areas;
-- ============================================================================
