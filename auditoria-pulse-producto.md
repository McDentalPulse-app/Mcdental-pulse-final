# Auditoría: Pulse como producto para venta

> **Fecha:** 2026-08-08 · **Alcance:** repo `Mcdental-pulse-final-main`, rama `vps-docker` (migración 112).
> Producción en la VPS va en la 119 — la diferencia está anotada como hallazgo, no ignorada.
> **Decisión previa del jefe de proyecto:** forkear un Pulse nuevo para venta y dejar el actual
> para McDental. Mercado objetivo: cualquier empresa, con foco en empresas grandes.

---

## 1. Veredicto

**Forkear es la decisión correcta, y los números lo respaldan con más fuerza de la que
esperaba.** Adaptar el Pulse actual habría exigido tocar **~740 lugares** donde el sistema da
por hecho el organigrama de McDental, más de la mitad dentro de las políticas de seguridad de
la base de datos. Eso no es refactor: es reescribir el sistema con la casa habitada.

**Y eso importa porque** el fork no arranca de cero. Hay ~39,000 líneas escritas y el reparto
es muy favorable: **cerca del 45% se salva casi tal cual** (reconocimiento facial, reglas de
asistencia, geocercas, zonas horarias), **un 30% se adapta** y **un 25% se tira** — y lo que se
tira es justamente lo que hoy impide vender. La higiene del código es buena (ningún archivo
pasa de 800 líneas), así que el material rescatable está en buen estado.

**El riesgo real no es técnico, es de secuencia:** si el Pulse nuevo se arma copiando el viejo
"y luego le metemos multiempresa", se repite exactamente el problema que hoy los obliga a
forkear. Hay tres decisiones que cuestan casi nada el primer día y son carísimas después.

---

## 2. Los cuatro bloqueadores duros

Esto es lo que hace imposible personalizar el Pulse actual. No son defectos: son decisiones
razonables para un sistema interno que se vuelven muros al vender.

### 2.1 El rol es un tipo de dato de PostgreSQL

```sql
create type public.rol_usuario as enum ('admin','rh','psicologa','empleado');
alter type public.rol_usuario add value if not exists 'doctor';   -- migración 072
```

Los roles no son datos: son parte del esquema. Un cliente que quiera "supervisor de turno" o
"jefe de almacén" necesita una **migración de base de datos**, y PostgreSQL no permite quitar
valores de un enum. Cada cliente deforma permanentemente el esquema de todos.

| Dónde vive el organigrama de McDental | Cantidad |
|---|---|
| Literales de rol en el SQL de migraciones | **572** |
| Líneas de política (RLS) que nombran un rol concreto | **269** |
| Literales de rol en el frontend (`.jsx` / `.js`) | **168** |
| **Total de puntos a tocar** | **~740** |

Desglose por rol en el frontend: `psicologa` 43 · `rh` 38 · `empleado` 35 · `admin` 30 ·
`doctor` 22.

**El rol `psicologa` es el ejemplo perfecto del problema.** Es la prestación interna de
McDental, y hoy está cableada en 43 puntos del frontend y 131 del SQL. Ninguna empresa a la que
le vendan la va a querer, y quitarla no es borrar un menú: es desarmar permisos en 174 lugares.

### 2.2 Nada en la base de datos sabe qué empresa es

Las ~36 tablas tienen `sucursal_id`, pero **ninguna tiene empresa**. Y la tabla de
configuración lleva el candado escrito a propósito:

```sql
create table if not exists public.ajustes (
  id boolean primary key default true check (id),  -- fuerza una única fila
  ...
```

Es la definición literal de "un solo cliente", puesta a conciencia.

### 2.3 El frontend carga la empresa entera en memoria

Este es el hallazgo más serio para "empresas mucho más grandes". Existe un helper llamado
`fetchAll` que **anula deliberadamente** el tope de 1,000 filas de Supabase:

```js
// fetchAll pagina con .range() hasta agotar la tabla, así que devuelve el dataset completo
```

