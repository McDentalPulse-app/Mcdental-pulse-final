# Plan — Canal de Soporte Mantenimiento, y «Soporte TI» pasa a llamarse «Soporte Sistemas»

**STATUS: APPROVED** (2026-09-09) — las 5 preguntas de §10 contestadas por el dueño, ver §10.1.
Queda la §8 (sacar el cuerpo REAL de las policies de producción) como **Fase 0 bloqueante**: se
hace al empezar a implementar, no antes. Ver §7-R1, que es el riesgo que puede tumbar el chat
entero si se salta.
**Fecha:** 2026-09-07 (aprobado el 2026-09-09)
**Rama:** `vps-docker`
**Origen:** pedido del dueño — «añade otra sección como los reportes confidenciales, pero de
Soporte Mantenimiento, porque la gente está enviando mensajes al de Soporte TI y esa no es el área
de esos problemas; también le cambiarás el nombre a Soporte TI a Soporte Sistemas; y lo de Soporte
Mantenimiento ese chat lo verán los rh, psico y admin».

---

## 0. La decisión que ordena todo el plan

**Mantenimiento no es un módulo nuevo: es un tercer valor de `mensajes.canal`.**

El canal de Soporte TI ya resolvió el problema difícil (un buzón compartido dentro de un chat
diseñado para conversaciones 1 a 1) en la migración 094: `para_id` nulo, una función `es_*()` que
las policies consultan, y una rama en cada una de las tres policies de `mensajes` más la del
bucket. Mantenimiento es **el mismo patrón otra vez**, cambiando una sola cosa:

| | Soporte TI (hoy → «Sistemas») | Mantenimiento (nuevo) |
|---|---|---|
| Quién atiende | bandera **por persona** (`usuarios.soporte_ti`) | **por rol**: admin, admin_plus, rh, psicóloga |
| Por qué | Erick y Alfredo son rol `empleado`; hacerlos admin les abriría nómina y expedientes | quienes atienden ya SON esos roles: una columna nueva sería un permiso que hay que acordarse de encender persona por persona |

Consecuencia directa: **cero columnas nuevas en `usuarios`**, cero backfill, cero pantalla de
administración de la bandera. `es_mantenimiento()` se resuelve con `current_role()`, que ya pliega
`admin_plus → admin` (mig. 139).

**Total: 1 migración, 3 archivos de `api/`, 4 de frontend, 0 dependencias, 0 tablas.**

---

## 1. Alcance

**Dentro:**

1. Canal **`mantenimiento`** en `public.mensajes`, calcado del canal `soporte` (mig. 094): buzón
   compartido, `para_id` nulo en el mensaje que entra, respuesta dirigida a la persona.
2. **Lo atienden por rol** admin, admin_plus, rh y psicóloga, como **buzón compartido**: los cuatro
   ven todo, cualquiera contesta, y marcar leído lo marca para todos.
3. **Puede escribirle todo el personal**: empleado, doctor, y también los propios admin/rh/psicóloga
   (para reportar algo de su propia oficina). Ver §5.2: eso obliga a que un mismo usuario sea a la
   vez buzón y remitente, y es el caso que más código toca en el frontend.
4. Adjuntos (foto del desperfecto) funcionando: rama del canal en la policy de `storage.objects`.
   **Esto es lo que se olvidó la primera vez** y costó el corte del 2026-07-27.
5. Aviso push + campana a los cuatro roles cuando entra algo al buzón, y al empleado cuando le
   contestan.
6. **Rename completo** «Soporte TI» → **«Soporte Sistemas»** en las DOS cosas que hoy llevan ese
   nombre: la pantalla de tickets MCTIC (`SoporteTI.jsx`) y el canal de chat. Inventario cerrado en §6.

**Fuera (no-alcance), explícito:**

- **No** se toca `usuarios.soporte_ti` ni quién atiende Sistemas. Ese canal sigue funcionando
  exactamente igual; solo cambia cómo se llama en la pantalla.
- **No** se renombran identificadores internos: el valor de la columna sigue siendo `'soporte'`,
  la función sigue siendo `es_soporte_ti()`, la columna sigue siendo `soporte_ti`, el componente
  sigue siendo `SoporteTI.jsx` y las rutas siguen siendo `soporte`/`soporteti`. Renombrarlos
  obligaría a migrar datos y a reescribir policies vivas **para no cambiar ningún comportamiento**:
  es todo el riesgo del cambio a cambio de estética. El rename es de **etiquetas**, no de esquema.
- **No** hay pantalla de tickets de mantenimiento con estado (abierto / en progreso / resuelto).
  El dueño lo pidió como CHAT. Si algún día hace falta el estado, es otro plan.
- **No** hay categorías, prioridad ni asignación a un técnico concreto. Es un buzón.
- **No** se toca el módulo «Reportes Confidenciales». Se cita como referencia de UI, nada más.
- **No** se le da a la psicóloga acceso al canal de Sistemas, que hoy no tiene (ver §5.3, es un
  hallazgo del análisis, no un pedido). Queda como §9-P3.

---

## 2. Modelo de datos

### 2.1 Migración `00000000000155_canal_mantenimiento.sql`

> El **155** es el siguiente número libre **en este repo** (el último es
> `154_organigrama_datos_iniciales.sql`). **Confirmar contra la VPS antes de aplicar** — el repo ya
> se desfasó de producción antes (`plan-inventario-clinicas.md` nació en 113 y terminó en 120).
> Comando en §8.

