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

## 📱 Pulido integral móvil — 4 roles (2026-07-02, noche 2)

Petición: la mayoría del personal usa la app **desde el teléfono**, así que debe quedar "muy bien en cualquier teléfono". Decisión del usuario: barrido **parejo por los 4 roles**, **pulido integral sin rediseñar**.

*   **Auditoría programática (Playwright, 34 pantallas × 4 anchos 320/360/390/430)**: la base ya era muy sólida — **cero overflow-x** en todos lados; la mayoría de "tap targets chicos" resultaron falsos positivos (leyendas/etiquetas). Se corrió un **detector de superficies blancas en dark** (near-white opaco, área ≥2500px²) que encontró los gaps reales. Scripts en scratchpad (no commiteados): `prep-accounts`, `sweep`, `dark-white-detector`, `tap-targets`, `modal-probe`/`modal-footer`, `restore-accounts`.
*   **Fix dark mode (el hallazgo grande)** — dos focos de fugas blancas, todo lo demás dark limpio (`src/styles/dark/screens.css`):
    *   `.gestion-personal-mobile-card` fijaba `background:var(--mc-blanco)` + nombre `--mc-verde-oscuro` sin variable puente → **200 tarjetas blancas** en dark (admin+rh/usuarios). Override a `--mc-superficie-card` + texto `--mc-texto-titulo/-secundario` (patrón `.dashboard-sucursal-rank-row`).
    *   `.mensajes-layout` + `.mensajes-composer` (media queries ≤768 de App.css) → blancos en dark; override acotado a ≤768 para no tocar el desktop (input ya cubierto).
*   **Tap targets reales ≥44px** (`src/styles/mobile-polish.css`, ≤768): `week-select-trigger`, `ai-engine-tab`, `ai-gen-btn`, `list-filter-input/select`, `table-search`, `mensajes-composer-input` y botón enviar (30–42px → 44). Se dejaron las filas de sucursal "Sin datos" (33px, no accionables).
*   **Modales vs tabbar (bug real de UX)**: el tabbar (`position:fixed`) tapaba los botones Guardar/Cancelar del modal — el overlay (`z-index:1000`) queda atrapado en el stacking-context de `.app-main`, por debajo del tabbar (`z:200`), así que subir z-index no basta. Fix: `body:has(.mc-modal-overlay) .mobile-tabbar { display:none }` (≤768) — oculta el tabbar con cualquier modal abierto (clase compartida cubre todos), reaparece al cerrar. + `max-height`/`padding-bottom` del modal respetan `env(safe-area-inset-bottom)`. Verificado E2E: Guardar ahora visible y clickeable.
*   **Área segura superior**: `.app-main` en móvil no incluía `safe-area-inset-top` → con `viewport-fit=cover` (PWA/notch) el header quedaba bajo la barra de estado. `padding-top: calc(14px + env(safe-area-inset-top))` (inofensivo en navegador sin notch).
*   **Densidad**: `.empleado-quick-card` en ≤480 pasó de `min-height:168` a `132` (el `meta{flex:1}` dejaba espacio muerto) — mismo diseño, menos scroll (ahora se ve la 4ª tarjeta de un vistazo).
*   **Verificación final**: cero overflow, **cero superficies blancas en dark**, todos los controles reales ≥44px, modales OK claro/oscuro, `npm run build` ✓. Cambio **puramente aditivo** (82 líneas, 0 borrados) en 2 archivos: `screens.css` + `mobile-polish.css`.

## 👤 Nuevas secciones: Mi perfil (4 roles) + Bolsa de trabajo RH (2026-07-03)

Pedido por dirección: (1) sección **Perfil** en los 4 roles con info propia + **cada quien sube/quita su propia foto** (antes solo admin/psicóloga desde Expedientes); solo la foto es editable, resto solo lectura; debe verse **premium**. (2) **Bolsa de trabajo** en RH (llegarán candidatos filtrados de otra app aún no lista) → mostrar **"en desarrollo"**.