Se usa en **21 de los 30 servicios** (24 llamadas). Y en el arranque de sesión
(`GlobalContext.jsx`) se disparan **~18 de esas cargas en paralelo**: usuarios, mensajes,
encuestas, reconocimientos, vacaciones, permisos, descuentos, comisiones, notas psicológicas,
expedientes, horarios, festivos, calendario, intercambios…

En todo el código hay **3 usos de `.range()` y 2 de `.limit()`** propios. Prácticamente nada
está paginado.

Con 150 empleados esto funciona y fue la decisión correcta (evita promedios calculados sobre
datos truncados en silencio — el comentario del código lo explica bien). Con 5,000 empleados,
un administrador que inicia sesión intenta descargar la empresa completa al navegador. **No es
un problema de optimización: es el modelo de datos del frontend.**

### 2.4 No hay ambiente de pruebas ni migraciones automatizadas

- Este repo va en la migración **112**; producción va en la **119**. Se edita directo en el
  Docker de la VPS.
- En `infra/` y `scripts/` **no hay nada que aplique migraciones al desplegar**. Se aplican a
  mano.
- No existe staging. El ambiente de desarrollo apunta a un Supabase local, producción es la VPS.

Con un cliente interno se aguanta. Con clientes que pagan y contrato de por medio, cada
actualización es una apuesta.

---

## 3. Qué se salva, qué se adapta, qué se tira

| | Componente | Líneas aprox. | Por qué |
|---|---|---|---|
| ✅ **Se salva** | Reconocimiento facial y anti-spoofing (`api/_rostro.js`, `_pose.js`, `Calibracion`, `utils/rostro`) | ~1,500 | Es el activo real. Meses de calibración con caras reales; rehacerlo desde cero es lo más caro del proyecto |
| ✅ | Reglas de asistencia (`utils/asistencia.js` 684 líneas + emparejado de checadas) | ~1,200 | Conocimiento de negocio ganado a golpes: retardos, salidas autorizadas, día natural |
| ✅ | Geocercas y zona horaria por sucursal | ~600 | Ya resuelto el caso difícil (horario de verano por estado). Sirve igual para cualquier empresa |
| ✅ | PWA, notificaciones push, respaldos, monitoreo de disco | ~1,200 | Plomería sólida y agnóstica del negocio |
| ✅ | Utilidades y helpers probados (26 archivos de test) | ~2,000 | Fechas, exportación a Excel, validaciones |
| 🔧 **Se adapta** | Componentes de UI y layouts | ~4,000 | Buena base visual (`DESIGN.md` existe); hay que quitarle 108 referencias a "McDental" |
| 🔧 | Empleados, expediente, avisos, calendario, vacaciones/permisos | ~6,000 | El dominio es genérico; lo específico son los permisos cableados |
| 🔧 | Encuestas y clima laboral | ~2,000 | Vendible como módulo, pero hoy asume las preguntas de McDental |
| ❌ **Se tira** | `GlobalContext` + los 30 servicios con `fetchAll` | ~4,000 | El modelo "cargar todo" no escala. Se rehace con paginación y consultas acotadas |
| ❌ | El enum de roles + las 269 líneas de política con rol duro | 112 migraciones | Se rehace como permisos configurables |
| 🔧 **Módulo vendible** | Comisiones (`comisiones/` + servicio) | ~800 | Se queda como módulo de pago. Sirve a cualquier empresa con vendedores a comisión, no solo a dentistas |
| 🔧 **Módulo vendible** | Bienestar laboral (ex psicóloga: notas, seguimiento, confidenciales) | ~1,200 | Ver § 5.7 — con la NOM-035 encima, esto puede ser el módulo más vendible del catálogo |
| ❌ | Jitsi autohospedado | ~600 | La videollamada se queda como módulo, pero levantar un stack de Jitsi por cliente es insostenible. Se cambia por integración externa |

**Aprovechamiento estimado: 48% se salva, 34% se adapta, 18% se rehace.**
La decisión de conservar todos los módulos (§ 5) sube el aprovechamiento y baja lo que se tira.

---

## 4. La decisión de arquitectura (revisada)

En la primera conversación recomendé **una instancia por cliente**. Con la información nueva
—"cualquier empresa" y "empresas mucho más grandes"— refino la recomendación:

