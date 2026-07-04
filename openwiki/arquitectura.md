# Arquitectura — McDental Pulse

## Visión general

App SPA/PWA de una sola página que habla directamente con Supabase desde el navegador.
No hay backend propio salvo **una** función serverless (`api/gemini.js`) que actúa de
proxy para la IA. La seguridad de datos se delega a **Row Level Security (RLS)** de
Postgres: aunque el cliente use la `anon key` pública, cada consulta se filtra por las
políticas RLS según el usuario autenticado.

```
Navegador (React 19 PWA)
  │
  ├── @supabase/supabase-js ──►  Supabase
  │      (anon key + JWT)          ├── Postgres (RLS)
  │                                ├── Auth (JWT, emails sintéticos)
  │                                ├── Storage (buckets: expedientes, avatars)
  │                                └── Edge Functions (admin-*)
  │
  └── fetch /api/gemini ──────►  Vercel Serverless (api/gemini.js)
         (Bearer JWT)                └── Google Gemini 2.5 Flash (GEMINI_API_KEY server-side)
```

## Enrutado por rol (`src/App.jsx`)

El componente raíz decide qué renderizar según el estado de sesión:

1. `checkingSession` → muestra `<Loader />` (evita el *flash* de landing con sesión activa).
2. Sin usuario, o con `requiereCambioPassword` → `<LandingPage />` (incluye el panel de
   cambio de contraseña forzado en primer login).
3. Con sesión: si la URL no empieza por `/${user.role}`, redirige a su home de rol.
4. Cada rol monta su *layout* con **lazy loading**:
   - `admin` → `AdminLayout` en `/admin/*`
   - `psicologa` → `PsicologaLayout` en `/psicologa/*`
   - `rh` → `HRLayout` en `/rh/*`
   - `empleado` → `EmpleadoLayout` en `/empleado/*`

Un `setInterval` de 60s llama a `refreshSemana()` para recalcular la **semana activa** al
cruzar el lunes 00:00 sin recargar la página.

## Autenticación y roles

- **Supabase Auth** con *emails sintéticos*: el login es por `username`, que se convierte a
  `{username}@mcdental.internal` mediante `usernameToSyntheticEmail()` en
  `src/config/supabase.js`. El saneo (minúsculas, espacios→`.`, quita caracteres no
  `[a-z0-9._-]`) **debe coincidir** con el usado en la migración de datos.
- **Perfil 1:1**: la tabla `usuarios` referencia `auth.users(id)` vía `auth_user_id`.
- **Cambio de contraseña forzado**: la columna `usuarios.debe_cambiar_password` (default
  `true`) obliga a restablecer la contraseña en el primer acceso.
- **Cuatro roles** (`enum rol_usuario`): `admin`, `rh`, `psicologa`, `empleado`.
- **Anti escalada de privilegios**: migración 23 impide que un usuario cambie su propio rol.

El estado de sesión y las acciones de auth se exponen vía **React Context**
(`AuthContext`), consumido con `useAuth()`.

## Contextos globales (`src/contexts/`)

| Context | Rol |
|---|---|
| `AuthContext` | Sesión, usuario, `requiereCambioPassword`, restablecer password |
| `GlobalContext` | Estado compartido de la app (datos globales de dominio) |
| `NotificationContext` | Notificaciones/toasts en UI |
| `ThemeContext` | Modo claro/oscuro; setea `data-theme="dark"` en `<html>`, persistido en `localStorage` |

## Tema claro/oscuro (arquitectura aditiva)

- `src/index.css` define los **tokens base** y la paleta `[data-theme="dark"]`.
- `src/styles/dark/*.css` (surfaces, badges-pills, buttons, tables-forms, charts, screens)
  se importan **después** de `App.css` en `main.jsx` como *overrides* `[data-theme="dark"] .clase {}`.
- `App.css` (~7800 líneas) casi no se toca directamente; el modo oscuro se logra por capas.

## Capa de acceso a datos

No hay ORM: `src/services/supabase/*.js` expone **una función por operación** sobre el
cliente de Supabase (ver [estructura-codigo.md](./estructura-codigo.md)). Los componentes
llaman a estos servicios; RLS decide qué filas devuelve cada consulta.
