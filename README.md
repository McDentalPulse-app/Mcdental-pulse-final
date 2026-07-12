# McDental Pulse

Plataforma interna de **bienestar organizacional** para McDental. Gestiona encuestas
semanales (Pulse Score), expedientes, permisos/descuentos/reconocimientos de RH,
reportes confidenciales clínicos y un motor de IA. PWA en español, cuatro roles:
**admin · rh · psicóloga · empleado**.

## Stack

- **Frontend:** React 19 + Vite + React Router 7 (PWA con `vite-plugin-pwa`)
- **Datos:** Supabase (Postgres + Row Level Security) · Supabase Auth · Supabase Storage para archivos de expediente
- **IA:** Google Gemini (`gemini-2.5-flash`) vía proxy serverless (la key vive en el servidor)
- **Iconos:** lucide-react · estilos en `src/index.css` (tokens) y `src/App.css`

## Puesta en marcha

```bash
npm install
npm run dev      # desarrollo (Vite). Para probar /api/gemini en local usa `vercel dev`
npm run build    # build de producción
```

### Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

| Variable | Dónde | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | cliente | Config pública del SDK de Supabase (no son secretos; la seguridad la da RLS) |
| `GEMINI_API_KEY` | **servidor** | Key de Gemini. Sin prefijo `VITE_` → no entra al bundle. La consume `api/gemini.js`. En producción se configura en Vercel → Environment Variables |
| `MCTIC_API_URL` | **servidor** | URL de MCTIC (sistema de tickets de TI), p. ej. `https://mctic.vercel.app`. La consume `api/soporte-ticket.js` |
| `MCTIC_INTEGRATION_KEY` | **servidor** | Clave de servicio de MCTIC. **Debe ser idéntica** a la que tiene MCTIC en su propio entorno, o rechazará los tickets con 401 |

> ⚠️ La IA se llama a través del proxy `api/gemini.js`. Nunca pongas la key de Gemini con prefijo `VITE_` (quedaría expuesta en el bundle del navegador).

## Estructura

```
api/gemini.js            Proxy serverless de Gemini (key server-side)
api/soporte-ticket.js    Proxy serverless a MCTIC: alta (POST) y consulta (GET) de tickets
                         de TI. Valida el JWT de Supabase; la clave de integración vive
                         en el servidor y nunca llega al navegador
supabase/
  migrations/            Schema SQL + RLS policies + Storage policies
  functions/             Edge Functions (admin-create-usuario, admin-reset-password)
src/
  components/            UI por rol (admin, rh, psicologia, empleados, ia, layout, common…)
  contexts/              Auth, Global, Notification, Theme
  services/supabase/     Acceso a datos (una función por operación)
  utils/                 pulseScore, constants (semanas), helpers, analysisEngine…
  config/                supabase, theme, constants
```

## Despliegue

- **Producción:** `McDentalPulse-app/Mcdental-pulse-final` (remoto `prod`, rama `main`)
- **Backup:** `MCDentalSist/MCDentalPulseBackUp` (remoto `origin`, rama `main`)

> La rama viva de producción es **`main`**. La rama `develop` de `prod` quedó obsoleta
> (varios commits atrás) y no se usa para desplegar.

---

## Changelog

### 2026-07-12 · Auditoría: endurecimiento de seguridad, datos y calidad

#### 🔒 Seguridad
- **El dataset legacy de usuarios sale del código y del bundle.** `src/data/initialData.js`
  conservaba el roster que sirvió de origen para la migración a Supabase. Ya no lo consumía
  nadie —la fuente de verdad es `public.usuarios`—, pero **no se eliminaba por tree-shaking**:
  Rollup no puede descartar un export cuyo valor sale de una llamada a función
  (`USERS_RAW.map(applyCanonicalAdminDates)`), así que acababa incluido en el JavaScript de
  producción. Se elimina el dataset y se conserva solo lo que `GlobalContext` importa de verdad.
- **Las tres Edge Functions de administración validan el rol del objetivo, no solo el del
  llamador.** Las migraciones 023/025 restringen los cambios de rol con un trigger
  `BEFORE UPDATE`, pero las Edge Functions usan `service_role` (que no pasa por RLS) y el
  trigger no cubre `INSERT`. `admin-create-usuario`, `admin-reset-password` y
  `admin-update-username` autorizaban con `["admin","rh"]` y después actuaban sobre el usuario
  objetivo sin volver a comprobar su rol. Ahora las tres exigen ser `admin` para asignar un rol
  privilegiado o para actuar sobre otro `admin`. La operativa de RH sobre el resto de usuarios
  no cambia.

