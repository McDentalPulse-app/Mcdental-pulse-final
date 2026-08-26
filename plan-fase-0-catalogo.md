# Fase 0 — Catálogo de módulos, permisos y modelo de datos

> **Qué decide este documento.** Qué se vende junto (núcleo), qué se vende aparte (módulos), qué
> puede hacer cada persona (permisos) y cómo se guarda todo eso (modelo de datos). Es el
> documento del que cuelgan las fases 1 a 7: mientras esto no esté cerrado, cualquier tabla que
> se cree se va a tener que rehacer.
>
> **No decide:** el diseño visual (`PULSE_DESIGN_SYSTEM.md`), ni el precio de cada módulo, ni si
> se va por opción A o B del plazo (`auditoria-pulse-producto.md` § 8.1). Ninguna de esas tres
> bloquea esta fase.
>
> **Estado:** CERRADO · 2026-08-08. Las cuatro decisiones abiertas se resolvieron el mismo día
> (§ 6). La fase 1 puede empezar.
> El inventario sale del Pulse actual (`src/config/navItems.js`, 36 tablas, 31 funciones RPC),
> no de imaginación.

---

## 1. Núcleo vs módulos

**Criterio de núcleo:** si una empresa cualquiera no puede usar el producto sin eso, es núcleo.
Todo lo demás es módulo, aunque hoy en McDental parezca imprescindible.

### 1.1 Núcleo (va en todos los planes)

| Bloque | Qué incluye | Viene de |
|---|---|---|
| **Personal** | Directorio de empleados, alta/baja, datos básicos, perfil propio, cambio de contraseña | `usuarios` |
| **Centros de trabajo** | Sucursales, zona horaria por sucursal, geocerca | `sucursales`, `sucursal_geocerca_log` |
| **Horarios** | Turnos, plantillas, importación masiva, festivos | `horarios`, `festivos` |
| **Asistencia** | Checador (entrada/salida), historial propio, rejilla de asistencia, justificar y anular | `asistencias`, `dispositivos` |
| **Tiempo libre** | Vacaciones, permisos, calendario | `vacaciones`, `permisos`, `eventos_calendario` |
| **Comunicación** | Avisos con acuse de lectura, notificaciones push | `avisos`, `avisos_leidos`, `notificaciones`, `push_suscripciones` |
| **Administración** | Configuración de la empresa, roles y permisos, soporte interno | `ajustes`, `soporte_tickets_estado` |

Nada de esto se puede apagar. Si se pudiera, el producto no arrancaría.

### 1.2 Módulos vendibles

| # | Clave | Nombre comercial | Qué incluye | Depende de |
|---|---|---|---|---|
| 1 | `rostro` | Checador con reconocimiento facial | Enrolamiento, cotejo, anti-spoofing, calibración, aprobación de rostros | Asistencia (núcleo) |
| 2 | `bienestar` | Bienestar y clima laboral | Encuestas por bloques, score, reportes confidenciales, seguimiento y notas | — |
| 3 | `expedientes` | Expediente digital | Archivos del empleado, expediente integral | Personal (núcleo) |
| 4 | `reconocimientos` | Reconocimientos | Medallas, reconocimientos, cumpleaños y aniversarios | — |
| 5 | `comisiones` | Comisiones | Captura de recibos, cálculo, revisión y autorización | — |
| 6 | `nomina` | Incidencias de nómina | Descuentos, retardos valorizados, exportación | Asistencia (núcleo) |
| 7 | `reclutamiento` | Bolsa de trabajo | Vacantes, candidatos, seguimiento | — |
| 8 | `turnos` | Intercambio de turnos | Solicitud y aprobación de cambios de día entre empleados | Horarios (núcleo) |
| 9 | `reuniones` | Reuniones y videollamada | Agenda, invitados, sala de video | — |
| 10 | `mensajes` | Mensajería interna | Chat, adjuntos, reacciones | — |
| 11 | `analitica` | Reportes avanzados | Reportes de RH, tableros, exportación a Excel | — |
| 12 | `ia` | Asistente de IA | Motor de riesgo, resúmenes, cuota por empresa | — |

**Sobre las dependencias:** un módulo no se puede activar si le falta su dependencia. `rostro`
sin asistencia no significa nada. La consola de Admin+ tiene que impedirlo, no confiar en que
quien vende se acuerde.