```sql
-- ============================================================================
-- 155 — Canal de Soporte Mantenimiento dentro de Mensajes.
--
-- QUÉ AÑADE: un tercer canal, calcado del de Soporte TI (mig. 094), para los problemas que no
-- son de sistemas —una lámpara fundida, una silla rota, una fuga— y que hasta hoy llegaban al
-- buzón de TI porque era el único sitio donde reportar algo.
--
-- POR QUÉ POR ROL Y NO POR BANDERA, al revés que la 094: allí quienes atendían eran rol
-- `empleado` y una bandera era la única forma de darles ESE permiso sin darles nómina y
-- expedientes de propina. Aquí quienes atienden ya son admin, rh y psicóloga: el rol YA dice
-- quién es. Una columna nueva solo añadiría un interruptor que alguien tendría que acordarse de
-- encender cada vez que entre una persona a gestión.
--
-- current_role() pliega admin_plus -> admin (mig. 139), así que 'admin' aquí ya incluye a Admin+.
-- ============================================================================

begin;

-- ── 1. Quién atiende ────────────────────────────────────────────────────────
-- Mismo patrón que es_soporte_ti() y current_role(): SECURITY DEFINER y search_path fijo, para
-- que las policies puedan preguntarlo sin depender de la RLS de `usuarios`.
create or replace function public.es_mantenimiento()
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select coalesce((select public.current_role()) in ('admin', 'rh', 'psicologa'), false);
$$;

comment on function public.es_mantenimiento() is
  'Atiende el buzón de Soporte Mantenimiento. Por ROL (admin/admin_plus/rh/psicologa), a '
  'diferencia de es_soporte_ti(), que es una bandera por persona. Ver migración 155.';

-- ── 2. El canal ─────────────────────────────────────────────────────────────
alter table public.mensajes
  drop constraint if exists mensajes_canal_valido;
alter table public.mensajes
  add constraint mensajes_canal_valido
  check (canal in ('psicologa', 'soporte', 'mantenimiento'));

-- Sin destinatario en los DOS buzones. En el canal de la psicóloga un para_id nulo seguiría
-- siendo un mensaje que nadie recibe y que nadie podría leer: ahí sigue prohibido.
alter table public.mensajes
  drop constraint if exists mensajes_destinatario_salvo_soporte;
alter table public.mensajes
  add constraint mensajes_destinatario_salvo_soporte
  check (canal in ('soporte', 'mantenimiento') or para_id is not null);

comment on column public.mensajes.canal is
  'psicologa = canal confidencial 1 a 1. soporte = buzón compartido de Soporte Sistemas '
  '(bandera soporte_ti). mantenimiento = buzón compartido de Soporte Mantenimiento (por rol). '
  'En los dos buzones para_id es nulo cuando el mensaje va del personal HACIA el buzón.';

-- El buzón lee "todo lo de mantenimiento por fecha". Mismo índice parcial que el de soporte:
-- sin él es un recorrido de la tabla entera de mensajes, que solo crece.
create index if not exists mensajes_mantenimiento_fecha_idx
  on public.mensajes (fecha desc)
  where canal = 'mantenimiento';

-- ── 3. RLS de mensajes ──────────────────────────────────────────────────────
-- ⚠️ EL CUERPO DE ESTAS DOS POLICIES HAY QUE COPIARLO DE PRODUCCIÓN, NO DE AQUÍ.
-- Ver §7-R1 y §8 del plan: `drop policy` + `create policy` REEMPLAZA la regla viva. Lo de abajo
-- es lo que dice el repo (mig. 094 + 100) y sirve como esqueleto; si producción tiene otra cosa,
-- manda producción y este bloque se reescribe encima de ESA versión.
--
-- `mensajes_insert_as_sender` NO se toca: no mira el canal (solo exige de_id = yo), así que el
-- canal nuevo ya está permitido. Reescribirla sin necesidad es exponerse a R1 gratis.

drop policy if exists mensajes_select_participant on public.mensajes;
create policy mensajes_select_participant
  on public.mensajes for select
  using (
    (
      (select public.current_role()) in ('admin', 'rh', 'psicologa', 'empleado', 'doctor')
      and (
        de_id = (select public.current_usuario_id())
        or para_id = (select public.current_usuario_id())
      )
    )
    or (canal = 'soporte' and (select public.es_soporte_ti()))
    -- Buzón compartido: gestión ve TODO el canal de mantenimiento, incluidos los mensajes sin
    -- destinatario. Es justo lo que un buzón compartido significa.
    or (canal = 'mantenimiento' and (select public.es_mantenimiento()))
  );

-- Marcar leído: quien lo lea lo marca para todo el equipo. Lo que importa en un buzón es si
-- alguien lo atendió, no quién lo abrió primero.
drop policy if exists mensajes_update_mark_read on public.mensajes;
create policy mensajes_update_mark_read
  on public.mensajes for update
  using (
    para_id = (select public.current_usuario_id())
    or (canal = 'soporte' and (select public.es_soporte_ti()))
    or (canal = 'mantenimiento' and (select public.es_mantenimiento()))
  )
  with check (
    para_id = (select public.current_usuario_id())
    or (canal = 'soporte' and (select public.es_soporte_ti()))
    or (canal = 'mantenimiento' and (select public.es_mantenimiento()))
  );

-- El trigger trg_mensajes_prevent_tampering (mig. 032) NO se toca y sigue siendo el que impide
-- que "marcar leído" se convierta en "reescribir el mensaje de otro": la policy autoriza la
-- FILA, el trigger acota la COLUMNA. Con el buzón compartido esto importa más, no menos: aquí
-- hay cuatro personas con UPDATE sobre mensajes que no les fueron dirigidos.

-- ── 4. Adjuntos: LA TRAMPA ──────────────────────────────────────────────────
-- Las policies del bucket viven en `storage`, no en `public`. Olvidar esta rama fue el primer
-- fallo del corte del 2026-07-27: el chat funcionaba, las fotos no se abrían, y el síntoma
-- apuntaba al detector de rostros cuando era un permiso.
--
-- Aquí pesa MÁS que en soporte: un reporte de mantenimiento es, en la práctica, una foto del
-- desperfecto. Sin esta rama, el módulo entero no sirve para lo que se pidió.
--
-- ⚠️ Mismo aviso que arriba: copiar el cuerpo REAL de producción y añadirle la rama.
drop policy if exists mensajes_obj_select_participante on storage.objects;
create policy mensajes_obj_select_participante
  on storage.objects for select
  using (
    bucket_id = 'mensajes'
    and (
      (storage.foldername(name))[1] = ((select public.current_usuario_id()))::text
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = objects.name
          and m.para_id = (select public.current_usuario_id())
      )
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = objects.name
          and m.canal = 'soporte'
          and (select public.es_soporte_ti())
      )
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = objects.name
          and m.canal = 'mantenimiento'
          and (select public.es_mantenimiento())
      )
    )
  );

commit;
```

