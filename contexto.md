# 🌌 Contexto del Proyecto: McDental Pulse

Este archivo conserva el estado actual de la interacción y del proyecto para reanudar el trabajo en futuras sesiones.

---

## 📅 Estado de la Sesión
*   **Fecha de registro**: 2026-07-02
*   **Ubicación del Proyecto**: `/home/helminth/Proyects/Mcdental-pulse-final-main`
*   **Tipo de Proyecto**: Plataforma Web de Bienestar Organizacional (React 19 + Vite 8 + **Supabase** — Postgres + Auth + Storage).
*   **Nota**: el registro anterior de este archivo (2026-06-26) describía el stack como Firebase/Firestore. Esa migración ya se completó por entero; el proyecto corre 100% sobre Supabase desde entonces. No quedan referencias funcionales a Firebase (el `.env` viejo se conserva solo como backup, a pedido explícito del usuario).

---

## 🏗️ Arquitectura actual (resumen)

*   **Auth**: Supabase Auth con usernames sintéticos (`username@mcdental.internal` vía `usernameToSyntheticEmail`). Roles: `admin`, `rh`, `psicologa`, `empleado`. Cambio de contraseña forzado en primer login (`debe_cambiar_password`).
*   **Datos**: Postgres con RLS en casi todas las tablas. Migraciones en `supabase/migrations/`, numeradas secuencialmente — la última aplicada es `00000000000022_avatars_select_policy.sql`.
*   **Storage**: dos buckets —
    *   `expedientes` (privado, 10MB máx): archivos de expediente, políticas por rol (admin/rh/psicologa).
    *   `avatars` (público, 2MB máx): fotos de perfil, políticas de insert/update/delete solo admin/psicologa. Ver sección Avatares abajo.
*   **Tema claro/oscuro**: `ThemeContext.jsx` setea `data-theme="dark"` en `<html>`, persistido en `localStorage`. Arquitectura **aditiva**: `src/index.css` tiene los tokens base, y `src/styles/dark/*.css` (surfaces, badges-pills, buttons, tables-forms, charts, screens) se importan después de `App.css` en `main.jsx` con overrides `[data-theme="dark"] .clase {}` — `App.css` (7800+ líneas) casi no se tocó directamente, salvo swaps puntuales de `color: var(--mc-verde-oscuro)` → `color: var(--mc-texto-titulo)` (bridge variable, sin efecto en modo claro).
*   **Indexado del codebase**: `codebase-memory-mcp` tiene el repo indexado bajo el proyecto `home-helminth-Proyects-Mcdental-pulse-final-main` (735 nodos / 1694 edges al cierre de esta sesión). Reindexar con:
    ```bash
    codebase-memory-mcp cli index_repository '{"repo_path":"/home/helminth/Proyects/Mcdental-pulse-final-main","project":"home-helminth-Proyects-Mcdental-pulse-final-main"}'
    ```
    (usar siempre ruta **absoluta** — con `"."` crea un proyecto corrupto separado llamado `root`).

---

## 🛠️ Trabajo realizado en esta sesión extendida

1.  **Pulido de animaciones** en landing (transición de cambio de contraseña) y en Gestión de Personal (misma animación que "Score por Sucursal" del dashboard) + filtro por sucursal en búsqueda de empleados.
2.  **Login directo a dashboard**: usuarios con sesión activa ya no ven un flash de la landing/login.
3.  **Sesión `/grilling`** sobre la migración completa Firebase→Supabase: se removió la ruta `/login` sobrante, se corrigieron referencias viejas a "emp123".
4.  **Modo oscuro real, completo**: no solo el fondo — paleta propia (`[data-theme="dark"]` en `index.css`), tarjetas, modales, tablas, badges/pills (invertidos: fondo saturado oscuro + texto claro), botones, gráficos SVG, y un barrido exhaustivo por **las 33 pantallas de los 4 roles** vía script de auditoría automática (Playwright + contraste WCAG). Quedaron documentadas como falsos positivos/limitaciones aceptadas (no bugs):
    *   `text` de gráficos SVG — el script medía `color` heredado en vez del atributo `fill` real.
    *   `.psico-part-pct` — su fondo real es un `::before` (círculo), invisible al recorrido DOM.
    *   `.mc-kpi-value` — color viene de un prop hex fijo por KPI en `AdminDashboard.jsx`, no de CSS. **Limitación conocida, no reactiva al tema** (requeriría lógica JS, se decidió no tocar).
    *   `.ai-engine-tab--active` / `.ai-gen-btn` — su fondo real es un pill/gradiente vivo pintado por un hijo posicionado, diseño intencional.
