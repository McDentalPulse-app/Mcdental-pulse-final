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

> ⚠️ La IA se llama a través del proxy `api/gemini.js`. Nunca pongas la key de Gemini con prefijo `VITE_` (quedaría expuesta en el bundle del navegador).

## Estructura

```
api/gemini.js            Proxy serverless de Gemini (key server-side)
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

- **Producción:** `McDentalPulse-app/Mcdental-pulse-final` (rama `develop`)
- **Backup:** `MCDentalSist/MCDentalPulseBackUp` (rama `main`)

---

## Changelog

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
