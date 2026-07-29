# Plan — Navegación, Mensajes visible, aviso de actualización y canal de Soporte TI

STATUS: PENDIENTE DE APROBACION
Fecha: 2026-07-29
Alcance: `/opt/pulse/app` en la VPS (producción)

---

## Lo que se pide

1. Separar mejor los ajustes del lado del empleado: hoy todo cuelga de **2 menús**
   ("Mi trabajo" con 9 ítems y "Herramientas" con 3) y es confuso.
2. **Mensajes fuera de los menús**, a la vista, en **todos los roles**.
3. El aviso de actualización debe ser **obligatorio**: un aviso al que hay que darle
   "Actualizar" sí o sí.
4. En Mensajes, **debajo del chat de la psicóloga, un canal de Soporte TI**. Ese canal lo
   atienden **Erick Joseph Torres Suárez** y **Alfredo Eduardo Burgos Reyes**.
5. Revisar la **vista móvil de todos los menús**.
6. **La psicóloga no puede aprobar permisos ni vacaciones** — revisarlo y arreglarlo (Fase 0).

---

## Estado actual (verificado en el código, no de memoria)

| Pieza | Dónde | Cómo está hoy |
|---|---|---|
| Navegación | `src/config/navItems.js` | Todo declarativo por rol, con `group`. Un ítem **sin** `group` se pinta como enlace directo en la barra. |
| Barra / menús | `src/components/layout/HeaderNav.jsx` | Desplegables por grupo + menú de usuario + panel móvil (hamburguesa). |
| Aviso de actualización | `src/main.jsx:88-99` + `src/utils/appUpdate.js` | **Toast descartable** (`notify.toast.update`) al `controllerchange`. |
| Modal bloqueante (precedente) | `src/components/avisos/AvisoModal.jsx`, montado en `App.jsx` | Ya existe el patrón "overlay que no se puede esquivar". |
| Mensajes | `src/components/comunicacion/Mensajes.jsx` (456 líneas) | Lista de conversaciones + hilo. Empleado ve **una sola** conversación: la psicóloga. |
| Modelo de datos | tabla `mensajes` | Estrictamente **1 a 1**: `de_id` y `para_id`, ambos `NOT NULL`. |
| Envío | `api/enviar-mensaje.js` | Pasa por el servidor para el push. Guarda: un empleado solo puede escribir a `admin`/`rh`/`psicologa`. |
| RLS | mig. 016 → 028 → 073, `mensajes_select_participant` | "Lo veo si soy `de_id` o `para_id`". |
| Última migración | `supabase/migrations/` | **093**. La siguiente es la **094**. |

### Cinco hallazgos que condicionan el plan

1. **Erick y Alfredo son rol `empleado`** (`106cff6e…` y `fff31b54…`), no admin ni RH. Así que
   el buzón de soporte **no puede depender del rol**: hay que marcar a las personas con una
   bandera propia. Si se hiciera por rol, habría que ascenderlos a admin y les abriríamos
   nómina, expedientes y reportes confidenciales solo para que puedan contestar dudas de TI.

2. **`mensajes` es 1 a 1 y `para_id` es `NOT NULL`.** Un buzón compartido por dos personas no
   entra en ese molde tal cual: hay que añadir el concepto de *canal* y permitir `para_id`
   nulo solo en ese caso.

3. **Por debajo de 1100 px la barra entera desaparece** (`App.css:10863`, `.topnav-links {
   display: none }`) y todo se va a la hamburguesa. O sea: sacar Mensajes del menú **no lo
   hace visible en el celular**, que es justo donde lo usa la gente. Tiene que ser un botón
   propio en la zona derecha del header (junto a la campana), que sobrevive a todos los anchos.

4. **Ya hay dos cosas llamadas "Soporte TI"**: la clave `soporte` es la página de *Ideas de
   mejora* (así se llama para admin/RH/psicóloga) y para empleado/doctor está rotulada
   "Soporte TI". Al añadir el **chat** de Soporte TI habrá dos entradas con el mismo nombre y
   distinto destino. **Decidido: se deja tal cual** (ver Decisiones cerradas, punto 4).

5. **La psicóloga no puede aprobar vacaciones ni permisos: bug, no diseño.** El frontend ya la
   trata como quien aprueba — `PsicologaLayout.jsx:51` lleva el comentario *"La psicóloga (jefa
   de RH) también aprueba permisos y vacaciones"* y monta las mismas pantallas de RH con los
   mismos manejadores. Lo que falta está en el servidor: `api/resolver.js:12` define
   `GESTION = ["admin","rh"]` y con eso cierra las ramas de vacaciones (línea 44) y permisos
   (línea 77), mientras `GESTION_AMPLIA = ["admin","rh","psicologa"]` sí la deja resolver
   comisiones (110) e intercambios (150). O sea: se le olvidó a alguien en dos ramas de cuatro.
   Detalle completo en la Fase 0.