5.  **Logo removido de la landing page** — ahora solo vive en el sidebar (`Sidebar.jsx`, ya lo tenía).
6.  **Foto de perfil (avatares)**:
    *   Migración `00000000000021_avatars.sql`: columna `usuarios.avatar_url` + bucket `avatars` (público, 2MB) + políticas insert/update/delete solo admin/psicologa.
    *   Migración `00000000000022_avatars_select_policy.sql`: **bug real encontrado y corregido** — aunque el bucket es público, `storage.objects` necesita su propia política de `SELECT` para que el servicio de Storage resuelva metadata al hacer `upsert`; sin ella, cualquier subida fallaba con "row-level security policy" aunque la política de `INSERT` era correcta.
    *   `src/services/supabase/avatarService.js`: compresión client-side (Canvas, máx 400×400px, JPEG q=0.82) antes de subir — importante porque el proyecto está en el **plan gratuito de Supabase** (1GB de storage total).
    *   Subida/borrado de foto: **solo en Expedientes** (`ExpedienteIntegral.jsx`), visible solo para admin/psicologa. La foto se **muestra** en toda la app (sidebar, Empleados, Mensajes, Dashboard, AI Engine, Seguimiento psicológico) vía el componente compartido `Avatar.jsx` (prop `photoUrl`).
    *   Botón "Quitar foto" junto a "Cambiar foto" (con confirmación), solo visible si el empleado ya tiene foto asignada.

---

## 🔑 Patrones operativos para la próxima sesión

*   **Token de Supabase CLI**: no se persiste en disco por seguridad. Para correr `supabase db push` (migraciones) hay que pedírselo de nuevo al usuario (Personal Access Token desde `supabase.com/dashboard/account/tokens`) y usarlo solo como variable de entorno en el comando, nunca imprimirlo.
*   **Cuentas de prueba** (reset vía `SUPABASE_SERVICE_ROLE_KEY`, patrón usado dutante toda la sesión): `mario` (admin), `maricruz izaguirre` (rh), `ana salas` (psicologa), `valeria alcaraz` (empleado). Contraseña temporal estándar: `emp123` + `debe_cambiar_password=true` (actualizada 2026-07-02: se reseteó vía service role a los 98 usuarios pendientes; antes era `CambiaEsteTemporal2026!`). **Siempre restaurar este estado al terminar de probar** — es el estado en el que deben quedar entre sesiones.
*   **Testing UI**: Playwright instalado con `npm install --no-save playwright` para cada ronda de pruebas, y desinstalado (`npm uninstall playwright`) + scripts `.mjs` temporales borrados al terminar — nunca se commitea.
*   **`.env`**: contiene credenciales viejas de Firebase, el usuario pidió explícitamente conservarlo como backup — no borrar ni tocar.

---

## 📌 Próximos pasos posibles (no confirmados, ideas abiertas de la sesión)
*   No hay tareas pendientes abiertas al cierre de esta sesión — el barrido de modo oscuro y la feature de avatares quedaron completos y verificados end-to-end.
*   Si se retoma trabajo de UI, revisar primero si hay overrides de dark mode ya cubiertos en `src/styles/dark/` antes de escribir CSS nuevo.

---

## 🛠️ Sesión 2026-07-02 (tarde)

1.  **Credenciales**: contraseña temporal unificada a `emp123` — reseteados vía service role los 98 usuarios con `debe_cambiar_password=true` + `mario`/`maricruz izaguirre`. A ambos se les restauró después `debe_cambiar_password=true` (todo usuario con `emp123` debe cambiarla al entrar; única excepción legítima con flag=false: `luz gomez`, que ya tenía contraseña propia). **Blindaje en `AuthContext.jsx`**: entrar con `emp123` (const `TEMP_PASSWORD`, espejo de la edge function) fuerza el panel "Cambia tu contraseña" aunque el flag esté apagado en BD (`loginConTemporalRef`) — verificado E2E con Playwright.
2.  **Sync de encuestas en vivo**: `subscribeEncuestas()` (realtime INSERT) en `encuestasService.js` + en `GlobalContext` refetch al volver a la pestaña (visibilitychange) y polling de 60s con pestaña visible. Migración **00000000000024_encuestas_realtime.sql** aplicada vía `db push` (⚠️ se renumeró de 23→24: ya existía `00000000000023_usuarios_prevent_privilege_escalation.sql` aplicada en remoto). Realtime verificado en vivo (INSERT → evento) + unique index (empleado_id, semana) rechaza duplicados (23505).
    *   **Edge functions redesplegadas** (2026-07-02, `supabase functions deploy --use-api`): `admin-reset-password` y `admin-create-usuario` — las versiones desplegadas eran viejas y seguían poniendo `CambiaEsteTemporal2026!` al restablecer. Verificado E2E: reset → vieja rechazada, `emp123` acepta.
    *   `mario` ya no está en `emp123`: el usuario completó el flujo de cambio forzado y tiene contraseña propia. `maricruz izaguirre` sigue en `emp123`+flag (usada para sesiones admin/rh de prueba).