*   **Migración `00000000000025_avatar_self_service.sql` — APLICADA a prod** ✅. Aditiva: `avatars_insert/update/delete_own` (storage, cada quien su `avatars/<id>.jpg` vía `current_usuario_id()`), `usuarios_update_own`, y se amplió el trigger `prevent_usuario_privilege_escalation` para **acotar el self-update a solo `avatar_url`** (un no-admin/rh sobre su fila no puede tocar username/inactivo/etc.). Registrada en el ledger `supabase_migrations.schema_migrations`.
    *   ⚠️ **Cómo se aplicó (importante para el futuro)**: el CLI `supabase db push` **falló** — el `pooler-url` guardado tiene password inválida (SASL 28P01) y el usuario **no tiene** la contraseña de BD. Se aplicó vía **Management API** `POST https://api.supabase.com/v1/projects/<ref>/database/query` con un **Personal Access Token** (`sbp_...`) en `Authorization: Bearer`. **Cloudflare devuelve 403 (error 1010) con el User-Agent de urllib** → hay que mandar un User-Agent de navegador. Esta vía **no necesita** la contraseña de BD, solo el PAT. project ref: `tpacyimxktipnkcgmhql`.
    *   🔐 **Rotar el PAT usado** (quedó en el historial del chat): supabase.com/dashboard/account/tokens.
*   **Frontend**:
    *   `src/components/common/Perfil.jsx` (compartido): hero premium con `Avatar` grande + subir/quitar foto (reusa `avatarService` + patrón de `ExpedienteIntegral`, con `user.id`; actualiza `setUser` **y** `setUsuarios` para reflejar en sidebar al instante) + grid de info solo lectura. Ruta `perfil` en los 4 layouts.
    *   `src/components/rh/BolsaTrabajo.jsx`: estado "en desarrollo" premium (badge ámbar + 3 pasos del flujo futuro). Ruta `bolsa` en HRLayout.
    *   `Sidebar.jsx`: navItems `perfil` (4 roles) + `bolsa` (rh); bloque de usuario del sidebar y de la hoja "Más" ahora **clickeable → /rol/perfil**.
    *   `Icon.jsx`: icono `briefcase` (lucide). Estilos premium en `App.css` (aditivo, superficies vía `.mc-card`, textos con variables puente, acentos teal, sin blancos fijos).
*   **Verificado**: E2E con Playwright — un **empleado sube y quita su propia foto** (valida la RLS self-service) ✓; prueba **negativa de seguridad**: como empleado, `avatar_url` permitido pero `username`/`inactivo` **BLOQUEADOS** por el trigger ✓; cero superficies blancas en dark en las pantallas nuevas; `npm run build` ✓ (a temp dir — ver nota dist). Cuentas restauradas a `emp123`+flag, Playwright desinstalado, scripts en scratchpad (no commiteados).
*   **⏳ PENDIENTE (mañana 2026-07-04+)**: **commit + push** de estos cambios (deploy Vercel). El código está **sin commitear** en el working tree: nuevos `Perfil.jsx`, `BolsaTrabajo.jsx`, migración 025; modificados `Sidebar.jsx`, 4 layouts, `Icon.jsx`, `App.css`. La migración YA está en prod, así que al desplegar el frontend el self-service funciona de inmediato.
*   **Nota `dist/`**: `dist/assets` volvió a quedar propiedad de **root** (residuo). Para build local: `sudo rm -rf dist`. No afecta el deploy (Vercel compila en su entorno).

## 🔑 Estado de cuentas al cierre (2026-07-02 tarde)