> **Diseñar el esquema con `empresa_id` desde el primer día, pero desplegar una instancia por
> cliente al principio.**

El motivo es exactamente lo que esta auditoría acaba de medir: **en un proyecto nuevo,
agregar `empresa_id` a las tablas cuesta casi nada; agregarlo después cuesta 269 políticas.**
Ustedes están viviendo la demostración ahora mismo.

Así obtienen las dos cosas:

- **Hoy:** aislamiento físico por cliente. Si una política sale mal, el daño se queda dentro de
  un cliente. Es lo que ya saben operar (Docker en VPS), y a las empresas grandes les gusta
  (aislamiento de datos, cumplimiento).
- **Mañana:** cuando quieran un plan más barato para empresas chicas y sirvan 50 clientes en una
  sola instancia, **ya está el esquema listo**. No hay segunda reescritura.

El precio a pagar: **actualizar N clientes tiene que ser un comando, no una tarde.** Eso hay
que construirlo antes del segundo cliente.

---

## 5. Módulos y licencias: el modelo Admin+

**Decisión del jefe de proyecto (2026-08-08):** se conservan **todos** los módulos, y un
**Admin+** los enciende o apaga por cliente según lo que haya pagado.

Es la decisión correcta —convierte lo específico de McDental en catálogo vendible en vez de
código muerto— pero introduce un plano nuevo en el sistema, y ahí están los errores caros.

### 5.1 Tres planos, no dos

| Plano | Quién | Qué puede hacer |
|---|---|---|
| **Proveedor** | Admin+ (ustedes) | Da de alta empresas, enciende/apaga módulos, fija límites y vigencias |
| **Cliente** | Admin del cliente | Manda dentro de su empresa. **No puede encender lo que no pagó** |
| **Usuario** | Empleado, supervisor, etc. | Lo que su rol permita, dentro de los módulos activos |

> **La regla que sostiene el modelo de negocio:** el admin del cliente puede **leer** qué
> módulos tiene, **nunca escribirlos**. Si esa tabla es escribible desde el plano del cliente,
> no hay licencia que valga.

### 5.2 Un módulo es un paquete de permisos (no un interruptor de menú)

Aquí se unen las dos cosas que veníamos tratando por separado. Si un módulo es solo un
`activo: true/false` que esconde un menú, van a terminar con dos mecanismos peleados: roles por
un lado, módulos por otro, y casos imposibles de razonar («el rol tiene el permiso pero el
módulo está apagado»).

La forma limpia: **cada módulo aporta sus permisos al catálogo**. Apagar el módulo retira esos
permisos del catálogo, y por lo tanto de todos los roles que los tuvieran, automáticamente. Un
solo mecanismo.

```
modulos            (clave, nombre, descripcion)
modulo_permisos    (modulo_clave, permiso_clave)        -- catálogo del producto
empresa_modulos    (empresa_id, modulo_clave, activo, vigencia_hasta, limite)
roles              (empresa_id, clave, nombre)          -- los define el cliente
rol_permisos       (rol_id, permiso_clave)              -- válido solo si el módulo está activo
```

`empresa_modulos` la escribe **únicamente** el plano proveedor. El cliente tiene SELECT y nada
más.

### 5.3 Dónde se aplica la licencia (tres capas, solo una cuenta)

1. **Base de datos — la que cuenta.** Una función `modulo_activo('comisiones')` usada en cada
   política, exactamente el mismo patrón que ya usan con `current_role()`. Si el módulo está
   apagado, la fila no existe para ese cliente. Punto.
2. **API.** Guarda en los endpoints, para dar un 403 claro en vez de una lista vacía confusa.
3. **Interfaz.** Esconder el menú. **Esto es cosmético.**

> **Esconder un menú no es una licencia.** Con las herramientas del navegador se llama la API
> directo. Si la licencia solo vive en el frontend, el primer cliente técnico consume gratis
> todo el catálogo. Va en la base de datos o no va.

### 5.4 Vender no es solo encender módulos