Al final del archivo, el bloque **VERIFICACIÓN + ROLLBACK** como en el resto de migraciones del
repo (modelo: 094 y 134). Rollback: restaurar los dos CHECK a su versión de la 094, restaurar las
dos policies de `mensajes` y la de `storage` **sin** la rama de mantenimiento, `drop index
mensajes_mantenimiento_fecha_idx`, `drop function public.es_mantenimiento()`. Ojo: el rollback
**no borra filas**; si ya hay mensajes con `canal='mantenimiento'`, el CHECK viejo lo rechazará.
Rollback real = borrar esas filas primero, o dejar el CHECK ampliado y quitar solo las ramas.

### 2.2 Lo que NO se agrega, y por qué

| Se pensó | Descartado porque |
|---|---|
| Columna `usuarios.mantenimiento` (bandera por persona, como `soporte_ti`) | Quienes atienden ya son admin/rh/psicóloga. La bandera solo añadiría un interruptor que hay que acordarse de encender, y un día alguien entra a RH y no ve el buzón sin que nadie sepa por qué |
| Tabla `mantenimiento_tickets` con estado y prioridad | El dueño pidió un CHAT, igual que el de TI. Una tabla de tickets es otro producto |
| Un bucket propio para las fotos del desperfecto | El bucket `mensajes` ya existe, ya tiene su lista blanca de MIME (mig. 101) y su purga de adjuntos (mig. 092). Un bucket nuevo son 3 policies y una purga más que mantener, para guardar lo mismo |
| Renombrar el valor `'soporte'` a `'sistemas'` en la columna | Un `update` sobre mensajes vivos + reescribir 4 policies y 6 sitios de código **para no cambiar ningún comportamiento**. Ver §1 (no-alcance) |

---

## 3. Cambios en `api/`

Sin esto, el canal **no se puede escribir aunque la base lo permita**: `enviar-mensaje.js`
hardcodea el canal en el payload.

### 3.1 `api/enviar-mensaje.js`

| Línea (hoy) | Qué dice | Qué pasa a decir |
|---|---|---|
| ~49 | `const esSoporte = canal === "soporte";` | añadir `const esMantenimiento = canal === "mantenimiento";` y `const esBuzon = esSoporte \|\| esMantenimiento;` |
| ~53 | `if ((!esSoporte && !paraId) \|\| …)` | `if ((!esBuzon && !paraId) \|\| …)` — en los dos buzones el remitente escribe sin destinatario |
| ~85-91 | rama `if (esSoporte) { if (paraId && !quien.soporte_ti) 403 }` | añadir rama gemela: en mantenimiento, **responder** (con `paraId`) exige `["admin","admin_plus","rh","psicologa"].includes(quien.role)`. **Escribir al buzón** (sin `paraId`) lo puede hacer cualquiera, sin comprobación |
| ~93 | `canal: esSoporte ? "soporte" : "psicologa"` | `canal: esSoporte ? "soporte" : esMantenimiento ? "mantenimiento" : "psicologa"` |
| ~110-120 | `mismaConversacion()`, rama `if (esSoporte)` | generalizar a `if (esBuzon)`: comparar contra `citado.canal !== canal` en vez de contra el literal `"soporte"`, y mantener «el hilo lo define EL EMPLEADO» (`paraId \|\| quien.id`). Sin esto se puede citar el mensaje de un compañero dentro de la conversación de otro |
| ~176-204 | notificación | ver 3.2 |

**El rol se comprueba contra `quien.role`, que viene de la base (`_auth.js`), no del JWT.**
`quien.role` es el rol REAL, sin plegar: por eso la lista debe incluir `admin_plus` explícitamente
(en el servidor no existe el `current_role()` que lo pliega).

### 3.2 Notificaciones — hay que reusar `notificarGestion`, no copiar el bucle

`api/_notificaciones.js` **ya tiene** exactamente la función que hace falta:
`notificarGestion({...})` consulta `usuarios` por `role in ('rh','admin','admin_plus','psicologa')
and inactivo = false`, inserta una fila de campana por persona y manda el push, y ya sabe traducir
la `url` por rol (`{admin, rh, psicologa}`, con `admin_plus → admin`). Es la misma lista de
destinatarios que este buzón necesita, resuelta AHORA y no fija.

```js
if (esMantenimiento && !paraId) {
  await notificarGestion({
    tipo: "mensaje",
    titulo: `Mantenimiento: ${quien.name}`,
    cuerpo: resumen,
    url: { admin: "/admin/mensajes", rh: "/rh/mensajes", psicologa: "/psicologa/mensajes" },
  });
} else if (esSoporte && !paraId) {
  … (el bucle de soporte_ti que ya existe, sin tocar)
} else {
  … (notificar al destinatario; el `titulo` pasa a depender del canal)
}
```

En la rama del destinatario (~200), el título hoy es
`esSoporte ? "Respuesta de Soporte TI" : \`Nuevo mensaje de ${quien.name}\``; pasa a tres casos:
`"Respuesta de Soporte Sistemas"` / `"Respuesta de Mantenimiento"` / `Nuevo mensaje de X`.

> **Que un reporte de mantenimiento no avise a nadie sería un fallo silencioso**: el empleado ve su
> mensaje enviado, gestión no se entera, y nadie sabe que el sistema no funcionó. Por eso esto es
> parte de la Fase 2 y tiene criterio de aceptación propio, no un extra.

### 3.3 `api/_auth.js` — no se toca

Ya trae `role`, que es lo único que este canal necesita. `soporte_ti` sigue viajando para el otro
canal. **Cero cambios.**

### 3.4 `api/limpiar-adjuntos.js` (~76-78) — no se toca, pero verificar

`partesDe = (m) => [m.de_id, m.para_id].filter(Boolean)` ya está escrito de forma genérica: filtra
los nulos, así que un mensaje de mantenimiento sin destinatario tampoco llamará a `notificar(null)`.
Solo hay que **actualizar el comentario** (dice «el canal de Soporte TI») y confirmar en la Fase 2
que el aviso de adjunto por caducar sigue saliendo bien con el canal nuevo.

---

## 4. Frontend

### 4.1 `src/components/comunicacion/Mensajes.jsx` — el archivo que de verdad cambia

Hoy el componente asume **un solo buzón** y **dos formas de mirar** (o eres el empleado que
escribe, o eres quien atiende). Con dos buzones y con gestión pudiendo escribir a uno de ellos, la
estructura actual se cae por tres sitios:

**(a) `soloSoporte` (línea 78).** `["admin","admin_plus","rh"].includes(role)` significa hoy dos
cosas a la vez: «no ve el chat de la psicóloga» y «solo ve el buzón». La primera sigue valiendo, la
segunda ya no. Se renombra a `esGestion` y se queda **solo** con la primera responsabilidad.

**(b) El fork por rol de `conversaciones` (línea 148).** `user.role === "psicologa" ? … : […]` deja
a la psicóloga **fuera de todo lo que no sea su lista de empleados** — hoy ni siquiera ve el canal
de Sistemas (§5.3). Y ahora la psicóloga **tiene que ver el buzón de mantenimiento**. El ternario
se sustituye por una suma de partes independientes:

```
conversaciones = [
  ...(esPsicologa ? empleados.map(conversacionCon) : []),        // sus hilos confidenciales
  ...(psicologa && !esGestion && !esPsicologa ? [conversacionCon(psicologa)] : []),
  ...bloqueDeBuzon("soporte",       atiendeSoporte),
  ...bloqueDeBuzon("mantenimiento", atiendeMantenimiento),
]
```

**(c) `hilosDeSoporte()` y `CANAL_SOPORTE` (líneas 50-55, 131-146) se generalizan a un parámetro
`canal`.** Es literalmente el mismo código con la cadena `"soporte"` cambiada; duplicarlo es
garantizar que el próximo arreglo se aplique a uno solo de los dos. Queda:

```js
const BUZONES = {
  soporte:       { id: "canal-soporte-ti",     name: "Soporte Sistemas", puesto: "Sistemas",       icono: "wrench" },
  mantenimiento: { id: "canal-mantenimiento",  name: "Mantenimiento",    puesto: "Mantenimiento",  icono: "building" },
};
```

`building` (Building02) ya existe en `Icon.jsx:55` — **no hace falta importar ningún icono nuevo**.
Se elige distinto de `wrench` a propósito: los dos buzones van uno debajo del otro en la misma
lista y con el mismo icono serían indistinguibles de un vistazo, que es exactamente el problema que
este plan viene a resolver.

**(d) El caso que hay que no equivocar: quien atiende, también escribe.** El dueño pidió que
admin/rh/psicóloga puedan reportar algo de su propia oficina. Son las mismas personas que atienden
el buzón, así que para ellas el buzón es dos cosas a la vez.

El pseudo-contacto del empleado hoy hace `mensajes.filter(esDeSoporte)` — correcto para quien NO
atiende (la RLS solo le entrega lo suyo), y **incorrecto para quien sí atiende** (la RLS le entrega
todo el buzón: vería los reportes de los demás dentro de su propia conversación). La regla que
sirve para los dos casos es la misma:

- **Pseudo-contacto «escribir al buzón»** → los mensajes del canal donde `m.de === yo || m.para === yo`.
  Para quien no atiende da exactamente el mismo resultado que hoy; para quien atiende, su propio hilo.
- **Lista de hilos (solo si atiende)** → un hilo por persona, **excluyendo el hilo cuyo empleado soy
  yo**, que ya está arriba como pseudo-contacto. Sin esa exclusión la misma conversación sale dos
  veces en la lista.

**(e) `conversacionesActivas` (172-181)** tiene hoy tres ramas (psicóloga / atiende soporte / resto)
y pasa a ser una sola regla: los pseudo-contactos y el chat propio con la psicóloga se conservan
**aunque estén vacíos** (son míos), los hilos que atiendo se muestran **solo si tienen mensajes** y
ordenados por recencia.

**(f) Textos.** El `subtitle` del `PageHeader` (414-418) y el renglón de buzón vacío (496-501) están
escritos para un único buzón. Pasan a construirse desde la lista de buzones que esta persona
atiende, para no acabar con cuatro cadenas fijas y una combinación sin cubrir.

**(g) La pastilla de la cabecera (541-549)** pasa de `soporte ? "Soporte TI" : "Privado"` a leer
`BUZONES[selected.canal]?.name ?? "Privado"`.

> **Test.** La lógica de armar la lista de conversaciones es el único trozo de todo el plan que se
> puede romper en silencio (una conversación duplicada, o el hilo de otro dentro del mío). Se extrae
> a `src/utils/conversaciones.js` con `conversaciones.test.js` — mismo criterio que
> `utils/organigrama/arbol.js`. Casos mínimos: empleado (2 pseudo-contactos, ninguno con mensajes
> ajenos), admin que atiende y además escribió (su hilo aparece **una** vez), psicóloga (sus hilos
> confidenciales **más** el buzón), y un mensaje de mantenimiento de otra persona **no** aparece
> dentro del pseudo-contacto de quien atiende.

### 4.2 Layouts (`EmpleadoLayout.jsx:37-39`, `DoctorLayout.jsx:39-41`)

El filtro local tira todo lo que no sea mío salvo el canal de soporte:

```js
(m) => m.de === user?.id || m.para === user?.id || (user?.soporteTi && m.canal === "soporte")
```

Un empleado con `soporteTi` no atiende mantenimiento, así que **para estos dos layouts no hace
falta cambiar nada**… salvo que un empleado con la bandera reciba por RLS mensajes de
mantenimiento, cosa que no pasa (la rama de RLS es por rol y ellos son `empleado`). **Se deja tal
cual**, y se añade una línea de comentario diciendo por qué mantenimiento no aparece aquí.

`AdminLayout:79`, `HRLayout:97` y `PsicologaLayout:74` pasan `mensajes` sin filtrar → ya reciben lo
que la RLS entregue, incluido el canal nuevo. **Cero cambios.**

### 4.3 `BotonMensajes.jsx:31-33` — el contador de no leídos

Hoy: `veChat = ["psicologa","empleado","doctor"].includes(role)` y cuenta solo `m.para === yo`.
Con este cambio hay dos agujeros, y **el segundo sí es un fallo funcional**:

1. admin/admin_plus/rh no reciben cuenta (el propio comentario del archivo dice que es «una
   decisión sin justificar»). Ahora es peor: son los que atienden el buzón nuevo.
2. `m.para === yo` **nunca es cierto para un mensaje que entra a un buzón** (`para` es nulo). O
   sea que un reporte de mantenimiento sin atender **no encendería el badge de nadie**.

