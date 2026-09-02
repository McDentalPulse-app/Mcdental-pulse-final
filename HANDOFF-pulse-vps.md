# HANDOFF — McDental Pulse en VPS propia

> Para la próxima sesión de Claude. Última actualización: **2026-09-02**.
> Este archivo vive en dos lados y hay que mantenerlos iguales: `/opt/pulse/HANDOFF.md`
> (en la VPS) y `HANDOFF-pulse-vps.md` (en el repo del usuario). ⚠️ Pese a lo que decía esta
> misma línea antes: **sí está versionado** (confirmado con `git log`, commit `0e3b7f9` en
> adelante) — corregido el 2026-09-02, no repetir que no lo está.

> ## 🔴 LEER PRIMERO — cambios del 2026-09-02
>
> 1. **Admin+**: rol nuevo arriba de admin (hereda todo automático vía `current_role()`, único
>    que crea/borra/resetea/renombra cuentas admin/admin_plus), panel Módulos (interruptor por
>    rol y por persona, cualquier ítem del menú), api/ (9 archivos) reconociéndolo. Migraciones
>    138-150. Cuenta real: **"sistemas"**. Todo en producción, verificado con `claude-in-chrome`
>    contra el sitio real.
> 2. **Intercambios de festivos**: exclusividad por sucursal (no global) con Oficina
>    Administrativa totalmente exenta (alias legacy "Oficina Central"/"Central" incluidos).
>    Migración 151. Nuevo: elegir el festivo tocándolo en el calendario, no solo del
>    desplegable.
> 3. **`origin/vps-docker` tenía 10 commits desde el 4-5 de agosto que este checkout nunca
>    había recibido** — se descubrió recién al hacer `git push`, no antes. Ya mergeados
>    (commit `bfb226a`) y empujados a `origin` y `prod`. La lección que queda: **empujar
>    seguido**, no acumular una semana entera sin `git push` — ver `plan-sanear-sistema-sep2026.md`
>    y la regla nueva guardada en memoria (commit + push + bitácora por cada cambio real, no al
>    final de la sesión).
> 4. **`/opt/pulse/app` en la VPS tiene SU PROPIA historia git** (HEAD `f3e2257`, no existe en
>    ningún repo local ni remoto), con archivos sueltos modificados sin commitear. No causó daño
>    esta vez (todo lo que faltaba en el checkout local ya estaba ahí, incluidas migraciones
>    115-119 que **nunca se guardaron como archivo en ningún lado**, solo se aplicaron a mano),
>    pero es la tercera copia divergente de la historia — pendiente reconciliar, con el mismo
>    cuidado que el punto 3. Ver §11 y `plan-sanear-sistema-sep2026.md` §4.
> 5. **Corrección de un error propio**: en algún momento se dijo que "la vigilancia de
>    geocercas" no existía. Es falso — está en producción desde el 6 de agosto
>    (`plan-red-de-seguridad.md`). No repetir esa afirmación sin releer el código/los planes.
> 6. **Hallazgos reales sin resolver, con nombre y fecha** (sacados en vivo de `pulse-db`,
>    02-sep): respaldo externo sin latido desde el **29 de julio** (35 días — es la PC de
>    oficina, no código); 4 personas bloqueadas para fichar (Mariana Aguilar López lleva 19
>    días); 1 sin rostro aprobado (Hania Torres Peña). Detalle completo en
>    `plan-sanear-sistema-sep2026.md` §1-2.

> ## 🟡 SESIÓN DEL 2026-08-27 — bloqueo de entrada el viernes sin encuesta (sin deploy)
>
> Pedido del dueño, confirmado antes de tocar código: reemplaza el bloqueo de SALIDA el
> sábado (migración 082) por bloqueo de ENTRADA el viernes. Detalle completo en
> `contexto.md`, sesión 2026-08-27.
>
> - **Migración 128** (`bloqueo_entrada_viernes_sin_encuesta.sql`) — redefine
>   `registrar_checada` completa. **NO aplicada todavía a `pulse-db`** (VPS). Antes de
>   aplicarla: revisar que no haya quedado nadie a medio checar un sábado con la lógica
>   vieja (no debería, el guard viejo solo bloqueaba, nunca dejaba una fila a medias).
> - Cliente `src/components/asistencia/ChecadorEmpleado.jsx` tocado (`encuestaPendiente`
>   ahora mira viernes/entrada en vez de sábado/salida) — **NO reconstruido/desplegado**.
> - Para desplegar: seguir §4 (build + `docker compose up -d --build pulse-frontend`) y
>   aplicar la migración 128 contra `pulse-db` (ver §4 para el método con Python +
>   `str.replace` si hace falta, o `psql` directo dado que es una migración nueva y simple).
> - No probado en vivo contra un viernes real (se verificó el diff de la función letra por
>   letra contra la 127, pero no una checada real bloqueada/desbloqueada en producción).