Casi siempre el plan también trae topes. Conviene diseñarlos desde el primer día, por la misma
razón que `empresa_id`: número de empleados, número de sucursales, almacenamiento de fotos y
adjuntos, meses de retención de historial. Una tabla de límites hoy no cuesta nada; meterla
cuando ya hay 20 clientes cuesta otra migración con la casa habitada.

### 5.5 El riesgo nuevo: Admin+ es la cuenta más peligrosa que van a tener

Una cuenta que alcanza a **todos** los clientes. Si se compromete, no se filtra una empresa: se
filtran todas — nóminas, expedientes y notas confidenciales incluidas.

Requisitos mínimos, no negociables:

- Autenticación **separada** de la de los clientes, con segundo factor obligatorio.
- **Sin acceso a los datos del cliente por defecto.** Admin+ administra licencias, no lee
  expedientes. El acceso a datos, si alguna vez hace falta para soporte, es temporal, pedido
  con motivo y registrado.
- Bitácora de todo lo que toca, inalterable.

El pentest del 2026-08-07 mostró que RH podía fabricar admins dentro de una empresa. Admin+ es
esa misma clase de falla, multiplicada por el número de clientes.

### 5.6 Qué pasa cuando un cliente deja de pagar un módulo

Los datos no desaparecen al apagar el interruptor, y algunos son sensibles (expedientes, notas
psicológicas). Hay que decidirlo antes de vender, no después:

**Recomendación:** al vencer, el módulo pasa a **solo lectura con periodo de gracia** (30–60
días) y exportación disponible; al terminar la gracia, se oculta pero no se borra. El borrado
definitivo se hace solo a petición escrita del cliente. Es lo que evita a la vez perder datos
de alguien que se atrasó un mes y quedarse guardando expedientes ajenos para siempre.

### 5.7 Un módulo que subestimamos: bienestar laboral

El módulo de la psicóloga —notas, seguimiento, reportes confidenciales— más el de encuestas de
clima parecían lo más específico de McDental. Con el modelo de catálogo, puede ser lo
contrario: en México la **NOM-035-STPS** obliga a los patrones a identificar y evaluar factores
de riesgo psicosocial, y a documentarlo. Eso es exactamente lo que estos dos módulos ya hacen.

Vale la pena confirmar el alcance exacto con un especialista en la norma antes de ponerlo en el
material de venta, pero si cuadra, **el módulo más raro del sistema se convierte en el argumento
de venta para empresas grandes**, que son justo las que tienen la obligación y la auditoría
encima.

---

## 6. Los tres cimientos que no se pueden posponer

Si el Pulse nuevo arranca sin estas tres cosas, se repite el bloqueo actual.

1. **`empresa_id` en todas las tablas, desde la primera migración.** Aunque al principio siempre
   valga lo mismo.
2. **Permisos como datos, no como código.** Tabla de roles + tabla de permisos por rol. En el
   código se pregunta `puede('ver_notas_medicas')`, nunca `rol === 'psicologa'`. Esto es lo que
   convierte "personalizable" en configuración de pantalla en vez de un fork.
3. **Todo listado paginado desde el primer día.** Nada de traer tablas completas. Los cálculos
   agregados (promedios, semáforos, Pulse Score) se hacen **en la base de datos**, no en el
   navegador — que es el problema real que `fetchAll` estaba resolviendo.
4. **Módulos como paquetes de permisos** (§ 5.2), con la licencia aplicada en la base de datos.
   Ya son cuatro cimientos: la decisión de vender por módulos añadió uno.

Añadir cualquiera de los cuatro después cuesta entre 10 y 50 veces más. Es la lección literal
de esta auditoría.

---

## 7. Seguridad y operación: los huecos de "era interno"