### 1.3 Los tres casos dudosos — RESUELTOS (2026-08-08)

**Decisión del jefe de proyecto: los tres son módulo.** Consecuencias de cada uno:

- **`mensajes`** — módulo, encendido por defecto en la plantilla de alta. Un cliente con Teams o
  Slack lo apaga y no paga por él.
- **`analitica`** — módulo. Esto **no** deja al núcleo sin nada que mirar: la rejilla de
  asistencia, el historial y el listado de solicitudes son parte del núcleo (`asistencia.ver`,
  `tiempolibre.ver`). Lo que se vende aparte son los **tableros, los reportes de RH y la
  exportación a Excel**. Un cliente de plan básico ve quién llegó tarde; no puede exportarlo ni
  ver la tendencia del trimestre. Es una línea de corte que se sostiene comercialmente.
- **`ia`** — módulo **con cuota**, no interruptor. Es el único con costo variable por uso
  (tokens), así que se vende con un límite en `empresa_limites` (`ia_tokens_mes`) y la RPC
  `consumir_cuota_ia` que ya existe hace de tope duro. Sin cuota, un cliente entusiasta se
  come el margen del contrato.

---

## 2. Catálogo de permisos

### 2.1 Convención

`recurso.accion`, en minúsculas y sin acentos. Cada permiso tiene además un **ámbito**, que es
lo que hace que esto sirva para empresas grandes:

| Ámbito | Alcance |
|---|---|
| `propio` | Solo sus propios datos |
| `sucursal` | Los de su(s) centro(s) de trabajo asignado(s) |
| `empresa` | Todos |

> **Esto es nuevo y es importante.** El Pulse actual no tiene ámbitos: RH ve las 25 clínicas o
> no ve nada. Con 200 sucursales eso no se sostiene — un supervisor de zona necesita ver su zona
> y nada más. El ámbito se guarda **junto al permiso en el rol**, no como una propiedad del rol.

### 2.2 Permisos del núcleo

| Clave | Qué permite | Ámbitos válidos |
|---|---|---|
| `personal.ver` | Ver el directorio y las fichas | propio · sucursal · empresa |
| `personal.crear` | Dar de alta a alguien | sucursal · empresa |
| `personal.editar` | Cambiar datos de una ficha | sucursal · empresa |
| `personal.baja` | Dar de baja | sucursal · empresa |
| `personal.asignar_rol` | Cambiar el rol de alguien | empresa |
| `sucursales.ver` | Ver centros de trabajo | sucursal · empresa |
| `sucursales.editar` | Crear y editar centros, zona horaria | empresa |
| `sucursales.fijar_geocerca` | Fijar la ubicación desde el sitio | propio · sucursal |
| `horarios.ver` | Ver horarios | propio · sucursal · empresa |
| `horarios.editar` | Asignar y modificar turnos | sucursal · empresa |
| `horarios.importar` | Carga masiva | empresa |
| `asistencia.checar` | Registrar entrada y salida | propio |
| `asistencia.ver` | Ver registros de asistencia | propio · sucursal · empresa |
| `asistencia.justificar` | Justificar una falta o retardo | sucursal · empresa |
| `asistencia.anular` | Anular un registro | sucursal · empresa |
| `tiempolibre.solicitar` | Pedir vacaciones o permiso | propio |
| `tiempolibre.ver` | Ver solicitudes | propio · sucursal · empresa |
| `tiempolibre.aprobar` | Aprobar o rechazar | sucursal · empresa |
| `avisos.ver` | Leer avisos | propio |
| `avisos.publicar` | Publicar avisos | sucursal · empresa |
| `config.ver` | Ver la configuración de la empresa | empresa |
| `config.editar` | Cambiar configuración, marca, vocabulario | empresa |
| `roles.gestionar` | Crear roles y asignarles permisos | empresa |
| `soporte.crear` | Levantar un ticket interno | propio |
| `soporte.atender` | Atender tickets | empresa |

### 2.3 Permisos por módulo

**`rostro`**