> ## 🟡 SESIÓN DEL 2026-08-25 — catálogo de inventario cargado + mejoras UI (sin deploy)
>
> El usuario va a reiniciar la PC. Nada de esto se desplegó en la VPS todavía — **local ↔ VPS
> ahora divergen** (commit local sin subir + un INSERT que solo vive en `pulse-db`).
>
> **Hecho contra `pulse-db` (VPS, real, vía `ssh -i ~/.ssh/pulse_vps_key root@2.25.150.106`):**
> - Confirmado que las migraciones 120-123 del `plan-inventario-clinicas.md` **ya estaban
>   aplicadas** ahí (las 6 tablas + las 5 funciones existen). El repo local decía "sin
>   verificar" pero ya se había hecho en algún momento no documentado.
> - Insertados los **33 materiales** del Excel que pasó el dueño
>   (`~/Downloads/lista gral material ortondoncia bodega 2408.xlsx`, catálogo puro:
>   nombre+unidad, sin cantidades) en `public.materiales`. Verificado: `select count(*)` → 33.
> - `umbral_stock_bajo` de los 33 quedó en **5 parejo** (placeholder pedido por el dueño,
>   "ponle 5% mientras" — no hay valores reales por material). **Falta ajustarlo material por
>   material** cuando el dueño dé los números, desde Admin → Inventario → Catálogo.
> - Notificación de stock bajo (trigger `aplicar_movimiento_inventario`, migración 121) **ya
>   está cableada** — avisa a admin/bodega al cruzar el umbral hacia abajo. Confirmado leyendo
>   el SQL, **no probado en vivo** (no hay movimientos de inventario reales todavía).
> - Dato importante para la próxima sesión: **`.env.local` de este repo apunta a un proyecto
>   Supabase Cloud viejo (`tpacyimxktipnkcgmhql`)**, que NO es la base real. La base real es
>   `pulse-db` en la VPS (self-hosted, `mcdentalpulse.duckdns.org`). El cloud es un resto de
>   antes de la migración del 31-jul — no confundirlo otra vez.
>
> **Hecho en el repo local (rama `vps-docker`), NO desplegado en la VPS:**
> Mejoras de UI a las 3 pantallas de inventario, a pedido del dueño ("mejorar las interfaces
> de los stocks y la forma en la que se pide, más intuitivo"):
> 1. `src/components/inventario/StockBar.jsx` (nuevo) — barra de nivel de stock vs. umbral
>    (verde/amarillo/rojo + texto, no depende solo del color), reemplaza el pill binario
>    "Stock bajo" en `InventarioClinica`, `InventarioAdmin` ("Stock por clínica") y
>    `BodegaPanel` (comparación pedido vs. stock de la clínica).
> 2. Listas de stock ordenadas con "stock bajo" primero (`InventarioClinica`,
>    `InventarioAdmin`).
> 3. `InventarioClinica.jsx`: **Consumo y Ajuste fusionados** en una sola card
>    "Movimiento de stock" con toggle (reusa el patrón `cal-toggle` que ya existía en
>    `CalendarioMensual.jsx` — cero CSS nueva para el toggle). Antes eran 2 `<Card>` casi
>    idénticas apiladas.
> 4. `inputMode="decimal"` en todos los inputs de cantidad de las 3 pantallas (teclado
>    numérico en celular).
> - **Decisión tomada al investigar antes de construir**: el componente `Select.jsx` propio
>   ya tenía buscador por prefijo (escribir salta a la opción, como un `<select>` nativo) y
>   posicionamiento ya arreglado (commits `3ebc449`/`96915fb`). Por eso **no se construyó un
>   combobox nuevo** — habría duplicado algo que ya funcionaba bien. La opción 1 del reporte
>   ("buscador") quedó cubierta por eso + el reordenamiento de listas, no por un componente
>   nuevo.
> - Verificado: `npx eslint` (0 errores en los 4 archivos), `npx vitest run` (512/512),
>   `npm run build` (compila). **NO verificado en navegador** — quedó pendiente porque el
>   usuario va a reiniciar la PC. Falta abrir `InventarioClinica`, `InventarioAdmin` y
>   `BodegaPanel` en Chrome (local `npm run dev` o, tras desplegar, contra la VPS) y probar el
>   toggle Consumo/Ajuste, la barra de stock con datos reales, y que el orden "bajo primero"
>   se vea bien.
> - **Sin commitear.** Cuando se retome: revisar `git status`/`git diff` de
>   `src/components/inventario/*.jsx`, `src/components/inventario/StockBar.jsx` (nuevo),
>   `src/App.css` antes de commitear — nadie lo pidió explícitamente todavía.
>
> **Pendientes para cuando el dueño dé los datos:**
> - Cantidades reales de stock por clínica (el Excel no las traía) — cargar con
>   `ajustar_inventario` por sucursal+material, o pedirle un Excel con esa columna.
> - Umbrales de stock bajo reales por material (hoy todos en 5).
>
> **Opciones del reporte de UX que quedaron pendientes (no pedidas todavía):** pedido tipo
> carrito desde la lista de stock bajo, vista agrupada en vez de tabla plana en
> "Stock por clínica" cuando el filtro es "Todas" (hoy puede listar hasta 858 filas sin
> paginar: 33 materiales × 26 clínicas), cola de pedidos en Bodega ordenada por antigüedad.

> ## 🟢 SESIÓN DEL 2026-07-31 (noche) — tres cambios en producción
>
> Todo se hizo y desplegó directo en la VPS. Commits: `1042100`, `d47b002`, `dc3d4e3`.
> Migraciones **102 y 103 aplicadas** a `pulse-db`. Frontend reconstruido dos veces.
>
> 1. **La psicóloga no veía las fotos de los rostros.** La migración 052 le dio SELECT
>    sobre `rostros` pero se saltó `rostro_fotos` y el SELECT del bucket `rostros` en
>    storage. Veía 38 filas y **cero** fotos; el admin veía 152. Migración 102 lo cierra.
>    ⚠️ Queda una pregunta abierta para el dueño: **si alguien aprobó rostros desde la
>    cuenta de la psicóloga mientras estuvo roto, los aprobó a ciegas** — la pantalla
>    dejaba pulsar «aprobar» sin foto a la vista. Nadie ha revisado cuáles.
>
> 2. **El cambio de contraseña funcionaba pero la app decía que no.** `auth.updateUser()`
>    emite `USER_UPDATED`, que disparaba `cargarPerfil`; ese SELECT salía antes de que
>    `mark_password_changed` apagara el flag y a veces llegaba después, resucitando el
>    panel de «cambia tu contraseña» con la contraseña **ya cambiada**. La persona creía
>    que había fallado, la reescribía igual → `422 same_password` → se rendía y volvía a
>    entrar con `emp123`, que ya no existía. Arreglado ignorando `USER_UPDATED` y tratando
>    `same_password` como éxito. Detalle en §8.
>
> 3. **Recepción ya puede fijar la geocerca de su clínica** desde el teléfono, sin viajar
>    a las 25 clínicas. Detalle y **riesgo operativo** en §9. Léelo antes de tocar nada de
>    geocercas: una mal puesta deja a una clínica entera sin poder fichar.
>
> **No documentado hasta hoy:** en esta VPS corre también un stack de **Jitsi**
> (`jitsi-web`, `jitsi-jvb`, `jitsi-jicofo`, `jitsi-prosody`, `jitsi-coturn`), levantado
> ~2026-07-28. No se investigó de quién es ni qué lo usa. **Preguntar antes de tocarlo.**

> ## 🔴 LEER PRIMERO — cambios del 2026-07-31
>
> 1. **El usuario migró a una PC nueva.** La vieja (`100.92.81.83`) **ya no responde**
>    (`Connection timed out`, verificado el 2026-07-31 por la tarde). Ver §1.
> 2. **`main` de `McDentalPulse-app/Mcdental-pulse-final` YA NO es la versión de Vercel.**
>    Se sobrescribió con la versión de la VPS por force-push, a pedido explícito del
>    usuario ("ya no ocupamos la versión de vercel"). Esto **revierte** la regla de §4.5
>    que decía «Nunca». La historia anterior NO se perdió: está en el tag
>    `respaldo-main-vercel-20260731` (187 commits, publicado en ese mismo remoto).
> 3. **`origin` (`MCDentalSist/MCDentalPulseBackUp`) TAMBIÉN se sobrescribió**, más tarde
>    ese mismo día ("lo importante es tener un backup en github, forza el push"). El tag
>    `respaldo-main-vercel-20260731` se publicó **antes** también en ese remoto y se
>    verificó ahí antes de forzar.
> 4. **Los cinco punteros están en `f1a27e7`**: VPS, `origin/main`, `origin/vps-docker`,
>    `prod/main` y el repo local del usuario. Verificado con `git ls-remote` contra cada
>    remoto, no por lo que decía el repo local.
> 5. Cualquier clon anterior de **cualquiera de los dos repos** va a fallar al hacer
>    `pull`. Se arregla con `git fetch && git reset --hard origin/main`.
> 6. **El token de `gh` de la PC nueva estaba inválido** y hubo que re-autenticar a mano
>    (ver §5). Si un push a GitHub falla con `could not read Username`, es eso.

---

## 1. Cómo entrar

La migración copió `~/.ssh` completo, así que las dos máquinas quedaron con la llave.
La PC nueva llega al VPS **en un solo salto**, verificado el 2026-07-31:

| Máquina | IP Tailscale | Estado |
|---|---|---|
| PC nueva (la que usa ahora) | `100.94.136.116` | activa — **usar esta** |
| PC vieja (`helminth` histórico) | `100.92.81.83` | **no responde** desde el 2026-07-31 |

⚠️ La PC vieja ya no es alcanzable por Tailscale, pero eso **no es lo mismo que estar
dada de baja de forma segura**: mientras exista su disco, tiene la llave privada sin
passphrase y `pulse-password-temporal.xlsx`. Sigue pendiente (§6).

```bash
# si YA estás corriendo dentro de cualquiera de las dos: un solo salto
ssh root@2.25.150.106 'docker ps'
scp archivo root@2.25.150.106:/ruta

# desde fuera: dos saltos (ojo con el -n, ver trampa abajo)
ssh helminth@100.94.136.116 "ssh -n root@2.25.150.106 'docker ps'"
```

⚠️ **La llave no tiene passphrase**, así que funciona de forma no interactiva. Eso
también significa que quien tenga el archivo entra al VPS como root: cuando se dé de
baja la PC vieja, hay que borrar su `~/.ssh` de forma segura.

⚠️ **Trampa del doble salto:** un `ssh` anidado dentro de un heredoc se come el resto
del script. Usá `ssh -n` en el salto interno.

**Copiar archivos = dos saltos también** (no hay ProxyJump configurado):

```bash
scp archivo.jsx helminth@100.92.81.83:/tmp/
ssh helminth@100.92.81.83 'scp /tmp/archivo.jsx root@2.25.150.106:/ruta/destino && rm /tmp/archivo.jsx'
```

### ⚠️ Trampas de shell que te van a morder
- **La máquina del usuario usa `fish`**, no bash. `VAR=$(...)`, `for...done`, `$?` y
  `${#VAR}` fallan. Si necesitás lógica de shell, **escribí un `.sh` o `.py` y subilo**,
  no lo pongas inline.
- `helminth` usa `fish` también. La VPS (`root@2.25.150.106`) sí usa **bash**.
- Para editar archivos grandes en la VPS: bajarlos, editarlos local, subirlos. O subir un
  script Python que haga un `str.replace` con `assert` de que encontró el patrón (usé
  mucho ese patrón, es seguro y verificable).

---

## 2. Qué hay corriendo en esta VPS

**DOS proyectos independientes**, cada uno con su stack completo de Supabase self-hosted:

| | Dentra (ajeno a este trabajo) | **Pulse** (lo nuestro) |
|---|---|---|
| Carpeta | `/opt/dentra/dentra-supabase` | `/opt/pulse/pulse-supabase/supabase-project` |
| Contenedores | `supabase-*` | `pulse-*` |
| Postgres | 127.0.0.1:5432 | **127.0.0.1:5433** |
| Pooler | 6543 | **6544** |
| Kong (API) | 8000 / 8443 | **8010 / 8453** |

Además, de Pulse:
- `pulse-frontend` → 127.0.0.1:3080 (nginx sirviendo el build de Vite)
- `pulse-api-server` → 127.0.0.1:3001 (wrapper Express de `api/*.js`)

### 🚨 LA TRAMPA MÁS CARA (ya rompió Dentra dos veces)
El `docker-compose.yml` oficial de Supabase trae **`name: supabase` hardcodeado**. Docker
identifica proyectos por ese nombre, NO por la carpeta. Dos instalaciones con el mismo
nombre **se roban los contenedores entre sí**.

Está resuelto con `COMPOSE_PROJECT_NAME=pulse` en el `.env` de Pulse. **Si agregás un
tercer proyecto, ponéle su propio `COMPOSE_PROJECT_NAME` ANTES del primer `up`**, y
verificá con `docker compose config --format json | head` que el campo `name` es único.

Trampa hermana: `volumes/api/kong.yml` referencia a Realtime por su `container_name`
histórico (`realtime-dev.supabase-realtime`), no por el nombre de servicio. Por eso el
compose de Pulse le pone un **alias de red** con ese nombre. Si Realtime deja de resolver
(`503 name resolution failed` solo en `/realtime/v1/websocket`), es esto.

---

## 3. Estado actual del proyecto

### Vercel queda fuera (decisión del usuario, 2026-07-31)
El usuario declaró: *"ya no ocupamos la versión de vercel, es mejor subir ahí lo que ya
estamos trabajando en el vps"*. Por eso `main` del repo `prod` ahora es la versión de la VPS.

⚠️ **Lo que NO está verificado:** que el corte operativo se haya ejecutado (DNS movido,
empleados usando el dominio de la VPS, Vercel apagado). Lo único confirmado es la
decisión y el cambio en el repo. **Antes de asumir que Vercel está muerto, preguntá.**

### La VPS es una copia paralela completa y funcional
`https://mcdentalpulse.duckdns.org` (DuckDNS → A record a 2.25.150.106, TLS de Let's
Encrypt con renovación automática vía certbot).

Datos reales migrados el 2026-07-25 (102 usuarios, 15 rostros, 52 encuestas, 197 objetos
de storage). **Los hashes de contraseña son idénticos a producción** — la gente entra con
su contraseña de siempre.

### `/opt/pulse/app` ahora ES la fuente de verdad (resuelto el 2026-07-31)
Entre el 2026-07-25 y el 2026-07-31 el trabajo de UI se hizo **directo en
`/opt/pulse/app`**, y el repo local quedó divergente. **Eso ya se resolvió:** el árbol de
la VPS se publicó como `main` del repo `prod`.

Estado del cotejo al hacerlo (medido, no estimado):
- **Ningún ancestro común** entre las dos historias — el repo de la VPS se inició de cero.
- El árbol de la VPS es **superconjunto** del anterior: 403 archivos vs 326.
- Único archivo que existía antes y no en la VPS: **`.env.example`**. Recuperable con
  `git checkout respaldo-main-vercel-20260731 -- .env.example`.
- Diferencia de árbol: 138 archivos, +13.247 / −993 líneas.

### El repo local quedó en paridad total (2026-07-31, tarde)
Ya **no hay nada que exista solo en `/opt/pulse/app`**. Se cotejó archivo por archivo con
`md5sum` de los 403 archivos versionados de cada lado: **403 comunes, 403 idénticos, 0
distintos**. Los `Dockerfile.*`, `nginx.frontend.conf` y `server.js` que antes andaban
sueltos ahora están versionados (venían en el árbol de la VPS).

Cómo se hizo (por si hay que repetirlo en otra máquina) — **`git pull` NO sirve**, las
historias no tienen ancestro común y falla:

```bash
git branch respaldo-vercel-20260731        # red de seguridad al 29bc64e
git fetch prod
git reset --hard prod/main
git branch --set-upstream-to=prod/main main
```

Ese último paso importa: `main` seguía rastreando `origin/main` y git lo reportaba como
*"ahead 35, behind 187"*. Un `git pull` a secas habría intentado fusionar las dos historias.

Lo único que se descartó a propósito: un `vercel.json` local, sin commitear, que tenía un
redirect `/(.*)` → `https://mcdentalpulse.duckdns.org/$1` y los `crons` borrados. Era
preparación del corte de Vercel y el usuario confirmó que ya no aplica ("ya no trabajamos
con vercel").

### Decisión de producto importante: NADA SE BORRA
El usuario eligió explícitamente **archivar en vez de borrar**. El botón de baja ofrece
*Desactivar* (sigue en la lista, no entra) o *Archivar* (desaparece de la lista, no entra,
**restaurable** desde el filtro «Archivados»). Restaurar devuelve al empleado como
**Inactivo**, nunca activo — recuperar un error no debe re-otorgar acceso solo.

`eliminarUsuario()` (borrado real en cascada) sigue en el código y su Edge Function
desplegada, pero **NO está conectada a ningún botón**. No la vuelvas a cablear sin
preguntar.

---

## 4. Cómo desplegar un cambio

### Frontend (React/CSS)
```bash
# 1. editar en /opt/pulse/app/src/...
# 2. verificar
cd /opt/pulse/app && npx eslint <archivos> && npx vitest run
# 3. rebuild + redeploy (el ANON_KEY se hornea en el bundle)
ENV_FILE=/opt/pulse/pulse-supabase/supabase-project/.env
ANON_KEY=$(grep "^ANON_KEY=" "$ENV_FILE" | cut -d= -f2-)
cd /opt/pulse/app
docker build -f Dockerfile.frontend \
  --build-arg VITE_SUPABASE_URL=https://mcdentalpulse.duckdns.org \
  --build-arg VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
  -t pulse-frontend:latest .
docker rm -f pulse-frontend
docker run -d --name pulse-frontend --network pulse_default \
  -p 127.0.0.1:3080:80 --restart unless-stopped pulse-frontend:latest
```

### 🚨 El service worker (PWA) cachea — vas a creer que tu cambio no se aplicó
Después de redeployar, en el navegador aparece un aviso **"Hay una versión nueva de la
app · Actualizar"**. **Hay que hacer clic en «Actualizar»** o vas a seguir viendo la
versión vieja y a volverte loco. Un F5 normal NO alcanza.

### Migraciones SQL
```bash
docker exec -i pulse-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < /opt/pulse/app/supabase/migrations/000000000000XX_nombre.sql
```
Ojo: para tocar el schema `auth` hay que conectarse como `supabase_admin`, no `postgres`
(el rol `postgres` de Supabase no es superusuario).

### Edge Functions
```bash
cp -r /opt/pulse/app/supabase/functions/<nombre> \
      /opt/pulse/pulse-supabase/supabase-project/volumes/functions/
docker restart pulse-edge-functions
```

### Comprobaciones rápidas
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://mcdentalpulse.duckdns.org/          # 200
curl -sS -o /dev/null -w "%{http_code}\n" https://mcdentalpulse.duckdns.org/rest/v1/ -H "apikey: x"  # 401
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://mcdentalpulse.duckdns.org/realtime/v1/websocket?apikey=<ANON_KEY>&vsn=1.0.0"  # 101
```
El WebSocket hay que probarlo **explícitamente**: `/rest` y `/auth` pueden andar perfecto
con Realtime roto.

---

## 4.5 Control de versiones y respaldo (desde 2026-07-25)

`/opt/pulse/app` **ya es un repo git** (antes era un montón de archivos sueltos sin
historial ni rollback). Rama **`vps-docker`**, primer commit `6713cc9` con el árbol
desplegado tal cual estaba.

```bash
# en la VPS, después de cada tanda de cambios
cd /opt/pulse/app
git status --short
git add -A && git commit -m "..."
```

Detalles que hay que saber:
- Los archivos son de **uid 1000** (residuo del `tar` con que se copió el árbol), así que
  git los ve como *dubious ownership*. Ya está la excepción puesta
  (`git config --global --add safe.directory /opt/pulse/app`); si aparece ese error en otra
  ruta, es lo mismo.
- `.gitignore` ya cubre los cuatro `.env*`, `node_modules` y `dist`. **Verificado** que el
  commit inicial no llevó ningún secreto. Si agregás archivos nuevos con llaves, revisá
  `git diff --cached --name-only` antes de commitear.
- `contexto.md` de acá es una **copia** del que vive en el repo de `helminth` — los dos
  pueden divergir. `temp.txt` (copia vieja de `App.jsx`) quedó versionado por inercia.

### Respaldo a GitHub — la VPS no tiene credenciales
El respaldo pasa por la PC del usuario, autenticada como `MCDentalSist`. Ahí
vive un clon permanente con dos remotos: `origin` = la VPS por SSH,
`backup` = `MCDentalSist/MCDentalPulseBackUp`.

⚠️ **La autenticación de GitHub NO sobrevivió la migración.** El 2026-07-31 el token de
`gh` en la PC nueva estaba inválido y hubo que correr `gh auth login -h github.com` a
mano. Diagnóstico rápido cuando pasa: `prod` (público) se lee sin credenciales pero
`origin` (privado) tira `could not read Username`. La llave `~/.ssh/id_ed25519` **no
está registrada en GitHub** — no sirve de alternativa, el push va por HTTPS.

⚠️ **La ruta cambió en la PC nueva** (reorganización del 2026-07-31):

| Máquina | Ruta del espejo |
|---|---|
| PC nueva (`100.94.136.116`) | `~/pulse/pulse-vps-mirror` |
| PC vieja (`100.92.81.83`) | `~/pulse-vps-mirror` |

```bash
# después de commitear en la VPS (ajustá la ruta según la máquina)
git -C ~/pulse/pulse-vps-mirror fetch origin
git -C ~/pulse/pulse-vps-mirror push backup origin/vps-docker:vps-docker
```

### 🔴 La regla «nunca al main» quedó REVERTIDA el 2026-07-31
La versión anterior de este documento decía que jamás había que empujar la VPS al `main`
de GitHub, porque exigiría un force-push sobre la historia de producción/Vercel.
**El usuario decidió lo contrario** y se ejecutó así:

- Se sobrescribió `main` en **`prod`** (`McDentalPulse-app/Mcdental-pulse-final`) por la
  mañana, y en **`origin`** (`MCDentalSist/MCDentalPulseBackUp`) por la tarde. En los dos
  casos con `--force-with-lease` anclado al SHA `29bc64e`.
- **Antes de cada uno** se publicó el tag `respaldo-main-vercel-20260731` → `29bc64e`, que
  preserva los 187 commits de la era Vercel, y **se verificó en el remoto** con
  `git ls-remote --tags` antes de forzar. El riesgo que describía la regla vieja está
  cubierto: la historia no se perdió, solo dejó de ser `main`.
- La historia de Vercel vive hoy en tres lados: el tag en ambos remotos, y la rama local
  `respaldo-vercel-20260731` en el repo del usuario.

Lo que sigue vigente: **no fuerces nada sin tag de respaldo previo y sin confirmación
explícita del usuario.** El patrón usado (tag → verificar en el remoto → `--force-with-lease`)
es el que hay que repetir.

---

## 5. Credenciales — DÓNDE ESTÁN (no están en este archivo, a propósito)

| Qué | Dónde conseguirlo |
|---|---|
| Llaves de **Pulse self-hosted** (ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET, POSTGRES_PASSWORD) | `/opt/pulse/pulse-supabase/supabase-project/.env` en la VPS. **Es el único lugar donde existen** — si se pierde la VPS sin backup de ese archivo hay que regenerarlas. |
| `CRON_SECRET` de Pulse | `/opt/pulse/.cron_secret` en la VPS |
| **PAT de Supabase Cloud** (`sbp_...`) | Pedírselo al usuario. **Lo rota todos los días**, cualquiera que esté anotado ya no sirve. |
| **service_role de Supabase Cloud** (JWT `eyJ...`) | Dashboard de Supabase → Project Settings → **API Keys** (proyecto `tpacyimxktipnkcgmhql`). Ojo: en Vercel está marcada *Sensitive*, así que `vercel env pull` **la trae vacía**. |
| Token de **DuckDNS** | Cuenta del usuario en duckdns.org (subdominio `mcdentalpulse`). Solo hace falta si cambia la IP. |
| Vercel | `npx vercel` ya está autenticado en `helminth` como `mcdentalpulse-app`. **Ya no se usa** (decisión del 2026-07-31). |
| **GitHub** | `gh auth login -h github.com` en la PC del usuario, cuenta `MCDentalSist`. El token vive en el keyring, **no sobrevivió la migración de PC** y hubo que rehacerlo el 2026-07-31. Scopes que quedaron: `gist`, `read:org`, `repo`, `workflow`. |

**Regla que seguí:** los secretos nunca se escriben en archivos del repo ni en documentos.
Se leen del `.env` en el momento de usarlos y los temporales se borran al terminar.

---

## 6. Qué falta / próximos pasos

1. **Corte real a la VPS** — sigue pendiente de ejecutar/confirmar. El usuario ya dijo que
   Vercel queda fuera y el repo ya refleja la VPS, pero **no está verificado** que se haya
   movido el dominio de los empleados ni apagado Vercel. Requiere: confirmar login real →
   mover el dominio → dejar Supabase Cloud unos días como rollback antes de tocarlo.
2. ~~Decidir qué pasa con el diff `/opt/pulse/app` ↔ repo local~~ → **RESUELTO 2026-07-31**:
   la VPS es la fuente de verdad, es `main` en los dos remotos, y el repo local quedó en
   paridad exacta (403/403 archivos idénticos).
3. ~~Los `Dockerfile.*` / `server.js` sin commitear~~ → **RESUELTO 2026-07-31**: quedaron
   versionados al alinear el local con el árbol de la VPS.
4. `contexto.md` del repo tiene el historial largo del proyecto — vale la pena leerlo
   antes de tocar el checador/asistencia, tiene decisiones no obvias (cotejo facial,
   umbrales, anti-spoofing).
5. **Avisar al equipo de la reescritura de `main`** — ahora aplica a **los dos** repos
   (`Mcdental-pulse-final` y `MCDentalPulseBackUp`). Cualquier clon previo va a fallar al
   hacer `pull` hasta que corra `git fetch && git reset --hard origin/main`.
6. ~~Decidir si `origin` (`MCDentalPulseBackUp`) también se alinea~~ → **RESUELTO
   2026-07-31**: se alineó por pedido explícito del usuario, con el tag publicado y
   verificado en ese remoto antes de forzar.
6b. **Ramas viejas de la era Vercel sin revisar** en ambos remotos:
   `feat/rediseno-asistencia-y-pulido-ui`, `css/tailwind-dark-mode`,
   `auditoria/seguridad-y-score-nulo`, `develop`. Nadie las tocó. Antes de borrar
   ninguna hay que revisarlas una por una — puede haber trabajo no fusionado.
7. **Borrado seguro de la PC vieja** (`100.92.81.83`): tiene la llave privada sin
   passphrase y `pulse-password-temporal.xlsx`.

## 7. Cómo trabaja el usuario (para no chocar)

- Habla español, prefiere respuestas directas y sin vueltas.
- **Quiere que las cosas se verifiquen de verdad**, no que se afirme que funcionan. Yo
  probé cada cambio en vivo con `claude-in-chrome` contra `mcdentalpulse.duckdns.org`.
  Hay una sesión de admin abierta en su navegador — sirve para verificar las pantallas de
  admin/RH/psicóloga.
- Cuando algo tiene una decisión de producto detrás (borrar vs archivar, autogenerar vs
  validar), **preguntá antes** con opciones concretas. Respondió bien a eso.
- Es dueño de una clínica con ~100 empleados reales fichando entrada/salida con
  reconocimiento facial todos los días. Los errores acá tienen consecuencias reales.


## 8. Contraseñas: la trampa que dejó gente fuera (2026-07-31)

Los usuarios nuevos del 2026-07-30 «no podían entrar tras cambiar `emp123`». La contraseña
**sí se cambiaba siempre** — lo que fallaba era la pantalla. Ya está arreglado (`d47b002`),
pero quedan dos cosas que saber:

- **Diagnóstico rápido si vuelve a pasar algo así:** los logs de GoTrue lo cuentan solo.
  `docker logs pulse-auth --since 3h 2>&1 | grep -iE 'status=4|error_code'`. Buscar
  `same_password` (la persona reescribió la misma, o sea que la anterior sí funcionó) y
  `invalid_credentials` justo después (volvió a `emp123`).
- **Para saber quién tiene qué contraseña** sin verla, comparando contra el hash:

```bash
docker exec -i pulse-db psql -U supabase_admin -d postgres -c \
"select u.username, case when a.encrypted_password = crypt('emp123', a.encrypted_password)
        then 'sigue en emp123' else 'ya tiene la suya' end
   from public.usuarios u join auth.users a on a.id=u.auth_user_id
  where not u.inactivo order by 2,1;"
```

A quien salga «ya tiene la suya» **no hay que restablecerle nada**: su contraseña funciona,
solo cree que no. Al 2026-07-31 seguían sin entrar nunca: `alicia.ramirez`,
`conrado.galvan`, `merie.perez`.

## 9. Geocercas: quién puede ponerlas y por qué hay que tener cuidado

**🚨 Lo primero:** estar `fuera` **BLOQUEA** la checada (403 en `api/checar.js`, botón
deshabilitado en `ChecadorEmpleado.jsx`). Una geocerca mal puesta no es un dato feo: es una
clínica entera sin poder fichar a las ocho de la mañana. `sin_geocerca` **no** bloquea.

Estado al 2026-07-31: **26 sucursales, solo la Oficina Administrativa tiene geocerca**.
Las 25 clínicas están en `sin_geocerca` con radio 150 m.

Desde `dc3d4e3` (migración 103) **cada recepcionista fija la de su clínica** desde el
teléfono: menú → Asistencia → «Ubicación de mi clínica».

- El permiso es `usuarios.puede_ubicar_sucursal` (booleano). Se otorgó a las 26
  recepcionistas activas. **No** se colgó del texto de `puesto`, que tenía tres grafías
  (se normalizaron a `Recepcionista` en la misma migración).
- Escribe por la RPC `fijar_geocerca_mi_sucursal(lat, lng, precision)`, `security definer`.
  **No recibe id de sucursal**: la resuelve del propio usuario, así que no hay forma de
  nombrar una ajena. Rechaza precisión peor que 100 m. No toca el radio.
- Los triggers `sellar_geocerca` y `log_geocerca` rellenan solos quién/cuándo y escriben en
  `sucursal_geocerca_log`, venga el cambio de admin o de recepción. No hay que acordarse.
- **Freno de emergencia:** botón «Quitar ubicación» en la pantalla de Sucursales del admin.
  Devuelve la clínica a `sin_geocerca` y todos vuelven a poder fichar. Es la primera
  reacción correcta si una clínica empieza a rebotar a su propia gente.

**Dato medido, útil si algún día hay que auditar una geocerca:** con las 194 checadas de la
Oficina, la **mediana** de sus coordenadas cae a **6 m** del punto capturado a mano (p90 =
12 m). O sea que las checadas ya registradas sirven para verificar si una geocerca está
bien puesta. La precisión del GPS en esta app es buena: mediana 11 m, 98% ≤ 50 m.

⚠️ **Lo que NO existe todavía:** un aviso automático cuando una geocerca está bloqueando
gente. Y ojo con el punto ciego: una checada bloqueada **no deja fila en `asistencias`**, así
que el síntoma no es «muchas fuera», es **silencio** — una clínica que fichaba y de pronto
deja de aparecer. Ver §10.

## 10. Qué falta (además de lo de §6)

- ~~Vigilancia de geocercas~~ → **HECHO el 2026-08-06**, ver `plan-red-de-seguridad.md`.
  `revisar_geocercas()` (mig. 104) + `personas_que_dejaron_de_fichar()` (mig. 116, ⚠️ el
  archivo de esa migración **nunca se guardó en ningún repo**, solo se aplicó a mano — igual
  que 115, 117, 118, 119). No repetir que esto falta sin releer el código primero.
- **Revisar los rostros aprobados por la psicóloga** mientras no veía las fotos (§ bloque
  del principio). Sigue sin revisarse al 2026-09-02.
- **El stack de Jitsi** — ya no es un misterio: lo usa "Reuniones" (`api/crear-reunion.js`,
  `PaginaReuniones.jsx`, migraciones 090-091). Sigue sin documentar en `infra/README.md`.
- **Lista completa y con nombres de lo pendiente real, al 2026-09-02**: ver
  `plan-sanear-sistema-sep2026.md` (respaldo externo, personas bloqueadas para fichar, la
  tercera copia de historia git en `/opt/pulse/app`, la PC vieja, deuda técnica menor).