| Hueco | Estado hoy | Qué exige un producto vendido |
|---|---|---|
| Contraseña temporal `emp123`/`admin123` | Intencional y con cambio forzado | Invitación por correo con enlace de un solo uso |
| Anti-spoofing | Mide pero **no bloquea** (1 de 5 caras reales cae bajo el umbral) | Umbral por cliente + revisión manual; si se vende como control de asistencia, tiene que bloquear |
| Escalada de privilegios RH → admin | **Cerrado** (migración 119 + límite en nginx, 2026-08-07) | En el nuevo no debe poder existir: permisos como datos lo previenen por diseño |
| Pruebas de permisos | **Cero.** 26 archivos de test, todos de utilidades | Vendiendo el sistema, los permisos *son* el producto. Necesita pruebas por rol |
| Cobertura general | ~11% (26 de 229 archivos) | Para contratos con SLA: mínimo el núcleo de asistencia y permisos |
| Ambiente de pruebas | No existe | Staging obligatorio antes del primer cliente |
| Migraciones | A mano en la VPS | Automáticas al desplegar |
| Bitácora de auditoría | Parcial (geocercas sí) | Quién hizo qué y cuándo, en todo. Las empresas grandes lo piden |
| Bundle del frontend | opencv-js + mediapipe + exceljs + tiptap + jscanify, todo junto | Carga diferida por módulo; hoy el checador descarga el editor de texto |

---

## 8. Plan por fases

Estimaciones en **semanas-persona**, con rango porque no sé el tamaño del equipo. Suponen que
se reutiliza el código marcado como "se salva".

| Fase | Qué incluye | Esfuerzo |
|---|---|---|
| **0. Definición** | Qué es núcleo y qué es módulo. Catálogo de permisos. Modelo de datos con `empresa_id` | 2–3 |
| **1. Cimientos** | Esquema nuevo, permisos como datos, licencias por módulo aplicadas en la base, autenticación, configuración por empresa (nombre, logo, colores, vocabulario) | 5–7 |
| **2. Núcleo vendible** | Empleados, asistencia con checador, horarios, sucursales, vacaciones y permisos, avisos. Aquí entra el código rescatado | 6–8 |
| **3. Reconocimiento facial** | Portar el motor actual con umbral configurable por cliente | 2–3 |
| **4. Catálogo de módulos** | Portar los módulos al modelo de paquete de permisos: encuestas, reconocimientos, expediente, calendario, comisiones, bienestar, videollamada | 6–9 |
| **5. Consola Admin+** | Alta de empresas, encender/apagar módulos, límites, vigencias, vencimiento con gracia y exportación | 3–4 |
| **6. Industrialización** | Staging, migraciones automáticas, despliegue de N clientes por comando, respaldos por cliente, monitoreo | 3–4 |
| **7. Endurecimiento** | Pruebas por rol **y por módulo apagado**, pentest, bitácora, 2FA de Admin+, invitaciones por correo | 4–5 |
| | **Total** | **31–43 semanas-persona** |

Con dos personas de tiempo completo: **entre 4 y 5 meses** a un primer cliente vendible con el
núcleo (fases 0–3, 5 y 6), y el catálogo completo en paralelo a las primeras ventas.

### 8.1 El plazo de 3 meses

**El jefe de proyecto fijó 3 meses.** Es firme, así que hay que decir con claridad qué cabe.

3 meses ≈ 13 semanas:

| Equipo | Capacidad | ¿Cabe en 31–43 semanas-persona? |
|---|---|---|
| 2 personas | 26 semanas-persona | **No.** Faltan entre 5 y 17 |
| 3 personas | 39 semanas-persona | **Sí**, en la parte alta del rango |
| 4 personas | 52 semanas-persona | Sí, con holgura |

**Hay dos formas de cumplir el plazo, y solo dos:**

- **Opción A — tres personas, alcance completo.** Es la opción limpia si hay presupuesto.
- **Opción B — dos personas, primera venta acotada.** Sale núcleo + checador + dos o tres
  módulos, elegidos según lo que pida el primer cliente. El resto del catálogo se construye
  después, ya vendiendo.

Lo que **no** funciona es recortar calidad para meter el alcance completo con dos personas.
En particular, los cuatro cimientos (§ 6) no se recortan en ninguna de las dos opciones:
recortarlos es exactamente lo que obliga a la segunda reescritura, que es de lo que este
proyecto nació.