| Clave | Qué permite | Ámbitos |
|---|---|---|
| `rostro.enrolar_propio` | Registrar su propia cara | propio |
| `rostro.ver` | Ver rostros registrados y sus fotos | sucursal · empresa |
| `rostro.aprobar` | Aprobar o rechazar un rostro | sucursal · empresa |
| `rostro.calibrar` | Cambiar umbrales de cotejo y anti-spoofing | empresa |

**`bienestar`**

| Clave | Qué permite | Ámbitos |
|---|---|---|
| `bienestar.responder` | Contestar su encuesta | propio |
| `bienestar.ver_resultados` | Ver resultados agregados | sucursal · empresa |
| `bienestar.gestionar_encuestas` | Crear y editar preguntas y bloques | empresa |
| `bienestar.reportar` | Levantar un reporte confidencial | propio |
| `bienestar.ver_reportes` | Leer reportes confidenciales | empresa |
| `bienestar.notas` | Escribir y leer notas de seguimiento | empresa |

> `bienestar.ver_reportes` y `bienestar.notas` son los dos permisos más sensibles del producto.
> Nunca deben venir encendidos en una plantilla de rol; se dan a mano.

**`expedientes`** — `expedientes.ver` (propio · sucursal · empresa), `expedientes.subir`,
`expedientes.eliminar`

**`reconocimientos`** — `reconocimientos.ver`, `reconocimientos.otorgar`,
`reconocimientos.gestionar`

**`comisiones`** — `comisiones.ver_propias` (propio), `comisiones.capturar` (propio),
`comisiones.ver` (sucursal · empresa), `comisiones.autorizar` (sucursal · empresa)

**`nomina`** — `nomina.ver` (propio · sucursal · empresa), `nomina.aplicar_descuento`,
`nomina.exportar`

**`reclutamiento`** — `reclutamiento.ver`, `reclutamiento.publicar`, `reclutamiento.evaluar`

**`turnos`** — `turnos.solicitar` (propio), `turnos.aprobar` (sucursal · empresa)

**`reuniones`** — `reuniones.ver`, `reuniones.crear`, `reuniones.moderar`

**`mensajes`** — `mensajes.usar` (propio), `mensajes.moderar` (empresa)

**`analitica`** — `analitica.ver` (sucursal · empresa), `analitica.exportar`

**`ia`** — `ia.usar` (propio), `ia.administrar_cuota` (empresa)

**Total: 26 permisos de núcleo + ~34 de módulos ≈ 60.** Es un catálogo manejable. Si crece más
allá de ~80, es señal de que se está confundiendo permiso con opción de configuración.

---

## 3. Modelo de datos

### 3.1 Plano proveedor (lo escribe Admin+; el cliente solo lee)

```sql
create table empresas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique,
  activa      boolean not null default true,
  creada_en   timestamptz not null default now()
);

-- Catálogo del producto. Igual para todos los clientes; lo versiona el equipo, no la venta.
create table modulos (
  clave       text primary key,
  nombre      text not null,
  descripcion text,
  depende_de  text references modulos(clave),
  orden       int not null default 0
);

create table permisos (
  clave        text primary key,
  nombre       text not null,
  modulo_clave text references modulos(clave),   -- null = permiso de núcleo
  ambitos      text[] not null                    -- {'propio','sucursal','empresa'}
);

-- Lo que cada cliente contrató. ESCRITURA EXCLUSIVA DEL PLANO PROVEEDOR.
create table empresa_modulos (
  empresa_id     uuid not null references empresas(id) on delete cascade,
  modulo_clave   text not null references modulos(clave),
  estado         text not null default 'activo'
                 check (estado in ('activo','gracia','suspendido')),
  vigencia_hasta date,
  primary key (empresa_id, modulo_clave)
);

create table empresa_limites (
  empresa_id uuid not null references empresas(id) on delete cascade,
  clave      text not null,        -- 'empleados','sucursales','almacenamiento_mb','ia_tokens_mes'
  valor      bigint not null,
  primary key (empresa_id, clave)
);
```

> **Sobre los planes comerciales (Básico / Completo / …): todavía no se sabe cuáles serán, y no
> hace falta saberlo para construir esto.** `empresa_modulos` es módulo por módulo y esa es la
> fuente de verdad; un plan comercial es solo un **atajo para dar de alta** —«este paquete
> enciende estos seis módulos»— que se agrega después con una tabla `planes` y su
> `plan_modulos`, sin tocar nada de lo de arriba ni una sola política.
>
> Lo que **no** hay que hacer mientras tanto es guardar el plan como una columna en `empresas`
> (`plan text`) y preguntar por ella en el código. Eso sí obligaría a reescribir políticas el día
> que un cliente pida «el paquete Completo pero sin comisiones» — que es el primer caso raro que
> siempre llega.

