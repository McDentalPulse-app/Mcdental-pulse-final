# Plan — Organigrama interactivo y responsabilidades por departamento

**STATUS: HECHO** (2026-09-07) — las 5 fases completas y desplegadas en producción. §9
contestado por el dueño, ver §9.1. Fase 1 (migración 153) y Fase 2 (migración 154, datos reales)
verificadas contra `pulse-db` real, 2 líneas de revisión adversarial (correctness + seguridad):
APPROVE sin hallazgos. Fases 3-5 (pantalla interactiva, edición, archivo por departamento)
revisadas (APPROVE, 2 LOW sin bloquear) y desplegadas: `build-frontend.sh` 20/20, bundle
confirmado, sitio público en 200. Ver bitácora e5-e8 del 2026-09-07 para el detalle de cada
paso.
**Fecha:** 2026-09-07
**Rama:** `vps-docker`
**Origen:** pedido del dueño — «una sección de organigrama y órdenes Pulse por departamentos,
para saber quién es el jefe directo de quién; desde el mismo Pulse se descarga un archivo de
"responsabilidades y actividades" por departamento; y que el organigrama no sea una imagen fija,
que sea interactivo». Adjuntó la imagen del organigrama actual (hecho a mano fuera de la app).

---

## 0. La decisión que ordena todo el plan

El organigrama **no necesita tablas de nodos**. Ya existe todo lo que hace falta:

- `usuarios.puesto` (texto) existe desde la migración 004 y RH ya lo edita en Gestión de Personal.
- `usuarios.sucursal` existe y está normalizado (migración 103).
- `GlobalContext` ya carga **todos** los usuarios para **todos** los roles (`getUsuarios` para
  admin/rh/psicóloga, `getUsuariosDirectorio` para empleado/doctor — mig. 030).

Falta **una sola cosa** para que eso sea un árbol: saber **de quién cuelga cada quien**. Eso es
una columna, `usuarios.jefe_id`, apuntando a la misma tabla.

Y las cajas de grupo de la imagen («Dentistas», «Recepcionistas», «Personal de limpieza») **no son
nodos**: son *varias personas con el mismo `puesto` colgando del mismo jefe*. El componente las
agrupa al pintar y muestra el conteo y la lista real. Es exactamente lo que pidió el dueño
(«conteo y lista real sacada de `usuarios`, no una cantidad fija a mano») y no cuesta ninguna
tabla ni ninguna sincronización que se pueda desfasar: si alguien se da de baja, desaparece del
conteo solo, porque el conteo *es* la consulta.

Lo único que sí necesita tabla propia es el **archivo de responsabilidades por departamento**,
porque es metadata de un archivo (nombre, ruta, quién lo subió, cuándo) y no cabe en `usuarios`.

**Resultado: 2 columnas nuevas en `usuarios`, 1 tabla nueva pequeña, 1 bucket, 0 dependencias.**

---

## 1. Alcance

**Dentro:**

1. Sección nueva **«Organigrama»** en el menú, visible para **los 6 roles** (empleado, doctor, rh,
   psicóloga, admin, admin_plus) — mismo patrón exacto que «Departamentos», que ya está montado en
   los 5 layouts.
2. Árbol **interactivo**: expandir/colapsar ramas, clic en un nodo para ver el detalle de la
   persona (nombre, puesto, departamento, sucursal, a quién reporta, quiénes le reportan), y
   buscador por nombre que expande hasta el nodo encontrado.
3. Cajas de grupo automáticas: hermanos con el mismo `puesto` se pintan como una caja
   («Dentistas · 14») que se despliega a la lista real de personas.
4. Edición de la estructura (asignar jefe directo y departamento) para **admin, admin_plus y rh**.
5. **Un archivo** de «responsabilidades y actividades» **por departamento**: lo sube admin/admin_plus/rh
   (PDF o Word), lo descarga cualquiera con acceso a la sección. Subir uno nuevo **reemplaza** al
   anterior (sin historial de versiones — no se pidió).

**Fuera (no-alcance), explícito:**

- **No** se toca el enum `rol_usuario`. `role` es un permiso de la app («quién puede ver qué») y
  `puesto` es el cargo del organigrama («Coordinador TIC»). Son dos ejes distintos y siguen
  separados. Nadie gana ni pierde permisos por moverse en el organigrama.
- **No** se toca el módulo «Departamentos» que ya existe (mig. 133-134, estilo Teams: canal,
  avisos, tareas). Ese es un *grupo de trabajo que crea un jefe*; el departamento del organigrama
  es *estructura de la empresa*. Coinciden en el nombre y en nada más. Ver §9-P3.