3.  **Fondo animado dark/neón**: `src/styles/dark/background.css` (aditivo) — base abisal `#071613`, orbes aurora aqua/cian con drift, grid neón, cinta cónica en desktop; solo transform/opacity + `prefers-reduced-motion`. Tema **default ahora es dark** (ThemeContext ya no sigue al sistema; el toggle y la preferencia guardada se respetan). Nota: `.app-main` no tenía override oscuro — antes en dark el gradiente arrancaba en `#F7FBFA`.
4.  **PWA/móvil**: `src/styles/mobile-polish.css` (touch targets ≥44px, inputs 16px anti-zoom iOS, feedback :active, overscroll contain, títulos compactos) + dark overrides del bottom-sheet en `screens.css` (era blanco fijo) + toggle de tema del sheet con clase propia (ya no hereda el rojo de logout). `theme-color`/manifest → `#071613`, viewport con `viewport-fit=cover`.
5.  **Fix badge "Semana" del Inicio del empleado**: era invisible en modo claro — `.dashboard-week-badge` está diseñado para el header premium oscuro (texto `#EAFFFB` + glass blanco 8%) pero en `InicioEmpleado` vive sobre el fondo claro de la página. Fix con alcance `.empleado-welcome-header .dashboard-week-badge`: pill de marca en claro (App.css) + restauración glass en oscuro (`styles/dark/screens.css`). El badge de RH (dentro de `PageHeader`) no se tocó. Verificado en ambos temas con screenshot.
6.  **Semántica de semanas (confirmada con el usuario)**: se guarda la semana ISO real (`2026-W27`); la UI renumera desde `LAUNCH_WEEK='2026-W27'` → "2026-W01". El lunes 2026-07-06 00:00 local arranca `2026-W28` → "2026-W02" y la encuesta se reinicia (timer de 60s en App.jsx, sin recargar). Una encuesta por empleado/semana: UI + índice único de la migración 24.

---

## 🚀 Deploy a producción (2026-07-02)

*   **GitHub** — dos remotos:
    *   `prod` → `https://github.com/McDentalPulse-app/Mcdental-pulse-final.git` (**producción**, conectado a Vercel: cada push a `main` despliega solo).
    *   `origin` → `https://github.com/MCDentalSist/MCDentalPulseBackUp.git` (backup).
    *   Ambos en `main` = `beabf1b` ("feat: sync de encuestas en tiempo real, fondo dark/neón, PWA móvil y credenciales emp123"). README actualizado con changelog "2026-07-02 · sesión 2".
    *   `gh` quedó autenticado en esta máquina como **MCDentalSist** (credenciales en texto plano según aviso de gh; `gh auth setup-git` configurado como credential helper).
*   **Vercel** — proyecto `mcdental-pulse-final` (team `mcdentalpulse-apps-projects`), CLI instalado global y logueado como **mcdentalpulse-app**. Repo linkeado (`.vercel/` local, `.env.local` intacto — Vercel solo añadió `VERCEL_OIDC_TOKEN`).
    *   **Env vars Production**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (agregadas esta sesión) + `GEMINI_API_KEY` (ya existía). ⚠️ Nunca subir `SUPABASE_SERVICE_ROLE_KEY` a Vercel. Quedan `VITE_FIREBASE_*` viejas (residuo inofensivo, el código no las lee — borrables).
    *   **Redeploy verificado**: bundle de producción contiene la URL de Supabase horneada; `/api/gemini` sin token responde 401 (function viva exigiendo JWT). URL: https://mcdental-pulse-final.vercel.app
*   **⚠️ Pendiente de seguridad**: rotar el Personal Access Token de Supabase usado esta sesión (quedó en el historial del chat) — supabase.com/dashboard/account/tokens. Valorar `gh auth logout` si la máquina es compartida.

## 🐛 Fix: cambio de nombre de usuario (2026-07-02, noche)