#### 🐛 Corregido
- **Una encuesta sin score se contaba como un 0.** El guard que decidía si un score era válido
  estaba replicado a mano en **29 sitios**: `Number.isFinite(Number(e.score))`. Pero
  `Number(null) === 0`, así que una encuesta sin score no se descartaba: entraba como un cero
  real, con el semáforo y la prioridad de riesgo que eso implica. Las 29 copias se sustituyen
  por un único predicado, `tieneScoreValido()`, que acepta el `0` (una respuesta real) y
  descarta `null` / `""`. **En producción no había ninguna fila afectada** (36 encuestas,
  ninguna con score nulo): ningún dato de los dashboards cambia.
- **Se cierra el origen del score nulo.** Si la encuesta se quedaba sin ninguna pregunta de tipo
  escala, el cálculo dividía entre cero (`Math.round((0 / 0) * 100)` es `NaN`) y `NaN` se
  serializa a JSON **como `null`**. La fórmula se extrae a `calcularScoreEncuesta()`, ahora una
  función pura y testeada que falla de forma explícita en vez de devolver `NaN`.
- **Las aprobaciones ya no se contradicen con la base.** Vacaciones, permisos, descuentos y
  mensajes leídos pintaban el cambio en la UI **antes** de escribir, y si la escritura fallaba
  solo mostraban un aviso: nunca revertían. La pantalla se quedaba en «Aprobado» mientras la
  base seguía en «pendiente», hasta recargar. Las cuatro acciones revierten ahora al estado
  previo.

#### ⚡ Datos y rendimiento
- **Se elimina el riesgo de truncado silencioso.** Ninguna lectura tenía `.limit()` ni
  `.range()`. PostgREST corta las respuestas en `max-rows` (1000 por defecto) **sin dar error**:
  al superar esa cifra, los dashboards habrían calculado promedios y participación sobre datos
  incompletos sin que nadie lo notara. El nuevo helper `fetchAll()` pagina hasta agotar la
  tabla, con la misma semántica de antes. *(Hoy hay 36 encuestas: es prevención.)*
- **RLS se evaluaba una vez por fila.** Las policies llamaban a `current_role()` directamente y
  Postgres la re-ejecutaba por cada fila escaneada. Envolverla en `(select ...)` permite al
  planner promoverla a InitPlan: una sola evaluación por consulta.

#### 🗄️ Base de datos (ya aplicadas en producción)
- **Migración 028** — Recrea las 40 policies afectadas con el subselect de InitPlan. Misma
  lógica, mismos nombres, **mismos permisos**: solo cambia la forma de la expresión.
- **Migración 029** — `encuestas.score` pasa a `NOT NULL` + `CHECK (0..100)` y `semaforo` queda
  acotado a `verde` / `amarillo` / `rojo`. Una encuesta sin score válido deja de ser posible
  **por construcción**, no solo por código.
- El historial de migraciones iba por la **025** aunque los archivos llegaban a la **027**: las
  026 y 027 se habían aplicado a mano, fuera de `db push`, y nunca se registraron. Se verificó
  que sí estaban en la base y se registraron las cuatro (026–029).

#### 🧪 Tests y CI
- **De 0 a 95 tests.** Se añade `vitest` con cobertura sobre `pulseScore`, `aiRiskEngine` y
  `encuestaDetail` — las funciones puras que sostienen el Pulse Score y la detección de riesgo.
  **Fueron estos tests los que destaparon el bug del score nulo**; no se buscaba.
- **CI** (`.github/workflows/ci.yml`): `lint → test → build`. El paso de lint queda **no
  bloqueante** a propósito: el repo arrastra 101 errores de lint anteriores a este trabajo
  (estos cambios no añaden ninguno), y ponerlo en bloqueante dejaría CI en rojo permanente.
  Conviene activarlo cuando esa deuda esté saldada.

#### 🔒 Seguridad (segunda tanda)
- **Las Edge Functions llevaban 10 días sin desplegar.** Los arreglos de las funciones de
  administración estaban en el repo, pero las versiones **desplegadas** eran del 2026-07-02: el
  código estaba corregido y el fallo seguía vivo en producción. Las Edge Functions **no se
  despliegan con Vercel** — viven en Supabase y necesitan su propio `supabase functions deploy`.
  Ya están desplegadas y verificadas contra el bundle que corre en producción.
  *(Es la misma trampa que documenta la entrada del 2026-07-11 sobre los tickets. Merece una
  comprobación fija: después de tocar `supabase/functions/`, mirar la fecha de despliegue real.)*