### 3.2 Plano cliente (lo escribe el admin del cliente)

```sql
-- Marca y vocabulario. SEPARADA de empresa_modulos a propósito: ver PULSE_DESIGN_SYSTEM.md § 9.
create table empresa_branding (
  empresa_id    uuid primary key references empresas(id) on delete cascade,
  color_marca   text,
  escala_marca  jsonb,      -- brand-50…950 derivada al guardar, no en cada render
  logo_url      text,
  vocabulario   jsonb       -- {"sucursal":{"singular":"planta","plural":"plantas","genero":"f"}}
);

create table roles (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  clave      text not null,
  nombre     text not null,
  es_sistema boolean not null default false,   -- las plantillas de arranque no se borran
  unique (empresa_id, clave)
);

create table rol_permisos (
  rol_id        uuid not null references roles(id) on delete cascade,
  permiso_clave text not null references permisos(clave),
  ambito        text not null check (ambito in ('propio','sucursal','empresa')),
  primary key (rol_id, permiso_clave)
);

-- Excepciones persona a persona. El Pulse actual ya las necesitaba: el flag
-- `puedeUbicarSucursal` se da a recepción y a doctoras de clínicas sin recepcionista,
-- fuera del rol. Aquí deja de ser un parche.
create table usuario_permisos (
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  permiso_clave text not null references permisos(clave),
  ambito        text not null,
  otorgado_por  uuid references usuarios(id),
  otorgado_en   timestamptz not null default now(),
  primary key (usuario_id, permiso_clave)
);
```

Y `usuarios` gana `empresa_id`, `rol_id` y `sucursales_asignadas uuid[]` (para el ámbito
`sucursal`). **Todas las demás tablas ganan `empresa_id`** — sin excepción, incluso las que hoy
parezcan globales.

### 3.3 Las cuatro funciones de las que cuelga todo

Mismo patrón que el `current_role()` que ya usan, así que el equipo no aprende nada nuevo.

```sql
create or replace function public.empresa_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from public.usuarios where auth_user_id = auth.uid();
$$;

create or replace function public.modulo_activo(p_modulo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.empresa_modulos
    where empresa_id = public.empresa_actual()
      and modulo_clave = p_modulo
      and estado in ('activo','gracia')
      and (vigencia_hasta is null or vigencia_hasta >= current_date)
  );
$$;

-- Devuelve el ámbito del permiso, o null si no lo tiene.
-- Contempla las tres cosas a la vez: rol, excepción personal y módulo activo.
create or replace function public.ambito_de(p_permiso text) returns text
language sql stable security definer set search_path = public as $$
  select a.ambito
  from (
    select up.ambito, 1 as prioridad
      from public.usuario_permisos up
      join public.usuarios u on u.id = up.usuario_id
     where u.auth_user_id = auth.uid() and up.permiso_clave = p_permiso
    union all
    select rp.ambito, 2
      from public.rol_permisos rp
      join public.usuarios u on u.rol_id = rp.rol_id
     where u.auth_user_id = auth.uid() and rp.permiso_clave = p_permiso
  ) a
  where coalesce(
    (select public.modulo_activo(p.modulo_clave)
       from public.permisos p where p.clave = p_permiso),
    true   -- permiso de núcleo: no depende de módulo
  )
  order by a.prioridad
  limit 1;
$$;

create or replace function public.puede(p_permiso text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ambito_de(p_permiso) is not null;
$$;
```

**Y una quinta, que es la que hace que el punto 3 quede resuelto para siempre:**

```sql
-- ¿El usuario actual alcanza esta sucursal? Toda política que use ámbito 'sucursal'
-- pregunta AQUÍ y nunca revisa el arreglo por su cuenta.
create or replace function public.alcanza_sucursal(p_sucursal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
     where u.auth_user_id = auth.uid()
       and p_sucursal = any (u.sucursales_asignadas)
  );
$$;
```

