# Estructura de código — McDental Pulse

```
api/gemini.js            Proxy serverless de Gemini (key server-side)
supabase/
  migrations/            26 archivos SQL: schema + RLS + Storage
  functions/             Edge Functions (admin-create-usuario, admin-reset-password, admin-update-username, _shared)
scripts/                 generate-pwa-icons.mjs, migrate-firestore-to-supabase.mjs
src/
  main.jsx               Entry; monta providers e importa estilos (base + dark overrides)
  App.jsx                Enrutado por rol con lazy layouts
  config/                supabase.js, theme.js, constants.js
  contexts/              AuthContext, GlobalContext, NotificationContext, ThemeContext
  services/supabase/     Acceso a datos (una función por operación)
  components/            UI agrupada por rol y por función
  utils/                 pulseScore, analysisEngine, aiRiskEngine, helpers…
  hooks/                 useAppActions
  styles/dark/           Overrides de modo oscuro por capa
  data/                  Datos estáticos/semilla
  assets/logos/          Imágenes
index.html · vite.config.js · vercel.json · eslint.config.js
```

## `src/config/`

- **`supabase.js`** — crea el cliente `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
  y exporta `usernameToSyntheticEmail()` (login por username → email sintético).
- **`theme.js`**, **`constants.js`** — configuración de tema y constantes de dominio.

## `src/services/supabase/` — capa de datos

Un archivo por entidad; cada uno exporta funciones puras que envuelven llamadas al cliente
de Supabase. No hay ORM ni repositorio genérico.

| Archivo | Entidad |
|---|---|
| `usuariosService.js` | Usuarios / perfiles |
| `encuestasService.js` | Encuestas (pulse) |
| `encuestaPreguntasService.js` | Banco de preguntas |
| `mensajesService.js` | Mensajería |
| `notasService.js` | Notas psicológicas |
| `vacacionesService.js` | Vacaciones |
| `permisosService.js` | Permisos |
| `descuentosService.js` | Descuentos |
| `reconocimientosService.js` | Reconocimientos |
| `reportesService.js` | Reportes confidenciales |
| `archivosExpedienteService.js` | Archivos de expediente (Storage) |
| `avatarService.js` | Avatares (Storage) |
| `bolsaTrabajoService.js` | Bolsa de trabajo / candidatos |

**Patrón al añadir una entidad:** crear migración SQL (schema + RLS) → añadir
`<entidad>Service.js` con las operaciones → consumirlo desde el componente del rol.

## `src/components/` — UI

Agrupada por rol y por función (59 archivos):

| Carpeta | Contenido |
|---|---|
| `landing/` | Landing + panel de cambio de contraseña forzado |
| `layout/` | `AdminLayout`, `HRLayout`, `PsicologaLayout`, `EmpleadoLayout` + shell común |
| `dashboards/` | Dashboards (incl. `AdminDashboard` con KPIs) |
| `admin/` | Pantallas de administración |
| `rh/` | Recursos Humanos (permisos, descuentos, reconocimientos, personal) |
| `psicologia/` | Seguimiento psicológico y reportes |
| `empleados/` | Vistas del empleado (encuesta, solicitudes…) |
| `ia/` | UI del motor de IA (chat/análisis con Gemini) |
| `comunicacion/` | Mensajería |
| `settings/` | Ajustes (incl. tema) |
| `common/` | Componentes compartidos (14) |
| `ui/` | Primitivas de UI (`Loader`, etc.) |

## `src/utils/` — lógica de dominio

| Archivo | Función |
|---|---|
| `pulseScore.js` | Cálculo del Pulse Score a partir de `respuestas` |
| `analysisEngine.js` | Motor de análisis de encuestas |
| `aiRiskEngine.js` | Detección de riesgo (insumo para IA/psicología) |
| `constants.js` | Semanas activas, `refreshSemana()` |
| `encuestaDetail.js`, `encuestaPreguntas.js` | Helpers de encuestas |
| `adminEmployeeDates.js`, `rh.js`, `psicologa.js` | Helpers por rol |
| `helpers.js`, `notify.js` | Utilidades generales / notificaciones |

## `src/hooks/`

- **`useAppActions.js`** — agrupa las acciones de alto nivel que `App.jsx` inyecta a los
  layouts (`actions`), combinadas con acciones de auth.