*   Temporal estándar: `emp123` + `debe_cambiar_password=true`. Entrar con `emp123` SIEMPRE fuerza cambio (blindaje AuthContext), aunque el flag esté apagado.
*   `mario` (admin) y `valeria alcaraz` (empleado): completaron el cambio forzado durante las pruebas del usuario — tienen contraseña personal, flag=false.
*   `maricruz izaguirre` (rh): `emp123` + flag=true (útil para sesiones admin/rh de prueba vía API).
*   `ana salas` (psicologa) y resto de empleados: `emp123` + flag=true.
*   `luz gomez`: contraseña propia previa a esta sesión, flag=false (legítimo).
*   **Nota (auditoría móvil 2026-07-02 noche 2 y features Perfil 2026-07-03)**: en ambas sesiones se usaron 4 cuentas (1 activa por rol, elegidas por la BD) con contraseña temporal de auditoría; al cierre se **restauraron a `emp123`+flag** vía service role. La cuenta empleado elegida (`kevin hopolito`) se usó para probar subir/quitar foto — quedó con `avatar_url=null` (sin foto) y `emp123`+flag. Si la cuenta admin elegida fue `mario`, ahora está en `emp123`+flag (entrar con `emp123` fuerza cambio).

---

## 🕒 Sistema de asistencia / checador — rama `feat/asistencia-checador` (hasta 2026-07-14)

> **ACTUALIZACIÓN 2026-07-15 — AUTORIZADO Y APLICADO A PRODUCCIÓN:** el usuario confirmó autorización ("ya autorizaron"). **Las migraciones 034–049 SE APLICARON A PRODUCCIÓN** (`tpacyimxktipnkcgmhql`) el 2026-07-15 vía **Management API + PAT** (mismo método que la 025; `supabase db push` sigue sin servir por password de pooler inválida). Ledger de prod ahora en **049 (49/49)**. Aplicación atómica por migración, verificada: 9 tablas nuevas (sucursales, horarios, asistencias, dispositivos, rostros, rostro_fotos, cotejo_intentos, ajustes, push_suscripciones), 2 funciones (distancia_metros, registrar_checada), 2 columnas en `permisos` (causa, fecha_fin). Script de rollback exacto generado por diff antes/después.
>
> **FRONTEND DESPLEGADO A PRODUCCIÓN 2026-07-15** ✅. `feat/asistencia-checador` mergeada a `main` (merge limpio, feat ya contenía el refactor CSS de prod/main) y empujada a `prod`+`origin`. `main` local se reconcilió con `prod/main` antes del merge (la "divergencia" era solo el nodo de merge del PR #10, sin contenido nuevo). Fix de `MiRostro.jsx` commiteado. **Deploy Ready y verificado**: app HTTP 200; funciones del checador (`checar`/`reto`/`enrolar-rostro`/`aprobar-rostro`/`suscribir-push`) responden **401 "Sesión inválida"** sin auth (vivas y correctas).
>
> **Dos baches del primer deploy (resueltos), para la próxima vez:**
> 1. **Funciones del cotejo > 250MB**: `onnxruntime-node` empaqueta binarios de 3 plataformas (~355MB). El `excludeFiles {darwin,win32}` de `vercel.json` **NO recorta** en la práctica (probado, bajó ~1MB). Se añadió `aprobar-rostro.js` a `vercel.json` (que faltaba) pero igual no bastó. **Solución aplicada: `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` en Vercel Production** (beta, el proyecto es elegible). Tradeoff pendiente: cold-start más lento; recortar binarios de verdad queda como optimización futura.
> 2. **`SUPABASE_SERVICE_ROLE_KEY` faltaba en Vercel** → `api/checar` daba 500. El checador la NECESITA (solo `service_role` llama a `registrar_checada`, security definer). Se subió la **service_role legacy de prod** (obtenida vía Management API `/api-keys`) a Vercel Production **SIN prefijo `VITE_`** (server-only, jamás al cliente) — decisión del usuario explícita. Esto **anula** la vieja nota "nunca subir service_role a Vercel" (incompatible con el checador).
>
> **Env vars de Vercel Production añadidas hoy**: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `VERCEL_SUPPORT_LARGE_FUNCTIONS`, `SUPABASE_SERVICE_ROLE_KEY`.
>
> **Pendiente aún (no bloquea que arranque, pero sí para operar de verdad):** (1) **geocercas** (25 sucursales lat/lng/radio); (2) **horarios reales** (Excel, pantalla "Importar horarios" ya desplegada); (3) **`CRON_SECRET`** en Vercel (purga de fotos); (4) **aviso de privacidad biométrica** (legal, ANTES de que alguien enrole su cara); (5) **probar B1 con cámara real** (foto impresa girada debe FALLAR); (6) **rotar el PAT de Supabase** (quedó en el chat).
>
> *(Histórico previo a 2026-07-15, ya superado): la restricción vigente era "no subimos nada a producción, hay que esperar autorización"; las migraciones estaban solo en el Supabase LOCAL.)*