Arreglo mínimo, sin tocar el resto: contar también los del buzón que atiendo.

```js
const atiendeMantenimiento = ["admin","admin_plus","rh","psicologa"].includes(user?.role);
const esMio = (m) =>
  m.para === user?.id
  || (!m.para && m.canal === "soporte"       && user?.soporteTi)
  || (!m.para && m.canal === "mantenimiento" && atiendeMantenimiento);
```

y `veChat` pasa a incluir a admin/admin_plus/rh. La cuenta y el marcado ya son coherentes dentro de
`Mensajes.jsx` (`!m.para` en `noLeidos` y en el efecto de marcar leído, líneas 109-111 y 242-244):
esas dos condiciones **ya cubren el canal nuevo sin tocarlas**, porque miran `!m.para`, no el canal.

### 4.4 Menú: **no lleva ítem propio**. Por qué, y qué se hace en su lugar

El dueño dijo «una sección como los reportes confidenciales», y esos **sí** tienen ítem propio
(`reporteconfidencial` para empleado/doctor, `confidenciales` para gestión). Aun así, la
recomendación es **no** darle ítem de menú, por tres razones concretas de este repo:

1. **El canal de Sistemas —del que este es copia— tampoco lo tiene.** Vive dentro de Mensajes. Un
   ítem para uno y no para el otro es la asimetría que después nadie entiende.
2. **La clave `soporte` ya significa dos páginas distintas según el rol** («Ideas de mejora» en
   gestión, «Soporte TI» en plantilla), y el propio `navItems.js` lo documenta como una rareza que
   hubo que explicar en tres comentarios. Meter un tercer nombre parecido al lado agrava eso.
3. Un ítem que abre la misma pantalla que «Mensajes» pero con una conversación preseleccionada es
   un caso especial en `Sidebar`, en el buscador global y en el resaltado de ruta activa.

**En su lugar** (esto sí atiende el problema real, que es que la gente no encuentra dónde
reportar): el pseudo-contacto **«Mantenimiento» aparece siempre en la lista de conversaciones**, con
icono propio, aunque nunca haya escrito nadie; y el `subtitle` de la pantalla lo nombra. Es
exactamente cómo hoy un empleado encuentra Soporte TI.

**Si el dueño lo quiere igual** (§9-P1), el coste es bajo y acotado: `{ key: "mantenimiento", icon:
"building", label: "Mantenimiento", group: "Ayuda" }` en `empleado` y `doctor`, + una línea en
`DESCRIPCIONES`, + una ruta por layout que redirija a Mensajes con la conversación abierta
(`<Navigate to="…/mensajes" state={{ conversarCon: "canal-mantenimiento" }} replace />` — el estado
`conversarCon` ya lo lee `Mensajes.jsx:64`). **No** se le da ítem a gestión: para ellos es un hilo
más dentro de una pantalla que ya abren.

---

## 5. Permisos, de un vistazo

### 5.1 Quién puede qué

| Acción | Quién | Dónde se cumple de verdad |
|---|---|---|
| Escribir al buzón de Mantenimiento | los 6 roles | `mensajes_insert_as_sender` (sin cambios) + CHECK `mensajes_destinatario_salvo_soporte` |
| Leer TODO el buzón de Mantenimiento | admin, admin_plus, rh, psicóloga | `mensajes_select_participant`, rama `es_mantenimiento()` |
| Responder en Mantenimiento (a una persona) | admin, admin_plus, rh, psicóloga | `api/enviar-mensaje.js` (guarda por `quien.role`) — la RLS de insert **no** lo distingue, ver §7-R4 |
| Marcar leído en Mantenimiento (para todos) | admin, admin_plus, rh, psicóloga | `mensajes_update_mark_read` + trigger `prevent_mensaje_tampering` (mig. 032) acota a la columna `leido` |
| Abrir la foto adjunta de un reporte | admin, admin_plus, rh, psicóloga | `mensajes_obj_select_participante`, rama nueva |
| Leer el canal de Sistemas | quien tenga `usuarios.soporte_ti` | sin cambios (mig. 094) |
| Leer el canal de la psicóloga | sus dos participantes | sin cambios |

### 5.2 Qué ve cada rol en la lista de conversaciones, DESPUÉS del cambio

| Rol | Chat con psicóloga | Buzón Sistemas | Buzón Mantenimiento |
|---|---|---|---|
| **empleado** | sí (el suyo) | escribe (pseudo-contacto). Si tiene `soporte_ti`: además los hilos de todos | escribe (pseudo-contacto) |
| **doctor** | sí (el suyo) | escribe (pseudo-contacto) | escribe (pseudo-contacto) |
| **psicóloga** | sus hilos con cada empleado | **no** (hoy tampoco — §5.3 / §9-P3) | **atiende**: todos los hilos + su propio pseudo-contacto para escribir |
| **rh** | no | escribe (pseudo-contacto, mig. 100) | **atiende**: todos los hilos + su propio pseudo-contacto |
| **admin** | no | escribe (pseudo-contacto) | **atiende**: todos los hilos + su propio pseudo-contacto |
| **admin_plus** | no | escribe (pseudo-contacto) | **atiende** (`current_role()` lo pliega a admin, mig. 139; en `api/` hay que listarlo explícitamente) |

### 5.3 Dos asimetrías que quedan, a propósito

- **La psicóloga no ve el canal de Sistemas.** No es nuevo: lo causa el fork
  `user.role === "psicologa" ? … : …` de `Mensajes.jsx:148`, que la deja fuera de todo lo que no sean
  sus hilos. Al reestructurar ese bloque **se podría arreglar de paso con una línea**, pero eso es
  cambiar lo que ve un rol sin que nadie lo haya pedido. Queda como §9-P3.
- **Admin y RH no ven el chat de la psicóloga.** Es deliberado y se conserva (`esGestion`). La
  garantía real no es la pantalla sino `mensajes_select_participant`.

---

## 6. Inventario del rename «Soporte TI» → «Soporte Sistemas»

Dejar la mitad renombrada es el fallo típico de esto. La lista está cerrada: son **68 apariciones en
17 archivos**, clasificadas en tres grupos.

### 6.1 Texto que ve el usuario — HAY QUE CAMBIARLO (12 sitios)