- **No** hay organigrama por sucursal/clínica en esta versión: es **uno solo, de la empresa
  entera**, igual que la imagen que mandó el dueño. Ver §9-P1.
- **No** hay editor de responsabilidades dentro de la app (decisión ya tomada: se sube un archivo
  ya hecho).
- **No** hay versionado del archivo, ni flujo de aprobación, ni firma de leído (eso ya lo hace
  Avisos si algún día se quiere).
- **No** hay exportación del organigrama a PDF/imagen. Si se pide, va aparte.

---

## 2. Modelo de datos

### 2.1 Migración `00000000000153_organigrama.sql`

> El **153** es el siguiente número libre en `supabase/migrations/` **de este repo** (el último es
> `152_intercambio_mismo_festivo_sin_limite.sql`). **Antes de aplicar, confirmar contra la VPS** —
> el repo ya se desfasó una vez respecto a producción (ver `plan-inventario-clinicas.md`, que
> nació en 113 y terminó renumerado a 120).

```sql
-- ============================================================================
-- Organigrama (migración 153).
--
-- Sin tabla de nodos a propósito: el árbol es `usuarios` consigo misma vía
-- jefe_id, y las "cajas de grupo" de la imagen (Dentistas, Recepcionistas...)
-- son hermanos con el mismo `puesto`, agrupados AL PINTAR. Así el conteo de
-- cada caja no se puede desfasar de la plantilla real: el conteo es la consulta.
-- ============================================================================

-- ── 1. Departamentos del organigrama ────────────────────────────────────────
-- Se llama `areas` y NO `departamentos` porque ese nombre ya está tomado por el
-- módulo estilo Teams (mig. 134), que es otra cosa: un canal que crea un jefe.
-- Esto es estructura de empresa. Ver el plan, §9-P3.
--
-- El archivo de responsabilidades vive en esta misma fila y no en una tabla
-- aparte: es UNO por área y se reemplaza (sin historial, decisión del dueño).
create table public.areas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique check (length(btrim(nombre)) > 0),
  orden                 smallint not null default 0,   -- para fijar el orden de las columnas
  color                 text,                           -- opcional, el de la imagen del dueño
  archivo_nombre        text,                           -- nombre bonito, como archivos_expediente
  archivo_ruta          text,                           -- path DENTRO del bucket 'responsabilidades'
  archivo_subido_por    uuid references public.usuarios(id),
  archivo_subido_en     timestamptz,
  created_at            timestamptz not null default now()
);

comment on table public.areas is
  'Departamentos del ORGANIGRAMA (TIC, Clínicas, Marketing, Administrativa...) y su archivo de '
  'responsabilidades. Distinto de public.departamentos (mig. 134), que son canales tipo Teams.';

-- ── 2. Las dos columnas del árbol ───────────────────────────────────────────
alter table public.usuarios
  add column if not exists jefe_id uuid references public.usuarios(id) on delete set null,
  add column if not exists area_id uuid references public.areas(id) on delete set null;

comment on column public.usuarios.jefe_id is
  'Jefe DIRECTO en el organigrama. Null = raíz (Dirección General) o todavía sin asignar.';
comment on column public.usuarios.area_id is
  'Departamento del organigrama. Null = sin asignar; sale en "Sin departamento".';

-- on delete set null y no cascade: dar de baja a un jefe NO puede borrar a su equipo.
-- Quedan colgando en la raíz, visibles y sin jefe — que es justo la señal de que hay
-- que reasignarlos, no un borrado silencioso.
create index idx_usuarios_jefe on public.usuarios (jefe_id);
create index idx_usuarios_area on public.usuarios (area_id);

-- ── 3. Sin ciclos ───────────────────────────────────────────────────────────
-- A reporta a B y B reporta a A cuelga cualquier render recursivo. El cliente
-- también se defiende (set de visitados), pero el candado real va aquí: así
-- tampoco se puede crear el ciclo desde psql ni desde la API directa.
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
-- Pedido del dueño: admin, admin_plus y rh. Pero la policy usuarios_update_gestion
-- (mig. 095) da UPDATE sobre `usuarios` a admin, rh Y PSICÓLOGA, y RLS en Postgres
-- no restringe columnas. Se cierra por columna en el trigger que ya existe para eso
-- (prevent_usuario_privilege_escalation, mig. 023 + 025), que es el patrón de la casa.
--
-- current_role() pliega admin_plus -> admin (mig. 139), así que 'admin' aquí ya
-- incluye a Admin+. La psicóloga queda fuera, como pidió el dueño.
create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin' then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo un administrador puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo un administrador puede cambiar el vínculo de autenticación.';
    end if;
  end if;

  -- Organigrama: admin/admin_plus/rh. (NUEVO en mig. 153)
  if public.current_role() not in ('admin', 'rh')
     and (new.jefe_id is distinct from old.jefe_id
          or new.area_id is distinct from old.area_id) then
    raise exception 'No autorizado: solo Administración y RH pueden mover el organigrama.';
  end if;

  -- Self-service de avatar (mig. 025) — SE CONSERVA TAL CUAL, no tocar.
  if public.current_role() not in ('admin', 'rh')
     and new.id = public.current_usuario_id() then
    if (to_jsonb(new) - 'avatar_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil.';
    end if;
  end if;

  return new;
end;
$$;
```