### Qué es
Un checador de entradas/salidas con horarios, permisos, reportes, **verificación por foto + ubicación**, y **cotejo facial que bloquea** (no solo marca). Diseño **servidor-autoritativo**: la hora, la distancia y el match facial los decide Postgres/serverless, nunca el navegador. `registrar_checada()` es `security definer`, revocada de `authenticated`, solo la llama `service_role` vía `api/checar.js`.

### Migraciones (034–049, todas LOCAL-only)
- **034** sucursales (lat/lng/radio, geocercas) · **035** horarios (1 fila por empleado/día ISO; ausencia de fila = descanso) · **036** asistencias + `distancia_metros()` haversine + realtime · **037** storage `asistencias` (privado, 1MB) · **038** permisos: `causa` (catálogo cerrado) + `fecha_fin` · **039** salida según horario · **040** dispositivos (fingerprint) · **041** cotejo facial (`rostros`, huella `real[]`) · **042** autoenrolado (`estado` pendiente/aprobado/rechazado, `rostro_fotos`) · **043** cotejo bloqueante (`registrar_checada` revocada de authenticated; `cotejo_intentos`; `usa_lentes`) · **044** `ajustes.exigir_rostro` · **045** salida anticipada (margen 15min, jornada mínima 30min) · **046** retención (`foto_purgada`, `vence_en`).
- **Hoy (2026-07-14):** **047** calibración (`rostros.parecido_maximo/parecido_con`, `asistencias.liveness_score/reto_superado`, + GRANT que faltaba en `cotejo_intentos`) · **048** reto de movimiento (`rostros.reto_pendiente/reto_pedido_en`) · **049** `push_suscripciones`.

### Modelos de IA (server-only, en `api/models/`, Apache-2.0)
- **YuNet** (detección + 5 landmarks) + **SFace** (embedding 128-d). Alineado por transformación de similitud a la plantilla ArcFace es **obligatorio** (sin él, resultados INVERTIDOS). Umbral `UMBRAL_MISMA_PERSONA = 0.50` (calibrado con persona real + impostor; el de fábrica 0.363 dejó pasar un impostor por 0.003).
- **MiniFAS anti-spoofing** (`antispoof.onnx`, 626KB) — añadido hoy, **modo sombra**.
- ⚠️ **`sharp` NO estaba en `package.json`** — bug real encontrado hoy: el cotejo entero dependía de un paquete extraneous en `node_modules`; al instalar exceljs, npm lo podó y el checador quedó roto en un commit que no lo tocaba (en prod habría sido 500 en cada fichaje). Corregido (`fix(deps)`, commit `43f88bf`).