- **El receptor de un mensaje podía reescribir lo que le mandaron.** La policy se llamaba
  `mensajes_update_mark_read`, pero RLS es *row*-level, no *column*-level: concedía `UPDATE` de la
  **fila entera**. El receptor podía cambiar el `texto` del mensaje, o el `de_id` para atribuírselo
  a otra persona. La **migración 032** añade un trigger que acota el cambio al flag de leído —
  mismo patrón que ya protegía `public.usuarios`.
- **CORS acotado** en las Edge Functions (antes `*`), configurable con el secreto `ALLOWED_ORIGINS`
  sin tocar código. Y `admin-create-usuario` **valida el username**: un valor de solo caracteres
  inválidos se saneaba hasta quedar en nada y creaba una cuenta inutilizable.

#### 🐛 Corregido
- **El prompt que se le mandaba a la IA decía `emocional=undefined`.** Tercera aparición del mismo
  malentendido sobre el jsonb `respuestas`: se leía con las claves del dataset legacy
  (`respuestas.emocional`, `.estres`, `.motivacion`) sobre un objeto indexado por el id de la
  pregunta. **La IA llevaba meses analizando el bienestar de la plantilla sin ver ni una sola de sus
  respuestas de escala** — solo el score agregado. Todas las lecturas pasan ahora por los helpers de
  `encuestaDetail.js`, que localizan la pregunta por su tipo y leen por su id.

#### 🧹 Dependencias
- **Fuera `firebase-admin` y el script de migración de Firestore**, que ya cumplió su función. Era
  el origen de las 6 vulnerabilidades `moderate` que reportaba `npm audit`. **Ahora: 0.**

### 2026-07-11 · Soporte TI para todos los roles, con estado del ticket

#### ✨ Añadido
- **Todos los roles pueden abrir un ticket de TI**, no solo los empleados. La pantalla de
  Soporte TI existía pero solo estaba enrutada en `EmpleadoLayout` y en el menú del rol
  `empleado`, así que admin, RH y psicóloga no tenían puerta de entrada. El proxy ya aceptaba
  a cualquier usuario autenticado: el cambio es de **acceso**, no de lógica.
  `SoporteTI` se mueve de `components/empleados/` a `components/common/` y se añade la ruta
  `soporte` + el ítem de menú en los layouts de admin, RH y psicóloga.
- **"Mis tickets": el estado del ticket, dentro de Pulse.** La integración era de un solo
  sentido (se mandaba el ticket y no había forma de saber en qué iba). Ahora la pantalla lista
  los tickets del propio usuario con su chip de estado (Abierto / En progreso / Resuelto /
  Cerrado), categoría, prioridad y fecha.
  `api/soporte-ticket.js` atiende `GET`: valida el JWT y pide a MCTIC los tickets del **correo
  del token**, así que nadie puede consultar los de otra persona.

#### 🎨 Corregido (estilos)
- **El formulario del ticket no usaba el sistema de diseño.** Los campos iban como `<label>`,
  `<select>`, `<input>` y `<textarea>` **pelados, sin clase**, así que el navegador los pintaba
  con su apariencia por defecto en ambos temas. Ahora usan `mc-form-label`, `mc-form-input`,
  `mc-form-select` y `mc-form-textarea`, que ya traen sus reglas de modo oscuro en
  `styles/dark/tables-forms.css` — **sin escribir CSS nuevo**.
- `mc-form-grid` es de una sola columna: categoría y prioridad pasan a `mc-form-row-2` para ir
  lado a lado (y colapsar en móvil). Se elimina `mc-form-group-full`, una clase que **no existe**
  en el proyecto y no hacía nada. Se añaden `id`/`htmlFor` para enfocar el campo al pulsar su etiqueta.
- Los chips de estado reusan las variantes de `mc-status-pill` ya existentes, que traen modo oscuro.

#### 🐛 Corregido (producción)
- **La función de tickets nunca había llegado a producción.** El commit que la creó vivía solo en
  el repo de **respaldo** (`origin`); el remoto que despliega es **`prod`**. Además, al proyecto de
  Vercel le faltaban `MCTIC_API_URL` y `MCTIC_INTEGRATION_KEY`, así que el proxy cortaba con 500
  antes de llamar a MCTIC. Con ambas cosas resueltas, el envío de tickets **funciona por primera
  vez** (verificado de punta a punta con una sesión real).