> ⚠️ **Al escribir la migración hay que copiar el cuerpo REAL y COMPLETO de
> `prevent_usuario_privilege_escalation()` tal como quedó en la migración 025** (y revisar si algo
> posterior lo volvió a tocar) y añadirle el bloque nuevo. El de arriba es el esqueleto del plan,
> no un copy-paste verificado: reemplazar la función con una versión incompleta deja al empleado
> pudiendo editarse campos que hoy no puede.

```sql
-- ── 5. RLS + GRANT de `areas` ───────────────────────────────────────────────
-- Patrón `avisos` (mig. 058): todo autenticado LEE, solo gestión ESCRIBE.
-- El GRANT va en este MISMO archivo: la migración 147 salió sin él y tumbó
-- avisos/encuestas/comisiones en producción (RLS sola no alcanza).
alter table public.areas enable row level security;

grant select, insert, update, delete on public.areas to authenticated;
grant select, insert, update, delete on public.areas to service_role;

create policy areas_select_autenticados on public.areas for select
  using ((select public.current_role()) is not null);

create policy areas_write_gestion on public.areas for all
  using ((select public.current_role()) in ('admin', 'rh'))
  with check ((select public.current_role()) in ('admin', 'rh'));

-- ── 6. El directorio tiene que traer las dos columnas nuevas ────────────────
-- CRÍTICO: un empleado NO lee `usuarios` (mig. 030), lee la vista. Sin esto, el
-- organigrama se vería vacío para empleado y doctor — que son la mayoría.
-- jefe_id y area_id no son PII (el puesto y la sucursal ya se exponen ahí).
drop view if exists public.usuarios_directorio;

create view public.usuarios_directorio
with (security_invoker = false) as
select id, name, role, sucursal, puesto, avatar_url, inactivo, jefe_id, area_id
from public.usuarios;

alter view public.usuarios_directorio owner to postgres;
revoke all on public.usuarios_directorio from anon;
grant select on public.usuarios_directorio to authenticated;
```

Al final del archivo, el bloque **VERIFICACIÓN + ROLLBACK** como en todas las migraciones de este
repo (ver 134 y 120 como modelo). Rollback: `drop` de las policies y la tabla `areas`, `drop
column` de las dos columnas, `drop trigger`/`function` del anticiclos, restaurar la vista con las
7 columnas de la mig. 030 y **restaurar la versión anterior de
`prevent_usuario_privilege_escalation()`**.

### 2.2 Lo que NO se agrega, y por qué

| Se pensó | Descartado porque |
|---|---|
| Tabla `organigrama_nodos` con nodos-persona y nodos-grupo | Duplicaría la plantilla. Un nodo-grupo «Dentistas: 14» se desfasa el día que entra el dentista 15. El grupo se calcula. |
| Columna `es_grupo` / `cantidad` | Misma razón. El conteo es `count(*)`. |
| `orden_hermanos` para fijar el orden dentro de una rama | Se ordena por `puesto` y luego por nombre. Si el dueño necesita un orden manual exacto, se agrega después (§9-P5). |
| Tabla aparte para el archivo de responsabilidades | Es 1 archivo por área, sin historial. Cabe en la fila de `areas`. |

---

## 3. El archivo de responsabilidades

**Bucket nuevo `responsabilidades`, privado.** No se reusa `expedientes` porque ese solo lo leen
admin/rh/psicóloga + el dueño de la carpeta (mig. 017), y este archivo lo tiene que poder descargar
**todo el mundo**. Reusarlo obligaría a aflojar la policy del expediente laboral, que es
exactamente lo contrario de lo que hay que hacer.