> **Por qué una función y no el arreglo inline.** El punto 3 del § 6 quedó como «depende de lo
> que pida el cliente, la app tiene que estar preparada». Con `sucursales_asignadas uuid[]` ya
> quedan cubiertos los dos casos obvios: una sucursal es un arreglo de uno, varias es un arreglo
> de varias. **Pero el caso que llega después es el tercero:** un cliente con 200 sucursales que
> quiere zonas o regiones, y entonces «alcanza» deja de ser «está en mi lista» y pasa a ser
> «está en alguna zona que superviso».
>
> Si cada política revisa el arreglo por su cuenta, ese día hay que editar ~200 políticas. Si
> todas preguntan `alcanza_sucursal()`, **es una sola función**. Cuesta cero escribirlo así hoy.
> Es exactamente la misma lección de `empresa_id`, aplicada a tiempo.
>
> Regla dura: **ninguna política menciona `sucursales_asignadas` directamente.** Si aparece en
> una política, está mal escrita.

**Lo que hace esto valioso:** apagar un módulo apaga sus permisos en todos los roles a la vez,
sin tocar `rol_permisos`. Un solo mecanismo, como quedó en la auditoría § 5.2.

### 3.4 Patrón de política, para copiar

Toda tabla de módulo se protege igual. Ejemplo con comisiones:

```sql
alter table public.comisiones enable row level security;

create policy comisiones_select on public.comisiones for select using (
  empresa_id = public.empresa_actual()
  and (
    case public.ambito_de('comisiones.ver')
      when 'empresa'  then true
      when 'sucursal' then public.alcanza_sucursal(sucursal_id)
      else false
    end
    or (public.puede('comisiones.ver_propias')
        and empleado_id = public.current_usuario_id())
  )
);
```

Tres cosas siempre, en este orden: **empresa correcta → permiso con su ámbito → caso propio.**

Dos reglas que hacen que esto no se degrade con el tiempo:

1. Si una política no empieza por `empresa_id = public.empresa_actual()`, está mal escrita.
2. Si una política menciona `sucursales_asignadas` en vez de `alcanza_sucursal()`, está mal
   escrita.

Ojo con el paréntesis: el `and` de la empresa tiene que envolver **todo** el bloque de permisos,
incluido el `or` del caso propio. Sin ese paréntesis, `comisiones.ver_propias` se saltaría el
filtro de empresa — que es precisamente la fuga que este modelo existe para evitar.

---

## 4. Roles de arranque

Cada empresa nueva nace con cuatro roles editables. **Ningún cliente empieza con una pantalla de
permisos en blanco** — eso es lo que hace que la configurabilidad se sienta simple.

| Rol | Para quién | Permisos |
|---|---|---|
| **Administrador** | Dueño o director | Todo lo del núcleo en ámbito `empresa` + `roles.gestionar` + `config.editar`. De los módulos, todo salvo los sensibles de bienestar |
| **Recursos Humanos** | RH corporativo | Personal, horarios, asistencia, tiempo libre y expedientes en ámbito `empresa`. **Sin** `personal.asignar_rol` ni `roles.gestionar` |
| **Supervisor** | Jefe de sucursal o zona | Lo mismo que RH pero en ámbito `sucursal`, y sin expedientes |
| **Colaborador** | Todo el personal | Solo permisos de ámbito `propio`: checar, ver lo suyo, solicitar tiempo libre, responder encuesta |

**Nota deliberada:** no hay rol «psicóloga» ni «doctor». Un cliente que compre `bienestar` crea
su rol y le da `bienestar.notas`; uno con médicos a comisión crea el suyo con
`comisiones.ver_propias`. Eso es exactamente lo que el producto viejo no podía hacer.

**Lo que la plantilla de Administrador NO trae, a propósito:** `bienestar.ver_reportes` y
`bienestar.notas`. Que el dueño pueda leer los reportes confidenciales de su gente por defecto
convierte el módulo en algo que nadie usa. Se otorga a mano, con intención.

---

## 5. Cómo se traduce el Pulse actual

Para que nadie tenga que adivinar al portar código.