### Sesión 2026-07-14 — 6 commits (plan `optimized-napping-breeze.md`, orden D→C→B→A)
1. **`831aa36` D · Importar horarios desde Excel** — `src/utils/horariosImport.js` (puro, 41 tests) + `ImportarHorarios.jsx`. Mapea columnas, previsualiza, aplica solo lo válido; nunca mete un horario en la persona equivocada por un acento/apellido invertido (empareja con nivel de confianza; dos homónimos → rechaza, no elige). exceljs (MIT, no el `xlsx` de npm con prototype pollution), diferido y **fuera del precache PWA**. Verificado con un .xlsx real lleno de trampas.
2. **`43f88bf` fix sharp** (ver arriba).
3. **`29416c9` C · Calibración + detector de parecidos** — `src/utils/calibracion.js` (+14 tests) + `Calibracion.jsx` (RH/admin). **Se NIEGA a dar un "umbral óptimo"**: las dos nubes de scores están censuradas por el propio umbral (los que pasan van a `asistencias`, los que no a `cotejo_intentos`), así que el "hueco" es circular. Mide lo real: quién ficha raspando (mínimo, no promedio), cuánto costaría subir el umbral, y dice que bajarlo NO se puede medir. **Detector de parecidos** en `api/aprobar-rostro.js`: al aprobar, compara contra todas las caras y avisa si se parece demasiado a otra (marca EN LAS DOS fichas, el parecido es simétrico). Verificado por el endpoint real (hermana 0.451 marca a las dos, desconocido 0.048 no).
4. **`b9b957f` B1 · Reto de girar la cabeza** — `api/_pose.js` (+11 tests), `api/reto.js`. Una foto plana no tiene paralaje: al girarla, la nariz no se mueve respecto a los ojos. Se pide **al azar (1 de 5)**. Dos agujeros cerrados: (a) el reto **se queda pegado** hasta pasarlo (si re-sorteara, se esquiva reintentando); (b) la foto girada **también debe coincidir** con el titular (si no, enseñas la foto de otro y giras tu cabeza). El servidor juzga recalculando la pose; el navegador solo guía. La foto girada **no se guarda** (viaja en el body, se mira y se tira). Verificado contra Postgres: dado sale una vez, empleado no puede borrar su reto (RLS), checar sin foto girada → 403 y el reto sigue pegado.
5. **`0288de8` B2 · Anti-spoofing en modo sombra** — MiniFAS mide `liveness_score` y **NO BLOQUEA A NADIE**. Su 98.2% es sobre su dataset, no sobre esta clínica; como el cotejo sí bloquea, un falso positivo dejaría fuera a una persona real. Se activará cuando la pantalla de calibración muestre dos montañas con datos reales (2-3 semanas), con el interruptor de `ajustes`. Recorte 1.5× la caja (necesita ver el borde: marco del móvil, canto del papel). ~7ms el modelo, 28-32ms el análisis completo.
6. **`e7c6015` A · Notificaciones push** — Web Push + VAPID. `src/sw.js` (service worker propio; PWA pasó de `generateSW` a `injectManifest`), migración 049 `push_suscripciones` (**nadie la lee desde el navegador, ni su dueño**; solo service_role), `api/_push.js` (`enviar`/`enviarARH`, nunca lanza, limpia suscripciones muertas 404/410), `api/suscribir-push.js`, `api/aprobar-permiso.js` (**cambio de arquitectura**: la aprobación de permisos pasa al servidor para poder mandar el push), `src/services/pushService.js`, `AvisoPush.jsx` (onboarding iOS). El permiso se pide **tras la primera checada**, no al abrir. Notifica: rostro aprobado/rechazado→empleado, permiso→empleado, rostro registrado→RH, suplantación insistente→RH. Verificado contra Postgres (aprobación sobrevive sin push, tabla ilegible hasta para su dueño, no suscribe a otro, upsert no duplica).

### Sin commitear al cierre
- **`src/components/asistencia/MiRostro.jsx`** — fix de UI: la frase "Toma **3 fotos**... Se usarán **solo**..." se partía porque `.mc-hint` es flex y cada `<strong>` era un ítem suelto. Envuelto en un `<span>`. Pendiente de commit (esperando que el usuario cierre la revisión visual del checador).