En la **misma migración 153**:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('responsabilidades', 'responsabilidades', false, 10485760, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do nothing;

-- Convención de path: responsabilidades/<area_id>/<timestamp>-<nombre-saneado>
create policy responsabilidades_select_autenticados on storage.objects for select
  using (bucket_id = 'responsabilidades' and (select public.current_role()) is not null);

create policy responsabilidades_insert_gestion on storage.objects for insert
  with check (bucket_id = 'responsabilidades' and (select public.current_role()) in ('admin', 'rh'));

create policy responsabilidades_delete_gestion on storage.objects for delete
  using (bucket_id = 'responsabilidades' and (select public.current_role()) in ('admin', 'rh'));
```

`allowed_mime_types` va **desde el `insert`**, no en un parche posterior: la migración 101 existe
justamente porque los 7 buckets nacieron sin lista blanca y eso fue un XSS almacenado. PDF y Word
solamente — sin `image/*`, sin `text/html`, sin `svg`.

El servicio (`responsabilidadesService.js`) es un calco de `archivosExpedienteService.js`: mismo
`rutaSegura(archivo.name)`, mismo `contentType` explícito (sin él el navegador manda
`application/octet-stream` y el bucket contesta 415), mismo `mensajeDeSubida()` traduciendo el
fallo, misma `createSignedUrl` de 300 s para descargar. Al reemplazar un archivo: subir el nuevo,
actualizar la fila de `areas`, y **luego** borrar el objeto viejo del bucket (en ese orden — si
falla el borrado queda un huérfano, que es mejor que una fila apuntando a nada).

---

## 4. Frontend

### 4.1 Datos: cero fetches nuevos

`GlobalContext` ya trae `usuarios` para todos los roles y los refresca cada 60 s. Con `jefe_id` y
`area_id` en la vista, el árbol se arma **en memoria** con lo que ya está cargado. Lo único que hay
que pedir es `areas` (una tabla de ~5 filas), en el mismo `Promise.all`, para todos los roles —
igual que `sucursales` y `modulosRol`.

- `src/services/supabase/areasService.js` — `getAreas`, `guardarArea`, `eliminarArea`.
- `src/services/supabase/responsabilidadesService.js` — `subirResponsabilidades`,
  `getSignedUrlResponsabilidades`, `eliminarResponsabilidades`.
- `GlobalContext.jsx` — estado `areas` + `refreshAreas`, cargado para todos.

### 4.2 Librería de árbol: ninguna

`package.json` no trae ni react-flow ni d3 ni nada de árboles, y **no hace falta traer una**. Lo
que se pidió es expandir/colapsar y clic para ver detalle: eso es un componente recursivo y CSS.
Meter react-flow (~100 KB) para eso serían 100 KB para que una PWA que se usa desde el celular
tarde más en abrir. Con ~25 nodos hoy y crecimiento lento, no hay problema de rendimiento que
justifique la dependencia.

Si algún día se pide *arrastrar y soltar para reorganizar*, ahí sí se reevalúa. Hoy la edición es
un desplegable «Reporta a: …», que es más rápido de usar en el móvil que arrastrar.

### 4.3 Componentes (`src/components/organigrama/`)

| Archivo | Qué hace |
|---|---|
| `Organigrama.jsx` | Pantalla. Arma el árbol, buscador, filtro por departamento, y el panel de detalle. Es la que se monta en las 5 rutas. |
| `NodoOrganigrama.jsx` | Recursivo. Pinta una caja (persona o grupo), su botón de expandir/colapsar y sus hijos. |
| `PanelPersona.jsx` | Detalle al hacer clic: avatar, nombre, puesto, departamento, sucursal, «Reporta a», «Le reportan (N)». Para gestión, además: los dos desplegables de edición. |
| `ResponsabilidadesArea.jsx` | Tarjeta por departamento: nombre, quién lo encabeza, botón «Descargar responsabilidades» y, para gestión, «Subir/Reemplazar». |
| `Organigrama.css` | Estilos. Co-locado, como `AdminDashboard.css` y `Sidebar.css` (los componentes nuevos ya no van al `App.css` de 14 000 líneas). |
| `arbol.js` + `arbol.test.js` | La lógica pura: de una lista plana de usuarios a un árbol, con agrupación de hermanos por `puesto` y set de visitados anticiclos. **Con test** — es el único trozo con algo que se pueda romper en silencio. |

**`arbol.js`, el núcleo (≈40 líneas):**

```
construirArbol(usuarios) ->
  1. descartar archivados (y los inactivos según §9-P4)
  2. indexar por id  (Map)
  3. colgar cada quien de su jefe_id; sin jefe_id -> raíces
  4. en cada nivel, agrupar hermanos con el mismo `puesto` cuando son 2 o más
     -> { tipo: 'grupo', puesto, personas: [...] }, si no -> { tipo: 'persona' }
  5. set de visitados: si un id ya se pintó, no se vuelve a bajar (defensa
     ante un ciclo que se hubiera colado antes del trigger)
```

Estado del expandido/colapsado: `useState` con un `Set` de ids abiertos. Arranca con los dos
primeros niveles abiertos y el resto cerrado — con 25 nodos abrir todo es una pared, y con 60 es
ilegible.

### 4.4 Navegación

Calco exacto de cómo está montado `departamentos` hoy:

1. `navItems.js`: `{ key: "organigrama", icon: "users", label: "Organigrama" }` en los **6** arreglos
   (admin, psicologa, rh, empleado, doctor; admin_plus lo hereda de admin). Sin `requiere` — lo ve
   todo el mundo, que es lo que pidió el dueño.
2. `DESCRIPCIONES`: `organigrama: "Quién reporta a quién y las responsabilidades de cada departamento."`
3. Ruta `<Route path="organigrama" element={<Organigrama />} />` en los **5** layouts
   (`AdminLayout`, `HRLayout`, `PsicologaLayout`, `EmpleadoLayout`, `DoctorLayout`).
4. **`TABS_MOVIL` no se toca** — los 4-5 huecos del móvil ya están asignados a lo que se usa a diario.
5. **Icono:** se reusa `users`, que ya existe. Si el dueño quiere uno propio de organigrama, se
   agrega un mapeo en `Icon.jsx` desde `@untitledui/icons` (hay que verificar el nombre exacto del
   export antes de importarlo, no adivinarlo).

### 4.5 Interruptor de módulos: no hay nada que hacer

`navItemsPara()` (navItems.js:294) ya aplica a **cualquier** clave, sin registrarla en ningún lado:

- `modulos_rol` (mig. 147) — prender/apagar para todo un rol, desde la barra de Admin+.
- `modulos_persona` (mig. 150) — prender/apagar persona por persona, desde `ModulosPanel`.

Ambos con «ausente = prendido». O sea: el día que se despliegue, Admin+ ya podrá apagarle
«Organigrama» a quien quiera **sin una línea de código extra**. Lo único que NO tendrá es candado
de RLS (esconder el menú no bloquea la URL directa) — igual que los demás módulos fuera de los 7
de `CON_CANDADO_REAL` (`AdminPlusNav.jsx:37`). Como el contenido es «quién reporta a quién», que
todos deben ver, eso está bien así.

---

## 5. Permisos, de un vistazo

| Acción | Quién | Dónde se cumple de verdad |
|---|---|---|
| Ver el organigrama | los 6 roles | `usuarios_directorio` (mig. 030) + `areas_select_autenticados` |
| Descargar el archivo de un depto | los 6 roles | `responsabilidades_select_autenticados` (storage) |
| Cambiar jefe directo / departamento de alguien | admin, admin_plus, rh | trigger `prevent_usuario_privilege_escalation` (columna) |
| Crear/renombrar/borrar un departamento | admin, admin_plus, rh | `areas_write_gestion` |
| Subir/reemplazar el archivo | admin, admin_plus, rh | `responsabilidades_insert_gestion` (storage) |

En el frontend, el gate es una línea con el patrón que ya usa `GestionUsuarios.jsx:44`:

```js
const puedeEditarOrganigrama = ["admin", "admin_plus", "rh"].includes(user?.role);
```

Ojo con la asimetría, que es deliberada y hay que dejarla escrita en el código: la **psicóloga sí
puede** editar `puesto` y `sucursal` en Gestión de Personal (mig. 095/099), pero **no** `jefe_id`
ni `area_id`. Es lo que pidió el dueño; si un día molesta, se cambia una lista en el trigger.

---

## 6. Fases

### Fase 1 — Base de datos
Migración 153 completa: `areas`, las 2 columnas, el trigger anticiclos, el trigger de columna
ampliado, RLS + GRANT, la vista `usuarios_directorio` recreada, el bucket con su lista blanca.

**Aceptación** (con `psql`, en una transacción con `rollback`, como se hizo con la 134):
- Como **rh**: `update usuarios set jefe_id = <x> where id = <y>` → OK.
- Como **psicóloga**: el mismo update → falla con «solo Administración y RH…».
- Como **psicóloga**: `update usuarios set puesto = 'X'` → **sigue funcionando** (no se rompió la 095).
- Como **empleado**: `update usuarios set avatar_url = …` sobre su fila → **sigue funcionando** (no se rompió la 025).
- Ciclo: A→B, luego B→A → falla con «crearía un ciclo».
- Como **empleado**: `select jefe_id, area_id from usuarios_directorio` → devuelve filas.
- Como **empleado**: `insert into areas …` → 0 filas (RLS).

### Fase 2 — Datos reales cargados
Crear los departamentos de la imagen y asignar `jefe_id`/`area_id` a las personas reales.
**Bloqueada por §9-P2** (hace falta que el dueño diga qué cuenta de `usuarios` es cada caja).

**Aceptación:** `select count(*) from usuarios where jefe_id is null and not archivado` devuelve
**1** (Dirección General) o el número que el dueño confirme; ninguna persona vigente queda huérfana
por accidente.

### Fase 3 — Ver el organigrama (solo lectura)
`arbol.js` + `Organigrama.jsx` + `NodoOrganigrama.jsx` + `PanelPersona.jsx` + CSS + ruta en los 5
layouts + ítem de menú. Sin edición todavía.

**Aceptación:**
- `npx vitest run` verde, incluido `arbol.test.js` (árbol de 2 niveles, hermanos agrupados por
  puesto, y una lista con ciclo que **no** cuelga).
- Entrando como **empleado** en el navegador: se ve el árbol completo, se colapsa una rama, se
  vuelve a abrir, se hace clic en un nodo y sale el detalle con «Reporta a» correcto.
- Una caja de grupo muestra el conteo real: dar de baja a un dentista en Gestión de Personal y, al
  refrescar, el conteo baja en 1 sin tocar nada más.
- `npm run lint` sin errores nuevos sobre el baseline y `npm run build` compila.

### Fase 4 — Editar la estructura
Los dos desplegables en `PanelPersona` (para los 3 roles), con la lista de posibles jefes filtrada
para no ofrecer a un descendiente (el trigger es la red, esto es la cortesía).

**Aceptación:** como **rh**, mover a alguien de rama y ver el árbol reordenado sin recargar. Como
**psicóloga**, los desplegables no aparecen; y si se fuerza la llamada, la base contesta el error
de la Fase 1.

### Fase 5 — Archivo de responsabilidades
Bucket ya creado en la Fase 1. `responsabilidadesService.js` + `ResponsabilidadesArea.jsx`.

**Aceptación:**
- Como **rh**: subir un PDF a «TIC» → aparece con su nombre y fecha.
- Como **empleado**: descargarlo → se abre; el enlace firmado caduca a los 5 min.
- Como **empleado**: intentar subir uno → error de permisos, no un fallo silencioso.
- Subir un `.exe` renombrado a `.pdf` → rechazado por la lista blanca del bucket (415), con el
  mensaje traducido de `mensajeDeSubida()`, no un «no se pudo».
- Reemplazar el archivo de un área → el viejo desaparece del bucket, no quedan dos.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Reemplazar `prevent_usuario_privilege_escalation()` con un cuerpo incompleto rompe el self-service de avatar o reabre la escalación rh→admin | Copiar el cuerpo real de la mig. 025 y verificar los 3 casos de la Fase 1 antes de dar por buena la migración |
| Olvidar recrear `usuarios_directorio` → organigrama vacío para empleado y doctor (la mayoría) | Está en la Fase 1 y tiene su propio criterio de aceptación |
| `puesto` escrito de tres formas distintas («Dentista», «dentista», «DENTISTA ») → tres cajas de grupo en vez de una | Agrupar por `puesto` **normalizado** (trim + minúsculas) al pintar, y mostrar la grafía más frecuente. Si el desastre es grande, un `update` de normalización como el de sucursales en la mig. 103 |
| El número 153 ya existe en la VPS | Confirmarlo contra producción antes de aplicar (le pasó al plan de inventario) |
| Un árbol muy ancho no cabe en el móvil | Layout vertical con sangría (tipo explorador de archivos), no cajas horizontales tipo diagrama. En escritorio se puede ver como diagrama; en móvil, lista sangrada |

---

## 8. Qué queda medido como «hecho»

- [x] Los 6 roles ven «Organigrama» en su menú (`navItems.js`, los 5 arreglos + herencia de
      admin_plus) y hay ruta montada en los 5 layouts. **Confirmado en producción** (2026-09-08):
      log real de Kong muestra un empleado entrando a `/empleado/organigrama` desde su iPhone,
      con su avatar cargando 200 — nadie logueó una excepción.
- [x] El árbol refleja la imagen que mandó el dueño, con personas reales de `usuarios`
      (migración 154, verificado con conteos reales contra `pulse-db`).
- [x] Expandir/colapsar y clic-para-detalle: cubierto por `arbol.test.js` y trazado por el
      checker de frontend. En un teléfono real ya se abrió la pantalla sin error (ver arriba);
      no hay confirmación de que alguien haya tocado expandir/colapsar específicamente.
- [x] `GET /rest/v1/areas` y `GET /rest/v1/usuarios_directorio` (con `jefe_id`/`area_id`)
      responden 200 con tráfico real de Android e iPhone en las últimas 12h — cero errores en
      los logs de Kong ni de `pulse-frontend` para estas rutas.
- [x] Las cajas de grupo muestran el conteo real y se despliegan a la lista de personas
      (`arbol.test.js`, caso de agrupación).
- [x] admin/admin_plus/rh mueven a alguien de rama; psicóloga y empleado no pueden — verificado
      en la base (22 escenarios de ataque, línea de seguridad) y en la UI (el checker de
      frontend confirmó que `PanelPersona` no le muestra los controles a quien no puede).
- [x] Cada departamento tiene su archivo y cualquiera lo descarga — el servicio y su orden de
      operaciones están verificados; **no se subió un archivo real de prueba en producción
      todavía** (nadie ha usado el botón "Subir" en vivo).
- [x] `npm run lint`, `npx vitest run` y `npm run build` sin regresiones (594/594, 0 errores
      nuevos de lint, build exitoso).

**Pendiente real, no de código**: alguien de gestión tiene que entrar y subir el primer archivo
de responsabilidades de cada departamento — la pantalla está lista, los archivos no existen
todavía (`areas.archivo_ruta` sigue en null para las 6).

---

## 9. Preguntas abiertas para el dueño

**P1 — ¿Uno solo o uno por clínica?** El plan asume **uno solo, de toda la empresa** (como la
imagen). Pero hay 26 clínicas: ¿hace falta ver «el organigrama de McDental Palmas» (quién manda en
esa clínica)? Con `sucursal` ya en cada persona, sería un **filtro** sobre el mismo árbol, no otro
organigrama — barato, pero solo si se pide.

**P2 — El mapeo de la imagen a cuentas reales (bloquea la Fase 2).** No se puede adivinar qué fila
de `usuarios` es cada caja: hay nombres en la imagen («Lic. Mario Ruiz», «Lic. Ana Salas»,
«Alfredo Burgos») y en la base están con otra grafía o con otro `puesto`. Hace falta que el dueño
confirme, caja por caja: **nombre exacto o usuario** de la cuenta, y de quién cuelga. Si alguna
caja de la imagen **no tiene cuenta** en Pulse, hay que decidir: se crea la cuenta, o esa caja no
sale (el plan no admite nodos sin cuenta — fue decisión del dueño).

**P3 — «Órdenes Pulse por departamentos»: ¿qué es exactamente?** Es la parte del pedido que no
quedó clara. Tres lecturas posibles:
  (a) *cadena de mando* — «de quién recibo órdenes» — que es lo que ya resuelve el organigrama;
  (b) *asignar tareas/órdenes por departamento* — eso **ya existe** en el módulo «Departamentos»
      (canal + tareas con fecha límite, mig. 134), y lo que faltaría sería enlazar las dos
      pantallas, no construirlo de nuevo;
  (c) *el orden de las columnas* del organigrama (que TIC salga antes que Marketing) — que es el
      campo `orden` de `areas`.
Según cuál sea, cambia el alcance.

**P4 — ¿Los inactivos salen en el organigrama?** Los archivados no, seguro. Pero hay gente
`inactivo = true` sin archivar (de baja temporal): ¿se pintan en gris, o desaparecen y sus reportes
quedan colgando del jefe de arriba?

**P5 — ¿Hace falta ordenar a mano dentro de una rama?** El plan ordena por puesto y nombre. Si el
dueño quiere que en la fila de coordinaciones salgan en un orden concreto (TIC, Clínicas,
Marketing, Administrativa), eso lo resuelve `areas.orden`; pero **dentro** de una misma rama, un
orden manual persona por persona costaría una columna más. ¿Se necesita?

**P6 — ¿Un solo archivo por departamento, o también uno por puesto?** Confirmado: uno por
departamento. Se pregunta solo porque la imagen tiene puestos muy distintos dentro de un mismo
departamento (un coordinador y un auxiliar de limpieza comparten «Administrativa») y un solo PDF
para los dos puede quedarse corto. Si se quiere por puesto, el modelo cambia poco (el archivo
colgaría de otra clave), pero mejor decidirlo antes de la Fase 5 que después.

## 9.1 Respuestas del dueño (2026-09-07) — plan queda APPROVED

- **P3** (qué es «órdenes Pulse por departamento»): lectura (a) — es la cadena de mando, ya
  resuelta por el organigrama. No hay nada más que construir para esto.
- **P1, P4, P5, P6**: se aceptan los defaults del plan tal cual — un solo organigrama para toda
  la empresa (no por clínica), los `inactivo=true` sin archivar se pintan en gris (no
  desaparecen), orden automático por `puesto`+nombre dentro de cada rama, un archivo por
  departamento.
- **Mapeo caja→cuenta real (P2)**: hecho por matching automático de nombre contra `usuarios` real
  y confirmado — 18/18 cajas con nombre de la imagen encontradas (una con ortografía distinta:
  "Cobarruvias" en la imagen es `maria covarruvias` en la base). Tabla completa:

  | Caja de la imagen | `username` | Puesto en la imagen (a escribir en `usuarios.puesto`) |
  |---|---|---|
  | Director General — Mario Ruiz | `mario` | Director General (sin cambio) |
  | Gerente de RH — Ana Salas | `ana salas` (role psicologa) | Gerente Recursos Humanos (sin cambio) |
  | Coordinador TIC | `alfredo burgos` | Coordinador TIC |
  | Coordinador Clínicas | `elizabeth martinez` | Coordinador Clínicas |
  | Coordinador Marketing | `samantha perez` | Coordinador Marketing |
  | Encargada Coord. Administrativa | `mariana padron` | Encargada de Coordinación Administrativa (sin cambio) |
  | Auxiliar de Coordinación clínica | `frida mogollon` | Auxiliar de Coordinación clínica |
  | Auxiliar de Coordinación clínica | `sandra galvan` | Auxiliar de Coordinación clínica |
  | Especialista Desarrollo de Proyectos | `julio martinez` | Especialista Desarrollo de Proyectos |
  | Auxiliar de Marketing | `georgina silva` | Auxiliar de Marketing (sin cambio) |
  | Auxiliar de Recursos Humanos | `maricruz izaguirre` (role rh) | Auxiliar de Recursos Humanos (sin cambio) |
  | Especialista de Materiales | `ana gomez` | Especialista de Materiales |
  | Especialista Administrativo | `noemi hernandez` (nombre real: Noemi Tamar Hernandez) | Especialista Administrativo |
  | Auxiliar Contable | `edgar martinez` | Auxiliar Contable (sin cambio) |
  | Asistente Administrativo | `andrea guerrero` (nombre real: Andrea Hernandez Guerrero) | Asistente Administrativo (sin cambio) |
  | Técnico de Mantenimiento | `alexis castan` (nombre real: Alexis Alan Rafael Castan) | Técnico de Mantenimiento |
  | Técnico de Mantenimiento | `jesus bautista` (nombre real: Jesus Armando Bautista) | Técnico de Mantenimiento |
  | Limpieza | `maria covarruvias` | Limpieza (sin cambio) |

  Confirmado: **sí, actualizar `puesto`** de las 7 filas marcadas arriba (las que tenían otra
  grafía) para que diga el título de la imagen — no solo asignar `jefe_id`/`area_id` dejando
  `puesto` desactualizado.

- **Gerente General**: confirmado que **no existe como persona** — Ana Salas depende
  directamente de Mario Ruiz (`ana salas`.`jefe_id` = `mario`.`id`). No se crea ningún usuario ni
  fila para "Gerente General".
- **Dentistas / Recepcionistas / Personal de limpieza**: confirmado que cuelgan de **Elizabeth
  Martinez** (Coordinador Clínicas) directamente, no de las dos auxiliares de coordinación clínica
  por separado. `jefe_id` de cada dentista/recepcionista/persona de limpieza = `elizabeth
  martinez`.id (Frida y Sandra son hermanas de estos grupos bajo Elizabeth, no sus jefas).

Con esto, la Fase 2 (asignar `jefe_id`/`area_id` reales) deja de estar bloqueada.