*   **Bug**: editar el username en Gestión de Personal solo actualizaba `public.usuarios`; el login autentica contra `auth.users.email` (email sintético) → el empleado renombrado no podía entrar ni con el username nuevo ni con `emp123`. Además `usuarios.synthetic_email` quedaba desincronizado.
*   **Fix**: edge function nueva **`admin-update-username`** (caller admin/rh; actualiza atómicamente auth email + username + synthetic_email, con precheck de disponibilidad y rollback del email si falla la BD; idempotente — llamarla con el username actual re-sincroniza). `usuariosService.updateUsuario` ya NO escribe username directo (comentado a propósito); nuevo `cambiarUsername()`; `GestionUsuarios.guardarUsuario` la invoca solo si el username cambió.
*   **Reparados** los 2 usuarios atrapados por el bug en pruebas del usuario: `georgina silva` (ex `minerva sanchez`) y `samantha perez` (ex `samanta perez`) — resincronizados + normalizados a `emp123`+flag.
*   **Verificado E2E en UI** (Playwright): renombrar sandra galvan → "sandra prueba" desde Gestión de Personal como rh; tabla y pantalla Empleados muestran el cambio al instante (propagación vía `setUsuarios` del GlobalContext — todos los consumidores leen del contexto); login con username nuevo + `emp123` → panel de cambio forzado; username viejo rechazado. Estado restaurado después (sandra y maricruz de vuelta a su estado estándar).
*   **Propagación en la app**: dentro de la sesión, todo consume `usuarios` del GlobalContext por id → un edit se refleja en todas las pantallas. Nota: registros históricos con nombre denormalizado (p. ej. `otorgadoPor` en reconocimientos viejos) conservan el nombre de aquel momento — esperado. Otras sesiones abiertas ven el cambio al recargar (usuarios no está en realtime).

## 🚫 Feature: `inactivo` ahora es funcional (2026-07-02, noche)

*   **Antes**: "Desactivar empleado" solo cambiaba el pill en Gestión de Personal — el desactivado podía seguir entrando y contaba en todos los KPIs.
*   **Bloqueo de login**: `cargarPerfil` (AuthContext) cierra la sesión de Auth si `inactivo=true` — cubre login activo (mensaje "Tu cuenta está desactivada. Contacta a administración.") y restauración de sesión al abrir la app. Sesiones ya abiertas se expulsan al recargar.
*   **Exclusión de dashboards**: helper `esEmpleadoActivo` (utils/helpers.js) aplicado en 11 consumidores: AdminDashboard, PsicologaDashboard, HRDashboard, Reportes (5 sitios), AIEngine, Mensajes, PsicologaSeguimiento, EmpleadosList, ReconocimientosGestion, DescuentosRH (select), EventosPersonal (cumpleaños, todos los roles).
*   **Conservan inactivos a propósito**: ExpedienteIntegral (archivo/historial, comentado en código) y GestionUsuarios (para reactivar).
*   **Verificado E2E**: login de inactiva rechazado con mensaje; HR dashboard 99→98 colaboradores; fuera de Empleados; visible en Gestión con botón Activar; reactivada vuelve a entrar.

## 📱 Fix: landing en teléfonos + barrido móvil (2026-07-02, noche)

*   **Bug reportado**: en teléfonos los botones de la landing "se esconden o no aparecen". Causa: `.gw-wrapper` centra vertical con contenido más alto que el viewport — en ≤360px la tarjeta de acceso quedaba bajo el fold sin indicio visual (la página sí scrolleaba, pero parecía que no había botón).
*   **Fix landing** (`LandingPage.css` + `.jsx`): media query ≤560px que compacta el hero (título con clamp menor, chips decorativos y ECG ocultos, `align-items: flex-start`) para que la tarjeta con su CTA entre en la primera pantalla **incluso en 320×568 (iPhone SE1)**; al voltear al login, `scrollIntoView` de la tarjeta completa + `focus({preventScroll})`; el panel de cambio de contraseña ya no usa `inset:0` (cortaba "Volver" si su contenido excedía el alto del stage — ahora `top/left/right` + `min-height:100%`).
*   **Barrido móvil de toda la app**: 16 pantallas (empleado @320/@390: inicio, encuesta, vacaciones, mensajes, historial · rh @360: dashboard, usuarios, vacaciones, calendario, empleados, reconocimientos) con detector de overflow-x programático → **cero desbordes**; verificación visual de encuesta (escala 1-10 táctil), tabbar y cards correctas. La base ya era sólida (media queries de App.css + mobile-polish.css de esta sesión).

## 🔑 Estado de cuentas al cierre (2026-07-02 tarde)

*   Temporal estándar: `emp123` + `debe_cambiar_password=true`. Entrar con `emp123` SIEMPRE fuerza cambio (blindaje AuthContext), aunque el flag esté apagado.
*   `mario` (admin) y `valeria alcaraz` (empleado): completaron el cambio forzado durante las pruebas del usuario — tienen contraseña personal, flag=false.
*   `maricruz izaguirre` (rh): `emp123` + flag=true (útil para sesiones admin/rh de prueba vía API).
*   `ana salas` (psicologa) y resto de empleados: `emp123` + flag=true.
*   `luz gomez`: contraseña propia previa a esta sesión, flag=false (legítimo).