---

## Fase 0 — La psicóloga no puede aprobar vacaciones ni permisos (bug en producción)

**Va primero: es el único punto de este plan que hoy le rompe el trabajo a alguien todos los
días, y el arreglo es de dos líneas.**

### Qué pasa exactamente

La psicóloga ve las solicitudes (la RLS de SELECT sí la incluye), puede **crear** vacaciones y
permisos (la de INSERT también, desde la mig. 079)… y al pulsar Aprobar recibe un 403 con el
mensaje **"Solo Recursos Humanos puede resolver una solicitud de vacaciones."** Puede agendar
una vacación pero no aprobar la de otra persona.

No es un problema de permisos de base de datos: aprobar pasa por `/api/resolver`, que actúa con
la clave de servicio y por tanto **se salta la RLS**. El único guardián real es esa lista de
roles del servidor.

### Arreglo

En `api/resolver.js`, las ramas `vacacion` (línea 44) y `permiso` (línea 77) pasan a usar la
lista que ya incluye a la psicóloga (`GESTION_AMPLIA`), quedando las cuatro ramas coherentes.
Y se corrigen los dos mensajes de 403, que dicen "Solo Recursos Humanos" cuando ya no es cierto
— un mensaje que miente cuesta más que el propio fallo, porque manda a buscar el problema a RH.

De paso, dos suciedades vecinas que se arreglan porque están en la misma línea de trabajo:
- El comentario de `vacacionesService.js:58` y `permisosService.js:66` dice que el envío va a
  `api/aprobar-vacacion.js` / `api/aprobar-permiso.js`. **Esos ficheros no existen**; el
  endpoint real es `/api/resolver`. Es lo que me hizo buscar en el sitio equivocado.
- Las políticas `vacaciones_update_rh` y `permisos_update_rh` solo permiten el rol `rh`, así
  que **ni admin ni psicóloga podrían actualizar por vía directa**. Hoy da igual porque nadie
  escribe por ahí (todo pasa por el servidor), y dejarlo estrecho es lo correcto por defensa en
  profundidad. **No se toca**, solo se anota aquí para que el nombre de la política no vuelva a
  hacer pensar que ahí estaba el bloqueo.

**Alcance:** 1 fichero de servidor (`api/resolver.js`) + 2 comentarios. Cero migraciones, cero
frontend. Se despliega con `/opt/pulse/build-api.sh`.

**Criterio de aceptación:** entrando como psicóloga, aprobar y rechazar una vacación y un
permiso funciona y le llega el push al empleado; un empleado o doctor **sigue recibiendo 403**
si intenta llamar al endpoint por su cuenta.

---

## Fase 1 — Reorganizar la navegación de empleado y doctor

Solo `src/config/navItems.js` (+ `GROUP_ICONS`). Cero lógica: la barra ya sabe pintar
cualquier agrupación.

De 2 grupos a 4, por *cuándo* se usa cada cosa y no por qué tipo de cosa es:

| Grupo nuevo | Ítems | Por qué juntos |
|---|---|---|
| **Asistencia** | Checador, Historial, Mi rostro | El día a día del reloj. "Mi rostro" vive aquí porque solo existe para que el checador te reconozca. |
| **Tiempo libre** | Vacaciones, Calendario | Lo que se pide por adelantado. |
| **Bienestar** | Mi Encuesta, Reconocimientos, Reporte Confidencial | Lo que mira la psicóloga. |
| **Ayuda** | Avisos, Soporte TI / Ideas de mejora | Dónde acudir cuando algo no va. |
| *(fuera de menú)* | Inicio, **Mensajes** | Enlaces directos. |
| *(solo doctor)* | **Comisiones** como enlace directo | Es lo que un doctor abre a diario; enterrarlo a dos clics es lo contrario de lo que se pide. |

Ningún grupo pasa de 3 ítems, contra los 9 de hoy.

**Criterio de aceptación:** los 5 roles siguen llegando a todas sus pantallas; ninguna ruta
huérfana; ningún grupo con más de 4 ítems en empleado/doctor.

---

## Fase 2 — Mensajes a la vista, en los 5 roles

- `navItems.js`: quitar `group` a `mensajes` en los 5 roles → se pinta como enlace directo.
- `HeaderNav.jsx`: **botón propio de Mensajes en `topnav-right`**, junto a la campana, con
  contador de no leídos. Visible a **cualquier ancho** — es lo único que cumple "a la vista"
  en móvil, dado el hallazgo 3.
