# Plan — Memoizar AuthContext y GlobalContext

STATUS: APPROVED
Fecha: 2026-09-03
Origen: al arreglar el mismo anti-patrón en NotificationContext (loop infinito reproducido en
vivo) se marcaron ThemeContext/AccentContext como preventivos y AuthContext/GlobalContext como
"no tocar sin revisión dedicada" — son auth-adyacentes (`rules/task-grade-routing.md`, piso XL:
Auth/PII arranca en XL sin importar qué tan chico se vea el cambio).
Aprobación: el dueño, vía AskUserQuestion, eligió explícitamente "Los dos, con el proceso XL
completo" en vez de saltarse GlobalContext (más riesgoso) o hacer solo AuthContext.

---

## Por qué (y por qué no es urgente)

Ningún bug se reprodujo en vivo para estos dos, a diferencia de NotificationContext. Revisados
los 8 consumidores de `useAuth()` con `useEffect` (App.jsx, LandingPage.jsx, Sidebar.jsx,
AdminPlusNav.jsx, HeaderNav.jsx, BuscadorGlobal.jsx, AccentContext.jsx, BotonReuniones.jsx,
ModulosPanel.jsx, Config.jsx, GlobalContext.jsx): ninguno tiene una función inestable del
contexto (`login`/`logout`/`restablecerPasswordUsuario`) como dependencia de un efecto — el
patrón que sí rompió NotificationContext (efecto falla → llama función inestable → nueva
identidad → loop) no se reproduce acá.

El motivo real es el mismo de siempre: `value={{...}}` sin memoizar crea un objeto nuevo en
cada render del Provider, y como AuthProvider/GlobalProvider están cerca de la raíz, eso
fuerza a re-renderizar a cada consumidor de `useAuth()`/`useGlobal()` en la app entera aunque
nada de lo que usan haya cambiado. Es deuda de rendimiento real, no un bug funcional confirmado.

## Non-goals

- Ningún cambio de lógica de auth, sesión, RLS, permisos ni de qué datos se piden.
- Ningún cambio de comportamiento visible. Es puramente memoización.
- No se toca `cargarPerfil` fuera de envolverlo en `useCallback` (mismo cuerpo).

## Alcance

### `src/contexts/AuthContext.jsx`
- `cargarPerfil`, `login`, `logout`, `cambiarPasswordActual`, `restablecerPasswordUsuario`:
  envueltos en `useCallback` con el array de dependencias que `eslint-plugin-react-hooks`
  (`react-hooks/exhaustive-deps`, ya activo en `eslint.config.js`) exija — no se adivina a mano.
- El valor del Provider (9 keys: `user, login, logout, loadingAuth, checkingSession, setUser,
  requiereCambioPassword, cambiarPasswordActual, restablecerPasswordUsuario`) envuelto en
  `useMemo`.

### `src/contexts/GlobalContext.jsx`
- `refreshEncuestas`/`refreshAvisos`/`refreshReuniones` ya están en `useCallback([])` — se
  dejan igual.
- El valor del Provider (~35 keys: state + setters + derivados) envuelto en `useMemo`, con el
  array de dependencias que exija `react-hooks/exhaustive-deps`.

## Cómo se prueba que el memo no metió un bug (no solo que "compila")

`useMemo`/`useCallback` con una dependencia que falta no truena en build ni en tests — deja un
closure viejo que falla en silencio bajo un patrón de uso específico. Por eso:

1. `react-hooks/exhaustive-deps` (ya en el linter del repo) como primera red: si falta una
   dependencia real, lo marca como error.
2. El checker de la ronda 1 (correctness) **rompe el memo a propósito** — quita una dependencia
   real del array y confirma que (a) eslint lo marca, y (b) un cambio de ese estado ya no se
   refleja en el valor del contexto (stale value reproducido de verdad, no solo argumentado) —
   antes de devolver el archivo a como quedó.
3. Smoke manual local con las 5 cuentas de rol (mismo patrón de cuentas desechables ya usado
   esta sesión): login, cambio de contraseña forzado, logout, y que `usuarios`/`avisos`/
   `festivos` etc. del contexto global sigan actualizándose tras una acción que los cambia.

## Verificación (XL: 2 líneas independientes)

- **Línea 1 — correctness**: agente `adversarial-reviewer` fresco. Reproduce el punto 2 de
  arriba (rompe una dependencia real de cada `useMemo`, confirma que sí se nota) y corre
  tests+build+lint.
- **Línea 2 — riesgo específico (auth/runtime)**: agente `security-reviewer` o
  `adversarial-reviewer` fresco e independiente del de la línea 1, enfocado en: ¿algún flujo de
  login/logout/cambio de contraseña/restauración de sesión puede leer un `user` o un
  `requiereCambioPassword` desactualizado por culpa del memo? ¿algún componente que decide qué
  mostrar según rol podría quedarse con un rol viejo tras un cambio real?

## Rollback

Revert del commit. No toca esquema, migraciones ni contrato de API — revertir el archivo y
reconstruir el frontend (`build-frontend.sh`) alcanza.