| Archivo:línea | Hoy | Queda |
|---|---|---|
| `src/components/common/SoporteTI.jsx:132` | `title="Soporte TI"` | `title="Soporte Sistemas"` |
| `src/components/common/SoporteTI.jsx:133` | subtítulo «…el área de TI lo atenderá.» | «…el área de Sistemas lo atenderá.» |
| `src/config/navItems.js:75` | psicóloga → label `"Soporte TI"` (key `soporteti`) | `"Soporte Sistemas"` |
| `src/config/navItems.js:114` | rh → label `"Soporte TI"` (key `soporteti`) | `"Soporte Sistemas"` |
| `src/config/navItems.js:143` | empleado → label `"Soporte TI"` (key `soporte`) | `"Soporte Sistemas"` |
| `src/config/navItems.js:168` | doctor → label `"Soporte TI"` (key `soporte`) | `"Soporte Sistemas"` |
| `src/config/navItems.js:218` | `mensajes: "Conversaciones con el equipo y con Soporte TI."` | «…con Soporte Sistemas y con Mantenimiento.» |
| `src/components/comunicacion/Mensajes.jsx:52` | `name: "Soporte TI"` (pseudo-contacto) | `"Soporte Sistemas"` (pasa a `BUZONES`, §4.1c) |
| `src/components/comunicacion/Mensajes.jsx:415` | subtitle «…el buzón de Soporte TI que atiendes.» | se reconstruye desde los buzones que atiende (§4.1f) |
| `src/components/comunicacion/Mensajes.jsx:418` | subtitle «…y Soporte TI para problemas del sistema.» | ídem, nombrando los dos buzones |
| `src/components/comunicacion/Mensajes.jsx:499` | «Buzón de Soporte TI · nadie ha escrito todavía» | ídem, por buzón (§4.1f) |
| `src/components/comunicacion/Mensajes.jsx:543` | pastilla `Soporte TI` | `BUZONES[canal].name` (§4.1g) |

### 6.2 Texto que ve el usuario en `api/` — HAY QUE CAMBIARLO (3 sitios)

| Archivo:línea | Hoy | Queda |
|---|---|---|
| `api/enviar-mensaje.js:87` | error «Solo quien atiende Soporte TI puede responder en ese canal.» | «…Soporte Sistemas…» |
| `api/enviar-mensaje.js:189` | push `Soporte TI: ${quien.name}` | `Soporte Sistemas: ${quien.name}` |
| `api/enviar-mensaje.js:200` | push «Respuesta de Soporte TI» | «Respuesta de Soporte Sistemas» |

> Estos tres son los únicos textos de servidor. `navItems.js:271` y `:281-282` («Reporta un problema
> técnico al equipo de sistemas.») **ya dicen “sistemas”** y no hace falta tocarlos.

### 6.3 Comentarios y documentación — se actualizan, sin prisa (9 archivos)

Comentarios que hoy dicen «Soporte TI» y conviene que digan «Soporte Sistemas (antes Soporte TI)»
la primera vez que aparecen en cada archivo, para que quien lea el código dentro de un año pueda
enlazar el nombre nuevo con las migraciones 094/100, que siguen llamándose así:

`src/contexts/AuthContext.jsx:31` · `src/services/supabase/mensajesService.js:143` ·
`src/components/layout/BotonMensajes.jsx:28` · `src/components/layout/HeaderNav.jsx:51` ·
`src/components/layout/EmpleadoLayout.jsx:34` · `src/components/layout/DoctorLayout.jsx:36` ·
`src/components/empleados/FichaEmpleado.jsx:69` · `src/config/navItems.js:72-74, 200, 276-277` ·
`src/App.css:8066, 8443` · `api/_auth.js:49-50` · `api/limpiar-adjuntos.js:76` ·
`api/enviar-mensaje.js:7, 22-24, 79-83`

### 6.4 Lo que NO se toca — y por qué

| Qué | Por qué |
|---|---|
| `supabase/migrations/094`, `100` (7 menciones) | Son historia ya aplicada. Editar una migración que corrió en producción es mentir sobre lo que pasó |
| `README.md` (10 menciones, todas ≥ línea 498) | Todas están dentro del Changelog, que empieza en la línea 116. Es bitácora: se le **añade** una entrada nueva, no se reescribe la vieja |
| `plans/plan.md` (11 menciones) | Mismo motivo: es el plan histórico del canal de soporte |
| Identificadores: `usuarios.soporte_ti`, `es_soporte_ti()`, `canal = 'soporte'`, `SoporteTI.jsx`, rutas `soporte`/`soporteti`, `CANAL_SOPORTE.id = "canal-soporte-ti"`, clases CSS | §1, no-alcance. Renombrarlos es migrar datos y reescribir policies vivas para no cambiar ningún comportamiento |
| `soporte_tickets_estado` (mig. 051, `api/tareas-programadas.js`) | Es la tabla del sondeo de MCTIC. Nada que ver con el nombre visible |

---

## 7. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| **R1** | **El peor de todos.** La migración hace `drop policy` + `create policy` sobre dos policies VIVAS de `mensajes` y una de `storage`. Si se copia el cuerpo del repo y producción tiene otra cosa, la migración **borra reglas vivas en silencio** y el chat queda mal abierto o mal cerrado — y no falla: aplica bien | **Sacar el cuerpo REAL de producción antes de escribir el SQL** (§8), pegarlo en la migración y añadirle SOLO la rama nueva. Verificar después que el `pg_get_expr` de cada policy contiene todavía las ramas viejas, no solo la nueva |
| **R2** | Olvidar la rama de `storage.objects`: el chat funciona, la foto del desperfecto no se abre, y el síntoma no apunta al permiso. Ya pasó el 2026-07-27 | Está en la Fase 1 y tiene criterio de aceptación propio en la Fase 2 (subir una foto y abrirla como admin) |
| **R3** | El número 155 ya existe en la VPS | Confirmarlo antes de aplicar (§8). Le pasó a `plan-inventario-clinicas` |
| **R4** | `mensajes_insert_as_sender` **no mira el canal**: por PostgREST, un empleado puede insertar `canal='mantenimiento'` con `para_id` de quien quiera y saltarse la guarda de `api/`. **No es nuevo** — hoy pasa igual con `'soporte'` y con `'psicologa'` — pero este plan tampoco lo cierra | Se documenta y **no se toca en este plan**: cerrarlo es reescribir la policy de insert de todos los canales (R1 otra vez) por un agujero preexistente. §9-P4 |
| **R5** | Con el buzón compartido hay cuatro personas con `UPDATE` sobre filas que no les fueron dirigidas | Ya cubierto por el trigger `prevent_mensaje_tampering` (mig. 032), que acota el UPDATE a la columna `leido`. **Verificarlo explícitamente** en la Fase 1: es el candado que impide que «marcar leído» sea «reescribir lo que dijo otro» |
| **R6** | El rename a medias: menú renombrado y push diciendo todavía «Soporte TI», o al revés | §6 es la lista cerrada. Criterio de aceptación de la Fase 4: `rg "Soporte TI" src/ api/` solo devuelve comentarios |
| **R7** | Nadie recibe el aviso de un reporte nuevo (`m.para` nulo ⇒ el badge no cuenta, §4.3), y el fallo es **silencioso**: el empleado ve «enviado» | §4.3 + criterio propio en la Fase 2 (campana **y** badge) |
| **R8** | La conversación propia de quien atiende sale duplicada, o ve reportes de otros dentro de su propio hilo | §4.1d + el test de `conversaciones.test.js` (Fase 3) |
| **R9** | Rollback imposible si ya hay mensajes en el canal nuevo (el CHECK viejo los rechaza) | Anotado en §2.1. El rollback real deja el CHECK ampliado y quita solo las ramas de las policies |