- `App.css`: estilo del botón reutilizando `.topnav-icon-btn` y el badge de `.campana`.
- Admin y RH: hoy Mensajes existe en su menú pero la pantalla les dice "acceso restringido,
  este canal es privado" (`Mensajes.jsx:44`) y solo les deja *Reuniones*. **Decidido:** el
  botón se muestra igual en los 5 roles, pero para admin/RH abre directamente la pestaña
  Reuniones (`pestana = "reuniones"`), que es lo único que les sirve.

**Criterio de aceptación:** en 375 px de ancho y en escritorio, Mensajes se alcanza en 1 toque
desde cualquier pantalla, y el contador de no leídos coincide con la lista.

---

## Fase 3 — Aviso de actualización obligatorio

- Nuevo `src/components/actualizacion/ModalActualizacion.jsx`: overlay bloqueante, sin
  botón de cerrar ni cierre por clic fuera, un solo botón "Actualizar ahora" →
  `buscarActualizacion()` (que ya existe y hace update + resuscripción push + reload).
- `main.jsx`: el `controllerchange` deja de lanzar el toast y pasa a **marcar** que hay
  versión nueva (evento propio o bandera en `GlobalContext`).
- `App.jsx`: montar el modal junto a `AvisoModal` y `ForzarNotificaciones` — el punto que ya
  comparten los 5 roles.

⚠️ **La excepción del checador.** El comentario de `main.jsx:86` explica por qué hoy es un
toast: para no "cortarle a alguien una foto a medias". Un overlay obligatorio en mitad de una
checada deja al empleado sin poder marcar. **Decidido:** el modal **espera** mientras haya una
captura en curso y aparece en cuanto termina. Es la única concesión; en cualquier otra pantalla
bloquea de inmediato.

**Criterio de aceptación:** con dos versiones distintas desplegadas, la pestaña vieja muestra
el modal, no se puede seguir usando la app sin pulsar, y al pulsar queda en la versión nueva.
Una checada en curso no se pierde.

---

## Fase 4 — Canal de Soporte TI dentro de Mensajes

### 4.1 Migración 094 (`094_canal_soporte.sql`)

```
usuarios.soporte_ti  boolean not null default false     -- quién atiende, por persona
mensajes.canal       text not null default 'psicologa'  -- check in ('psicologa','soporte')
mensajes.para_id     -> deja de ser NOT NULL
                        + check (canal = 'soporte' or para_id is not null)
```
- Semilla: `soporte_ti = true` para `106cff6e…` (Erick) y `fff31b54…` (Alfredo).
- Bandera por persona y no por rol → hallazgo 1.
- Índice parcial para el buzón: `(canal, fecha) where canal = 'soporte'`.
- RLS `mensajes_select_participant` reescrita: lo de siempre **o**
  `canal='soporte' and (select soporte_ti from usuarios where id = auth.uid())`.
  Se mantiene el envoltorio `(select …)` de la mig. 028 (initplan) para no romper el plan de
  consulta.
- `mensajes_insert_as_sender`: permitir insertar con `canal='soporte'` y `para_id` nulo.

### 4.2 Adjuntos — la trampa conocida

Las políticas de `storage.objects` viven en el **esquema `storage`**, no en `public`. Es
exactamente lo que costó el primer fallo del corte del 27 de julio. `mensajes_obj_select_participante`
hay que extenderla para que Erick y Alfredo puedan abrir los adjuntos del canal de soporte, o
el chat funcionará y las capturas de pantalla no se abrirán, con un error que apunta al sitio
equivocado. **Va en la misma migración 094.**

### 4.3 Servidor — `api/enviar-mensaje.js`

- Aceptar `canal` en el cuerpo y validarlo.
- La guarda actual (`empleado` solo escribe a gestión) debe admitir el caso "sin destinatario,
  canal soporte".
- Push: hoy notifica a `paraId`. Para el canal de soporte hay que avisar a **los dos**
  encargados (consulta por `soporte_ti = true`), y la respuesta de cualquiera de ellos notifica
  al empleado.
- `RUTA_POR_ROL` (línea 18) tiene que llevar al buzón de soporte, no a `/empleado/mensajes`,
  cuando el destinatario es un encargado.

### 4.4 Interfaz — `Mensajes.jsx`

- Empleado/doctor: la lista de conversaciones pasa de 1 a **2** entradas — psicóloga y, debajo,
  **Soporte TI** (entrada sintética, sin persona detrás).
- Erick/Alfredo: con `soporte_ti = true` ven **el buzón**: la lista de conversaciones de soporte
  de toda la plantilla, igual que hoy la psicóloga ve la de empleados. Su cuenta sigue siendo
  de empleado, así que conservan su propio chat con la psicóloga: son vistas distintas en la
  misma pantalla.