**Sin descuentos por la UI.** Una versión anterior de esta sección decía que las fundaciones de
interfaz «ya estaban al 80%» y descontaba 1–2 semanas. La medición lo desmiente: de 2,087
`className` en el JSX, solo 65 (3%) usan utilidades de Tailwind — el 97% del estilo son clases
CSS a mano sobre 15,569 líneas. Tailwind está instalado pero la aplicación no lo usa, así que
**la capa visual del producto nuevo se escribe entera**. Lo que sí ahorra tiempo es que el
equipo ya conoce el stack (React 19, Vite, Tailwind v4, Recharts), no que haya código de UI
reutilizable. Ese descuento no existe y el plazo queda tal cual.

El salto respecto al estimado anterior (24–34) es el precio de vender por módulos: la consola
Admin+, las licencias aplicadas en la base de datos y las pruebas de «módulo apagado» no
existían en el plan de un producto de precio único. Es dinero bien gastado —es lo que permite
cobrarle distinto a cada cliente— pero conviene que el jefe lo vea explícito.

**Advertencia sobre el estimado:** el rango supone que el equipo conoce el código actual, que es
el caso. Si se subcontrata, súmenle 30–40% por la curva de aprendizaje del motor facial, que es
la parte más delicada.

---

## 9. Decisiones que necesito del jefe de proyecto

**Resueltas el 2026-08-08:** se conservan todos los módulos y Admin+ los activa por cliente
(§ 5). Comisiones se queda como módulo de pago. El plazo es de 3 meses, firme.

**La más urgente, por el plazo (§ 8.1): ¿opción A (tres personas, alcance completo) u opción B
(dos personas, primera venta acotada)?** Hay que decidirlo antes de la semana 1, porque cambia
qué se construye primero.

Y quedan estas:

1. **¿Admin+ puede ver los datos de los clientes, o solo administrar licencias?**
   Mi recomendación es **solo licencias**, con acceso a datos temporal, justificado y
   registrado. Es la diferencia entre que una cuenta comprometida cueste un susto o cueste
   todos los clientes a la vez.
2. **¿Qué pasa al vencer un módulo con datos dentro?** Recomiendo solo lectura con 30–60 días
   de gracia y exportación; ocultar después, nunca borrar sin petición escrita. Tiene
   implicación legal por expedientes y notas de bienestar.
3. **¿Se venden también límites (empleados, sucursales, almacenamiento) o solo módulos?**
   Si la respuesta es sí —lo normal— la tabla de límites entra en la fase 1, no después.
4. **¿El checador facial es el producto o una función más?** Si es el gancho de venta, la fase 3
   sube de prioridad y el anti-spoofing tiene que bloquear de verdad. Si es opcional, se puede
   vender antes con checada por geocerca.
5. **¿Se vende instalado en la infraestructura del cliente, o lo hospedan ustedes?** Cambia
   completamente la fase 6 y el modelo de precio. Las empresas grandes suelen pedir lo primero.
6. **¿Qué pasa con el Pulse de McDental?** Si va a seguir recibiendo funciones nuevas, hay que
   decidir desde ya si se le portan del nuevo o se congela. Mantener dos productos vivos con el
   mismo equipo es el riesgo silencioso de esta estrategia.

---

## Anexo: números de referencia

| Métrica | Valor |
|---|---|
| Líneas de código (src + api) | ~39,100 |
| Archivos de código | 229 (227 en `src`, 28 en `api`) |
| Archivos > 800 líneas | **0** (higiene buena) |
| Archivo más grande | `AIEngine.jsx`, 757 líneas |
| Migraciones | 112 en repo · **119 en producción** |
| Tablas | ~36, todas con RLS activo |
| Políticas RLS | 218 |
| Índices declarados | 48 |
| Servicios que traen tablas completas | 21 de 30 |
| Usos de paginación propia | 3 `.range()` · 2 `.limit()` |
| Posibles N+1 (await en bucle) | 14 |
| Referencias a "McDental" | 108 en 30 archivos |
| Endpoints de API | 26 |
| Archivos de prueba | 26 (~11% de cobertura de archivos) |
| Pruebas de permisos/RLS | **0** |