> Recordatorio: `git push origin main` **no despliega**. Producción sale del remoto `prod`.

### 2026-07-02 · sesión 2 (credenciales, sync en vivo, fondo neón, PWA)

#### 🔒 Credenciales
- **Contraseña temporal unificada a `emp123`** (revierte la decisión previa de conservar
  `CambiaEsteTemporal2026!`): reseteados vía service role los 98 usuarios pendientes de
  primer login; el código ya la usaba en edge functions y UI.
- **Blindaje de primer ingreso** (`AuthContext`): entrar con `emp123` siempre fuerza el
  panel "Cambia tu contraseña", aunque `debe_cambiar_password` esté apagado en BD.
- **Edge functions redesplegadas** (`admin-reset-password`, `admin-create-usuario`): las
  versiones desplegadas eran viejas y al restablecer ponían `CambiaEsteTemporal2026!` en
  vez de `emp123`. Verificado E2E contra Supabase.

#### ✨ Encuestas en tiempo real
- Los dashboards (admin/psicóloga) ahora reflejan encuestas nuevas **sin recargar**, en
  tres capas: suscripción Realtime (INSERT instantáneo), refetch al volver a la pestaña
  y polling suave de 60s como fallback (`subscribeEncuestas` + `GlobalContext`).
- **Migración `024`**: publica `encuestas` en `supabase_realtime` + índice único
  `(empleado_id, semana)` — el doble envío de la misma semana ya es imposible a nivel BD
  (la UI ya lo bloqueaba, pero una condición de carrera podía duplicar).

#### 🎨 Fondo animado dark/neón
- Nuevo `styles/dark/background.css`: base abisal `#071613`, orbes aurora aqua/cian con
  deriva lenta, grid blueprint tintado neón y barrido cónico en desktop. Solo
  `transform`/`opacity` (GPU-friendly) y respeta `prefers-reduced-motion`.
- **El tema oscuro es ahora el default** (antes seguía al sistema); el toggle y la
  preferencia guardada se respetan. De paso: `.app-main` no tenía override oscuro y en
  dark el fondo arrancaba en `#F7FBFA` — corregido.

#### 📱 PWA / móvil
- `styles/mobile-polish.css`: touch targets ≥44px, inputs a 16px (evita el auto-zoom de
  iOS), feedback `:active`, `overscroll-behavior: contain`, tipografía compacta.
- Bottom-sheet "Más" con overrides de modo oscuro (era blanco fijo) y el toggle de tema
  con estilo propio (ya no hereda el rojo de "Cerrar sesión").
- `theme-color` y manifest → `#071613` (estética oscura), `viewport-fit=cover` (notch).

#### 🐛 Corregido
- Badge "Semana" del Inicio del empleado invisible en modo claro (usaba el estilo glass
  del header premium oscuro sobre fondo claro de página); ahora pill de marca en claro y
  glass en oscuro.

### 2026-07-02

Auditoría de 4 ejes (código · arquitectura · seguridad · UI/accesibilidad) y corrección
de los hallazgos, excepto la contraseña temporal (se conserva por decisión de negocio).

#### 🔒 Seguridad
- **Escalación de privilegios `rh → admin` cerrada** (migración `023`): un trigger
  `BEFORE UPDATE` sobre `usuarios` impide que cualquier caller que no sea admin cambie
  `role` o `auth_user_id`, incluso llamando a Postgres directo (la policy sola no bastaba).
- **`api/gemini.js` ahora exige JWT de Supabase**: antes el endpoint estaba abierto
  (cualquiera podía quemar la cuota de Gemini y sobreescribir el system prompt). Además
  ignora el `system` enviado por el cliente y lo fija en el servidor.
- **`GestionUsuarios`** ya no llama a `supabase` directo: la creación de usuarios pasa por
  `usuariosService.crearUsuario()` (capa de servicios).

#### 🐛 Corregido
- **Selects de empleado rotos** (`ReconocimientosGestion`, `ExpedienteIntegral`): el `value`
  del `<select>` es string y el `id` number; con `===` estricto dejaban de funcionar tras el
  primer cambio. Ahora comparan con `String()`.
- **AI Engine**: las 5 llamadas a la IA no tenían `try/catch` → el spinner quedaba colgado
  para siempre si fallaba el fetch. Ahora hay `try/catch/finally` + toast de error.
- **Falso éxito** en encuesta y mensaje: se confirmaba "enviado" sin esperar el guardado.
  Ahora las acciones devuelven booleano y solo se confirma en éxito.