---

## 8. Verificación contra producción — **pendiente, hacer ANTES de escribir el SQL**

No se pudo ejecutar desde esta sesión. Es lo primero de la Fase 0 y lo que desactiva R1 y R3.

```bash
ssh -i ~/.ssh/pulse_vps_key root@2.25.150.106
```

```sql
-- 1) El cuerpo REAL de las policies que la migración va a REEMPLAZAR (R1):
select polname,
       pg_get_expr(polqual, polrelid)      as using,
       pg_get_expr(polwithcheck, polrelid) as with_check
from pg_policy where polrelid = 'public.mensajes'::regclass
order by polname;

select polname,
       pg_get_expr(polqual, polrelid) as using
from pg_policy
where polrelid = 'storage.objects'::regclass
  and polname = 'mensajes_obj_select_participante';

-- 2) Los CHECK actuales de `mensajes`:
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.mensajes'::regclass and contype = 'c';

-- 3) Que 155 esté libre (R3):
select version from supabase_migrations.schema_migrations order by version desc limit 5;

-- 4) Que el trigger de la mig. 032 siga vivo (R5):
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.mensajes'::regclass and not tgisinternal;

-- 5) Cuántas filas hay por canal, para saber qué se está tocando:
select canal, count(*), count(*) filter (where para_id is null) as sin_destinatario
from public.mensajes group by canal;
```

```bash
docker exec -i pulse-db psql -U postgres -d postgres -tAc "…"
```

**La migración no se escribe hasta tener la salida de (1) y (2) pegada en el archivo.**

---

## 9. Fases

### Fase 0 — Verificar producción
Los 5 bloques de §8. Sin código.

**Aceptación:** el cuerpo real de las 3 policies y de los 2 CHECK está copiado en el repo (en el
propio archivo de migración, comentado como «versión encontrada en producción el <fecha>»), y está
confirmado que 155 está libre y que `trg_mensajes_prevent_tampering` sigue activo.

---

### Fase 1 — Base de datos (migración 155)
`es_mantenimiento()`, los dos CHECK, el índice parcial, las 2 policies de `mensajes` y la de
`storage`, sobre el cuerpo real de la Fase 0. Con bloque de verificación y rollback.

**Aceptación** (con `psql`, dentro de una transacción con `rollback`, como se hizo con la 134 y la 153):
- Como **empleado**: `insert into mensajes (de_id, canal, texto) values (yo, 'mantenimiento', 'x')`
  con `para_id` nulo → **OK**.
- Como **empleado**: el mismo insert con `canal = 'psicologa'` y `para_id` nulo → **falla** (el CHECK
  del canal confidencial sigue puesto).
- Como **empleado**: `select` sobre un mensaje de mantenimiento **de otra persona** → **0 filas**.
- Como **rh** y como **psicóloga**: `select` de ese mismo mensaje → **1 fila**.
- Como **admin_plus**: `select` de ese mensaje → **1 fila** (el plegado de la mig. 139 funciona).
- Como **rh**: `update mensajes set leido = true` sobre un mensaje de mantenimiento ajeno → **OK**.
- Como **rh**: `update mensajes set texto = 'reescrito'` sobre ese mismo mensaje → **falla** con
  «solo puedes cambiar si está leído» (R5, trigger mig. 032).
- **No hay regresión en lo viejo**: como quien tiene `soporte_ti`, `select` sobre un mensaje del
  canal `'soporte'` ajeno → **sigue devolviendo 1 fila**; y el canal de la psicóloga sigue cerrado a
  terceros. *(Es la comprobación que detecta que R1 se comió una rama.)*
- `pg_get_expr` de las 3 policies contiene **las tres** ramas (participante, soporte, mantenimiento).

---

### Fase 2 — Servidor (`api/`)
`enviar-mensaje.js` (§3.1) + notificación con `notificarGestion` (§3.2) + comentario de
`limpiar-adjuntos.js`.

**Aceptación** (con `curl` y sesión real, en producción o en un entorno con las claves):
- Empleado → `POST /api/enviar-mensaje` con `{canal:"mantenimiento", paraId:null, texto:"…"}` → 200 y
  la fila queda con `canal='mantenimiento'`, `para_id is null`.
- Empleado → mismo POST **con** `paraId` → **403** («solo gestión responde en ese canal»).
- RH → responde con `paraId` del empleado → 200.
- Tras el POST del empleado: hay **una fila en `notificaciones` por cada persona** de
  admin/admin_plus/rh/psicóloga activa, con la `url` correcta de su rol (`/rh/mensajes` para rh,
  `/admin/mensajes` para admin **y para admin_plus**). *(R7)*
- Responder citando (`respondeA`) un mensaje **del hilo de otro empleado** → **400**.
- El canal `'soporte'` y el `'psicologa'` siguen funcionando exactamente igual (un envío de cada uno,
  con su push).

---