- `veChat` (línea 44) pasa a mirar también la bandera, no solo el rol.
- En la respuesta se ve **quién** contestó ("Soporte TI · Erick"): para el empleado es un
  canal, pero saber que hay una persona detrás cambia cómo se escribe.
- Se reutiliza todo lo que ya funciona: adjuntos, audios, reacciones, respuestas, borrado,
  realtime, presencia y la retención de 90 días (mig. 092).

### 4.5 Retención

Verificar que `api/limpiar-adjuntos.js` (mig. 092) no dé por supuesto el 1 a 1; si filtra por
`para_id`, hay que incluir el canal de soporte o sus adjuntos no se purgarán nunca.

**Criterio de aceptación:** un empleado escribe a Soporte TI con captura adjunta; a Erick y a
Alfredo les llega push; cualquiera de los dos contesta y el empleado lo recibe; **ningún otro
empleado ve ese hilo** (probado con una tercera cuenta); los adjuntos se abren desde las dos
partes.

---

## Fase 5 — Auditoría móvil de todos los menús

**Bloqueada:** la extensión de Chrome no está conectada ("Browser extension is not connected").
En cuanto lo esté, recorrido a 375 px y 430 px de ancho por: panel de la hamburguesa (5 roles),
Inicio, Checador, Mensajes (con las 2 conversaciones), Avisos, Vacaciones, Calendario,
Reconocimientos, Reporte Confidencial, Mi rostro, Perfil, y el buzón de soporte.

Qué se busca: desbordes horizontales, objetivos de toque por debajo de 44 px, el panel móvil
con 4 grupos nuevos (que ahora será más largo: revisar el scroll dentro de
`max-height: calc(100dvh - 60px)`), y el nuevo botón de Mensajes compitiendo por sitio con la
campana y el avatar en 375 px.

Los arreglos salen de lo que se encuentre; se hacen en `styles/mobile-polish.css`, que es donde
ya vive lo responsive.

---

## Fase 6 — Verificación y despliegue

1. `npm run lint` y `npm run build` en la VPS antes de tocar nada servido.
2. Migración: `docker exec -i pulse-db psql -U postgres < 094_canal_soporte.sql`, con respaldo
   fresco antes (`/opt/pulse/backup.sh`).
3. API: `/opt/pulse/build-api.sh`. Frontend: **`/opt/pulse/build-frontend.sh`** — nunca
   `docker build` a mano; el script fija la URL pública y aborta si el bundle sale con la
   interna (fallo real del 27 de julio).
4. Sincronizar `DESIGN.md` en el mismo cambio si se toca color/espaciado/componentes.
5. Commit en `/opt/pulse/app`.

Ventana: fuera de horario de clínica (abren 10:00). El bundle nuevo corta ~750 ms.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La RLS del canal de soporte filtra hilos a quien no debe | Probar con una tercera cuenta de empleado antes de dar por bueno. Es el criterio de aceptación, no un extra. |
| Las políticas de `storage` se olvidan otra vez | Van en la misma migración 094, no "después". |
| El modal obligatorio interrumpe una checada | Excepción de la Fase 3 + prueba explícita. |
| Reordenar la navegación desorienta a los ~100 empleados | Los rótulos no cambian, solo su agrupación. Conviene un aviso (`Avisos`) el día del cambio. |
| `App.css` tiene ~11.000 líneas | No refactorizar aquí: añadir en el bloque del topnav y en `mobile-polish.css`. |

## Fuera de alcance

Rediseñar Mensajes, tocar el checador, migrar a Tailwind (`DESIGN.md` §"Estado de la
migración"), y el endurecimiento de permisos de los dumps que quedó pendiente aparte.

---

## Decisiones cerradas (2026-07-29)

1. **Grupos de la Fase 1**: como está propuesto arriba — Asistencia / Tiempo libre / Bienestar
   / Ayuda, y Comisiones como enlace directo para doctor.
2. **Modal de actualización durante una checada**: **espera** a que termine la captura y
   aparece justo después. En cualquier otra pantalla bloquea en el acto.
3. **Botón de Mensajes para admin y RH**: se muestra en los 5 roles, pero para admin/RH abre
   directamente la pestaña **Reuniones** (lo único que les sirve). No se toca el aviso de
   "acceso restringido" del chat.
4. **Página vieja `soporte`**: se **deja tal cual**, con su rótulo actual ("Soporte TI" para
   empleado/doctor, "Ideas de mejora" para gestión). Decisión consciente del dueño del
   producto: convivirán el ítem de menú (formulario de ideas) y la conversación de Soporte TI
   dentro de Mensajes. Consecuencia asumida: en empleado/doctor hay dos entradas con el mismo
   nombre y distinto destino. Si más adelante genera dudas de la plantilla, el cambio es un
   rótulo en `navItems.js` — un minuto de trabajo.