### ⚠️ Claves VAPID (para cuando se autorice el deploy) — poner en Vercel (Production)
`.env.local` (gitignored) ya las tiene para dev. En Vercel: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (JAMÁS al repo/cliente), `VAPID_SUBJECT` (cambiar a un correo real de la clínica). Generadas con `web-push`; están en el historial del chat de esta sesión.

### 🔑 Dev apunta a Supabase LOCAL (gotcha que ya causó un "no me deja entrar")
`npm run dev` habla con `http://127.0.0.1:54321` porque **`.env.development.local` pisa a `.env.local`** en Vite (y `.env.local` sí apunta a prod). Es lo correcto para el checador (prod no tiene las migraciones). Pero en local **no existe la cuenta real** del dueño → login con credenciales de prod da "contraseña incorrecta". **Usuarios de prueba LOCALES** (username, todos con `checador123`, sin cambio forzado): `admin`, `rh`, `psico`, `ana`, `beto`, `caro`. Los scripts E2E cambian passwords de auth vía `auth.admin.updateUserById` — re-resetear si el login local falla. Para volver a prod en dev: comentar `VITE_SUPABASE_URL` de `.env.development.local` + reiniciar servidor (pero entonces el checador no funciona).

### ⏳ Pendientes al cierre
- **Aplicar migraciones 034–049 a producción** (esperando autorización del usuario).
- **Probar B1 con cámara real**: foto impresa girada debe FALLAR, persona real girando debe pasar (ese es EL test del anti-suplantación) — yo no puedo, necesita cámara.
- **Entrega real del push**: iPhone instalado en pantalla de inicio + VAPID en Vercel.
- **Commit del fix de MiRostro.jsx**.
- **openwiki/** desactualizado desde la migración 041 (modelo-de-datos.md se actualizó parcialmente 2026-07-14).
- **GRANTs faltantes en tablas 04–26** (deuda conocida): reconstruir la BD desde el repo da una app muerta.
- Capturar las 25 geocercas, cargar horarios reales (llegan en Excel), `CRON_SECRET` en Vercel, aviso de privacidad biométrica.

### Verificación de la sesión
294 tests (de 131 al empezar el checador), lint estable en la línea base (90 errores preexistentes), build verde en cada commit. Migraciones 047/048/049 aplicadas y verificadas contra Postgres local (RLS + GRANTs probados con roles reales). Scripts E2E `.mjs` temporales en la raíz, borrados tras cada uso (no commiteados) — mismo patrón que las sesiones anteriores.

---

## 🚀 Sesión 2026-07-17 — checador en operación: notificaciones, roles, push y pulido

Sesión larga de operación real sobre **producción** (ya no local-only). ~20 commits desplegados a `prod`+`origin`. Todas las migraciones aplicadas vía **Management API + PAT** (mismo método de siempre; `db push` sigue sin servir). Ledger de prod avanzó **058 → 067**.

### ⚠️ Hallazgo grave al arrancar: prod DB atrasada respecto a su código
`prod/main` traía los archivos de migración **059–062 sin aplicar** a la BD (ledger en 058). El pipeline de Vercel **sube código pero NO corre migraciones**. Se aplicaron 059–062 (incluida la **059 de seguridad**: cerraba hallazgos de auditoría RLS que estuvieron abiertos en prod desde el 16-jul) + las nuevas 063–067. **Deriva detectada**: varias policies existían aplicadas "a mano" sin registrar versión → se resolvió con `drop policy if exists` idempotente (sin editar los archivos canónicos). **Para el futuro: cada deploy hay que aplicar las migraciones pendientes a mano.**

### Migraciones nuevas (063–067) — todas en prod
- **063 `geocerca_bloqueante`**: geocerca ahora BLOQUEA (antes solo marcaba 'fuera'). `evaluar_ubicacion()` (fórmula única con margen de precisión, tope 100m) usada por `registrar_checada` y por `checar_ubicacion()` (pre-chequeo barato). Reglas (grilling): sin_gps bloquea, sin_geocerca pasa, cliente pre-chequea + servidor refuerza, bloqueo seco sin fila, chequeo ANTES del cotejo.
- **064 `notificaciones`**: tabla `notificaciones` (fila por destinatario, RLS dueño ve/marca, realtime). Fuente de verdad de la bandeja.
- **065 `avisos_notifican`**: trigger que al crear un aviso notifica a toda la plantilla (bandeja).
- **066 `psicologa_jefa_rh`**: psicóloga ⊇ RH. RLS `reportes_confidenciales` **quita a 'rh'** (solo admin+psicóloga). Triggers: solicitud permiso/vacaciones → rh+admin+psicóloga; reporte confidencial → psicóloga+admin (no rh).
- **067 `salida_libre_aviso`**: salida a **cualquier hora** después de la entrada (quitado el bloqueo por ventana de fin de turno; se conserva jornada mínima 30min). Si sale >30min antes de su hora → aviso "Salida anticipada" a gestión (bandeja).

### 🔔 Centro de notificaciones (campana + bandeja)
- **Camino único**: `api/_notificaciones.js` — `notificar()` (fila + push), `notificarGestion()` (fila por persona de gestión + push). Los ~7 endpoints que antes llamaban `enviar`/`enviarARH` ahora notifican.
- **Frontend**: `CampanaNotificaciones.jsx` (fija arriba-derecha, badge de no-leídos, dropdown, realtime), montada 1 vez en `App.jsx` para los 4 roles. `notificacionesService.js`. Purga 30/90 días en el cron.
- **Íconos por tipo**, `tiempoRelativo`, marcar-leída/todas.

### 📲 PUSH — dos bugs, ambos resueltos (era la queja principal)
1. **Claves VAPID no casaban**: se configuraron el 16-jul y las suscripciones quedaron atadas a claves viejas → nada llegaba. **Rotadas** con `web-push` (par nuevo que casa), las 3 env de Vercel actualizadas vía API, redeploy (clave nueva horneada en el bundle, verificado), suscripciones viejas purgadas. `refrescarSuscripcion()` re-suscribe a todos al reabrir.
2. **Fire-and-forget en serverless (el grande)**: los endpoints lanzaban `notificar().catch()` SIN await → en serverless la función se congela al responder y el push nunca se termina de enviar. **Fix: `await` antes de responder** en los 6 endpoints (aprobar-permiso/vacacion/rostro, enviar-mensaje, enrolar-rostro, checar). El botón de prueba SÍ llegaba porque él sí awaitea → así se diagnosticó.
- **Botón "Enviar notificación de prueba"** para cualquier usuario en **Mi Perfil** (se manda push a uno mismo, reporta `enviados: N`). Vive dentro de `suscribir-push` (acción `probar`) para no crear función nueva.

### ⚖️ Límite Vercel Hobby (12 funciones) — decisión de arquitectura
El proyecto está en **Hobby, tope 12 funciones serverless** (los `_*.js` no cuentan). Ya estábamos en 12. Por eso: **avisos, solicitudes de permiso/vacaciones, reporte confidencial y salida anticipada notifican vía TRIGGER de BD (bandeja, sin push)** — un trigger no puede firmar VAPID. Los eventos con endpoint (aprobación, mensaje, checada sospechosa) sí pushean. Si se quiere push en los de trigger → subir a Pro o liberar un slot y moverlo a `checar.js`/endpoint.

### 🐛 Bugs de prod corregidos (vistos en consola del usuario)
- **Foto de perfil "archivo inválido"**: la **CSP no permitía `blob:`** en `img-src` → `comprimirImagen` (que carga el File por `URL.createObjectURL`) disparaba `img.onerror`. Agregado `blob:` a `img-src` en `vercel.json`. Arregla también el preview del cotejo.
- **Permiso "llegar tarde" daba 400**: `addPermiso` mandaba `hora: ""` y Postgres rechaza cadena vacía para tipo `time`. Fix: `hora || null`.
- **Crash `getMonth is not a function`** en Cumpleaños/Aniversarios: `resolveFechaCumpleanos/Ingreso` devuelven STRING, no Date; `fechaEsteAnio` les llamaba `.getMonth()`. Fix: parsear el string ("MM-DD" e "YYYY-MM-DD"). **Lección: `vite build` NO valida las funciones de `api/` ni crashes de runtime — hay que abrir la página.**

### 💅 Lote de detalles UI
- **Login**: quitado el badge "Bienvenido" + ojo 👁 para ver contraseña.
- **Menú**: Vacaciones + Permisos agrupados en "Vacaciones y permisos"; solicitudes pendientes ordenadas arriba en PermisosRH/VacacionesRH.
- **Campana iPhone**: `env(safe-area-inset-top)` (antes quedaba bajo la barra de estado, no se podía pulsar).
- **Navbar móvil**: rediseñado a **pill flotante teal** (paleta de la app), se esconde al scroll abajo y vuelve al subir; indicador activo = **pastilla aqua como fondo del ícono** (antes una rayita descuadrada; el absolute peleaba con el centrado del flex).
- **Bug cambio de pestaña**: `.app-main` no volvía arriba al navegar → título fuera de cuadro. Fix: scroll-to-top en cada cambio de ruta (Sidebar useEffect sobre `location.pathname`).
- **Horarios**: filtro **por sucursal** (una a la vez, no ~100 empleados) + CSS del encabezado `asistencia-empleado-head` (no tenía).
- **Calendarios reales**: componente reutilizable `CalendarioMensual.jsx` (rejilla mensual, navegación, puntos por evento, día seleccionado). Usado en **Calendario General** (vacaciones/permisos/festivos) y **Cumpleaños y Aniversarios** (cumpleaños rojo, aniversario azul, + tarjeta "Próximo").
- **Checador cámara**: ya no se abre al entrar; "Registrar entrada/salida" ABRE la cámara, segundo botón "Tomar foto y registrar" captura.
- **Panel asistencia**: el **día en curso ya no cuenta como falta** (estado PENDIENTE hasta medianoche); puntualidad `null` → "Sin evaluar" en vez de 0% engañoso (migración de lógica en `utils/asistencia.js`, sin cambio de BD).
- **admin/rostros**: rediseño del cotejo (perfil vs fotos lado a lado). Sucursales geocerca radios 5–20m (mig 062).

### 🧹 Datos de prueba limpiados en prod
`permisos`, `vacaciones`, `asistencias`, `cotejo_intentos` → 0 (Reportes RH se alimenta de esas tablas, se limpió solo). Los calendarios se ven vacíos hasta que haya datos reales; cumpleaños/aniversarios sí salen (de las fechas de los empleados).

### 🔑 Estado operativo / pendientes
- **Geocercas**: solo **"Oficina Administrativa"** tiene geocerca (radio **10m** — muy justo para GPS de interior; el margen de 100m lo cubre casi siempre, pero valorar subirlo a ~50m). Las otras 24 sucursales sin geocerca → `sin_geocerca` (pasan). Con geocerca activa, quien **niegue el GPS ya NO puede fichar** (decisión del usuario, invierte el "GPS opcional" viejo).
- **🔐 ROTAR TOKENS usados esta sesión** (quedaron en el chat): PAT de Supabase (`sbp_...`) y **token de Vercel (`vcp_...`)** — este último se usó para leer env y rotar VAPID.
- **Env vars VAPID rotadas** en Vercel (valores nuevos, `sensitive`).
- Sigue en Hobby (12 funciones, crons ≤1/día). `dist/assets` sigue quedando de root a veces (`sudo rm -rf dist` antes de build local).
- Verificación: 302 tests ✓ al cierre, build verde en cada commit, migraciones probadas en local (smoke con roles reales) antes de aplicar a prod.