### Fase 3 — Frontend
`utils/conversaciones.js` + su test, `Mensajes.jsx` (§4.1), `BotonMensajes.jsx` (§4.3), comentario
en los dos layouts de plantilla.

**Aceptación:**
- `npx vitest run` verde, **incluido** `conversaciones.test.js` con los 4 casos de §4.1.
- Como **empleado** en el navegador: la lista muestra psicóloga + Soporte Sistemas + Mantenimiento;
  escribe a Mantenimiento con **una foto**; el mensaje sale y la foto se ve.
- Como **admin** (otro navegador): el reporte aparece en su lista, **la foto se abre** *(R2)*,
  contesta, y el empleado recibe la respuesta.
- Como **rh**: el mismo mensaje aparece ya **marcado como leído** después de que admin lo abriera.
- Como **psicóloga**: ve el buzón de Mantenimiento **y** sigue viendo sus hilos confidenciales con
  cada empleado *(la reestructuración del fork no le rompió lo suyo)*.
- Como **admin** que escribe al buzón: su propio hilo aparece **una sola vez** *(R8)* y **no** ve los
  reportes de otros dentro de él.
- El badge de Mensajes cuenta el reporte sin atender y se apaga al abrirlo *(R7)*.
- `npm run lint` sin errores nuevos sobre el baseline y `npm run build` compila.

---

### Fase 4 — Rename
Los 15 textos de §6.1-6.2 y los comentarios de §6.3.

**Aceptación:**
- `rg "Soporte TI" src/ api/` devuelve **solo comentarios** (ninguna cadena entre comillas que
  llegue a la pantalla o a un push).
- En el navegador, con **los 6 roles**: el menú dice «Soporte Sistemas», la pantalla de tickets dice
  «Soporte Sistemas», la pastilla del chat dice «Soporte Sistemas», y el push de una respuesta dice
  «Respuesta de Soporte Sistemas».
- Abrir un ticket de MCTIC sigue funcionando (el rename no tocó `/api/soporte-ticket`).
- Entrada nueva en el Changelog del `README.md`, sin reescribir las viejas *(§6.4)*.

---

## 10. Preguntas abiertas para el dueño

**P1 — ¿Mantenimiento lleva ítem de menú propio?** El plan dice **no** y lo justifica en §4.4: vive
dentro de Mensajes, igual que Soporte Sistemas, y siempre visible en la lista de conversaciones. Si
lo quiere igual (para que se parezca a Reportes Confidenciales), el coste está acotado en §4.4:
`{ key: "mantenimiento", icon: "building", label: "Mantenimiento", group: "Ayuda" }` en **empleado y
doctor**, una línea de descripción y una ruta-redirección por layout. **A gestión no se le daría
ítem** en ningún caso: para ellos es un hilo dentro de una pantalla que ya abren.

**P2 — ¿Cómo se llama exactamente, para el empleado?** El plan usa **«Mantenimiento»** a secas en la
lista de conversaciones (al lado de «Soporte Sistemas» se entiende solo y cabe en el móvil). El
dueño lo llamó «Soporte Mantenimiento». Si prefiere el nombre largo, es una cadena en `BUZONES`.

**P3 — ¿La psicóloga debería poder escribir a Soporte Sistemas?** Hoy **no puede** (§5.3), y es un
efecto lateral del código, no una decisión. Al reestructurar `Mensajes.jsx` se arregla con una
línea. ¿Se arregla de paso, o se deja como está?

**P4 — El agujero preexistente de `mensajes_insert_as_sender` (R4).** Por PostgREST, un empleado
puede insertar un mensaje dirigido a quien quiera, en cualquier canal, saltándose la guarda del
servidor. **No lo abre este cambio** y este plan no lo cierra. ¿Se abre un plan aparte para eso?

**P5 — ¿Los mensajes de mantenimiento ya enviados al buzón de Sistemas se mueven?** Hay reportes de
mantenimiento vivos dentro del canal `'soporte'` (es el motivo del pedido). ¿Se dejan donde están y
el corte es «de aquí en adelante», o se quiere un `update … set canal='mantenimiento'` sobre los que
Erick y Alfredo señalen? Lo segundo necesita que alguien los identifique uno por uno: **ninguna
consulta puede distinguirlos automáticamente**.

---

## 10.1 Respuestas del dueño (2026-09-09) — el plan queda APPROVED

- **P1 — ¿ítem de menú propio?** → **No.** Vive dentro de Mensajes, como el de Soporte Sistemas.
  No se agrega ninguna clave nueva a `navItems.js` ni ruta nueva a ningún layout.
- **P2 — ¿cómo se llama?** → **«Soporte Mantenimiento»**, el nombre largo (NO «Mantenimiento» a
  secas, que era lo que proponía el plan en §4.1 y §5.2). Cambia la cadena `name` del pseudo-contacto
  en `BUZONES` y cualquier etiqueta derivada. Ojo en móvil: la lista de conversaciones tiene que
  aguantar el nombre largo sin romperse — si se corta, se corta con puntos suspensivos, no se
  acorta el nombre.
- **P3 — ¿la psicóloga puede escribirle a Soporte Sistemas?** → **Se deja como está: NO puede.**
  No se toca ese comportamiento en este cambio.
  ⚠️ Cuidado al reestructurar `Mensajes.jsx:148`: la psicóloga **SÍ** tiene que ver y contestar el
  buzón de **Mantenimiento** (es una de las tres que lo atienden, requisito original del dueño).
  Lo que NO gana es una conversación propia hacia **Sistemas**. Son dos cosas distintas en el mismo
  `if`, y confundirlas rompe uno de los dos requisitos.
- **P4 — el agujero preexistente de `mensajes_insert_as_sender` (R4)** → fuera de alcance acá,
  como proponía el plan. Queda anotado para un plan aparte; este cambio no lo abre ni lo cierra.
- **P5 — ¿se mueven los reportes de mantenimiento que ya están en el buzón de Sistemas?** → **No.**
  Corte de aquí en adelante: los que ya existen se resuelven donde están y el canal nuevo arranca
  vacío. Ningún `update … set canal='mantenimiento'` en la migración.

Sin cambios respecto del plan en todo lo demás (buzón compartido por rol para admin/admin_plus/rh/
psicologa, escribe todo el personal, rename a las dos cosas que hoy se llaman «Soporte TI»).