| Hoy | En el producto nuevo |
|---|---|
| `rol_usuario` (enum) | Tabla `roles` por empresa |
| `current_role()` | `puede('permiso')` + `ambito_de('permiso')` |
| `role === 'admin'` en JSX | `puede('config.editar')` u otro permiso concreto |
| `requiere: "puedeUbicarSucursal"` | `usuario_permisos` con `sucursales.fijar_geocerca` |
| `ajustes` (una fila global) | `empresa_branding` + `empresa_modulos` + `empresa_limites` |
| RH con paridad de admin | Rol RH **sin** `personal.asignar_rol` — el agujero del pentest deja de existir por diseño |
| `TZ_CLINICA` global | Zona horaria por sucursal (ya existe, se conserva) |

---

## 6. Decisiones — cerradas el 2026-08-08

| # | Pregunta | Respuesta | Dónde quedó |
|---|---|---|---|
| 1 | `mensajes`, `analitica`, `ia`: ¿núcleo o módulo? | **Los tres, módulo.** `ia` con cuota | § 1.3 |
| 2 | ¿Cuántos planes comerciales? | **Aún no se sabe** — y no bloquea: los planes son un atajo de alta que se agrega después sin tocar el esquema | § 3.1 |
| 3 | ¿Una sucursal o varias por persona? | **Depende del cliente; la app aguanta ambas** — arreglo `sucursales_asignadas` detrás de `alcanza_sucursal()`, que además deja abierta la puerta a zonas | § 3.3 |
| 4 | ¿Hay primer cliente identificado? | **No** | § 6.1 |

**La fase 0 queda cerrada.** La fase 1 ya es escribir migraciones.

### 6.1 No hay primer cliente: qué significa para el plan

Es la respuesta con más consecuencias de las cuatro, así que conviene dejarla escrita.

**Lo que cambia:** bajo la opción B del plazo (dos personas, primera venta acotada), el plan era
elegir los dos o tres módulos «según lo que pida el primer cliente». Sin cliente, no hay quién
pida. Hay que elegir a ciegas.

**Criterio para elegir a ciegas.** No es «lo que más se use en McDental» —eso ya sabemos que
engaña— sino el cruce de dos cosas: qué está **más construido** (menor costo) y qué es **más
difícil de copiar** (mayor argumento de venta). Con eso, los dos primeros módulos son:

- **`rostro`** — es el activo real del producto, ya está calibrado y ningún competidor de
  nómina lo trae de fábrica. Es lo que hace que Pulse no sea «otro checador».
- **`bienestar`** — es el que tiene una razón externa de compra (NOM-035) en vez de depender de
  que al cliente le guste la idea. Es el único que se vende contra una obligación.

El resto (`comisiones`, `expedientes`, `reconocimientos`…) se construye después, ya con clientes
reales diciendo qué falta.

**El riesgo, dicho claro:** construir tres meses sin un comprador identificado es la forma
clásica de terminar con un producto correcto que nadie pidió. No es motivo para frenar —el
núcleo y los cimientos se necesitan pase lo que pase— pero sí para hacer una cosa en paralelo:

> **Conseguir un cliente piloto durante el mes 1, aunque sea con descuento o gratis.** No para
> que pague, sino para tener a alguien a quien preguntarle. McDental sirve de referencia pero no
> sirve de piloto: es de quien salió el producto, así que confirma todos los sesgos en vez de
> romperlos.

Eso no consume tiempo de desarrollo y es lo que convierte el mes 3 en una venta en vez de una
demo.

---

## 7. Criterio de terminado de esta fase

- [x] Los 12 módulos y ~60 permisos definidos
- [x] Resueltos los cuatro puntos del § 6
- [ ] Las migraciones del § 3 escritas y aplicadas en un entorno limpio
- [ ] Las **cinco** funciones del § 3.3 con pruebas: rol, excepción personal, módulo apagado,
      ámbito propio/sucursal/empresa
- [ ] Una empresa de prueba creada con sus cuatro roles de arranque
- [ ] Verificado a mano: **apagar un módulo hace desaparecer sus filas en las consultas**, no
      solo su menú
- [ ] Verificado a mano: un usuario con ámbito `sucursal` **no ve** filas de otra sucursal de su
      misma empresa
- [ ] Ninguna política menciona `sucursales_asignadas` ni omite `empresa_actual()` (revisión con
      `grep` antes de cerrar la fase 1)