- **`GlobalContext`**: un error de red se veía idéntico a "sin datos". Ahora distingue el
  fallo (conserva estado previo + toast) de un resultado vacío real.
- **Login**: distingue error de conexión de credenciales inválidas.

#### ♿ Accesibilidad
- **42 labels** de formulario con `htmlFor` asociado a su control (antes sin asociación).
- **4 modales** con `role="dialog"`, `aria-modal` y `aria-labelledby`; `aria-label` en el
  botón de cerrar.
- `SectionTitle` pasa de `<h3>` a `<h2>` (no se salta el nivel de encabezado).

#### 🎨 Dark mode
- Colores de estado (`.mc-kpi-value`, RiskBar, semáforos de riesgo) migrados a tokens
  `--mc-stat-*` con rama clara/oscura vía `color-mix`, para que reaccionen al tema
  (antes eran hex inline, imposibles de sobreescribir por `[data-theme="dark"]`).

#### ⚡ Rendimiento / orden
- `useMemo` en el análisis de `AIEngine` (antes se recalculaba en cada tecla del chat).
- `AIEngine.jsx` de 923 → 743 líneas: motor de riesgo extraído a `utils/aiRiskEngine.js`
  y el render markdown a `components/common/MarkdownLite.jsx`.

### 2026-06-30

#### ✨ Añadido
- **Gateway de acceso pre-login** (`/`): pantalla de bienvenida glassmorphism antes del login.
- **AI Engine funcional con Gemini**: los tabs Resumen / Alertas / Predicciones generan
  texto real; **Copiloto** es un chat conversacional; análisis IA por expediente con
  scroll y resaltado a la tarjeta del colaborador.
- **Render Markdown** del texto de la IA (encabezados, listas, negrita/cursiva, código).
- **Filtro por semana** en los dashboards (admin y psicóloga) y en el AI Engine, con
  selector navegable a semanas pasadas (las pre-lanzamiento se agrupan en `2026-W00`).
- **Dashboard psicóloga**: distribución de semáforo, participación, tendencia por oficina
  (barras agrupadas) y **sucursales en riesgo** (con modal de colaboradores).
- **Dashboard admin**: widget **sucursales en riesgo** + modal; layout apilado a ancho completo.
- **Layout móvil**: barra inferior de navegación con tabs + hoja "Más" (sidebar oculto en ≤768px).
- **Filtros en Seguimiento** (nombre, puesto, sucursal, semáforo) como en Empleados.
- **`WeekSelect`**: desplegable propio (no nativo) para elegir semana, se renderiza en la
  página y funciona bien en móvil.

#### 🔁 Cambiado
- **Rediseño visual completo (glassmorphism)**: sistema de design tokens unificado
  (paleta teal + glow aqua), sidebar con gradiente de marca, tarjetas de cristal,
  login rediseñado.
- **Semana del sistema dinámica**: antes estaba fija en `2026-W01`; ahora es la semana
  ISO real y la encuesta **se reinicia cada lunes 00:00** (refresco en vivo sin recargar).
  Numeración relativa al lanzamiento (`2026-W01`, `W02`…).
- **Mensajes**: orden cronológico, badge de no leídos correcto, conserva la hora,
  auto-scroll al último, preview del último mensaje en la lista.
- Dashboards por semana: los KPIs (semáforo, foco rojo, casos) reflejan la semana seleccionada.

#### 🐛 Corregido
- **Tendencia del admin** estaba hardcodeada a `2025-W10..W14` (siempre vacía) → ahora usa datos reales.
- **Foco rojo** contaba filas de encuesta en vez de empleados.
- **Badge "N mensajes"** contaba todos los no leídos globales en vez de los dirigidos a la psicóloga.
- **"Leído"** de mensajes ahora **persiste en Firestore** (antes era solo local y reaparecía al recargar).
- Encuestas huérfanas (de empleados inexistentes) se filtran en la tendencia.
- Selector de semana ya no se desborda en vista móvil.

#### 🔒 Seguridad
- **IA migrada a proxy serverless** (`api/gemini.js`): la key de Gemini ya no se expone en el bundle.
- `geminiService.js` (código muerto que referenciaba la key en cliente) eliminado.
- `.env` y `.env.local` fuera del control de versiones.

#### 🔐 Migración a Supabase
La autenticación casera con contraseñas en texto plano se reemplazó por **Supabase Auth**
(hash nativo, sesiones JWT) y las reglas de acceso permisivas por **RLS granular por rol**
en Postgres. Detalle completo en `supabase/migrations/`.
