# Plan — Inventario por clínica, pedidos de material y bodega

**STATUS:** CÓDIGO ESCRITO, **SIN VERIFICAR EN BASE DE DATOS REAL** (2026-08-23).
**Dónde se implementa:** repo local (`vps-docker`). El repo estaba desactualizado respecto a la
VPS antes de empezar (ver conversación: local en migración 112, VPS reportada en 119 por
`auditoria-pulse-producto.md`) y esta sesión no tuvo llave SSH autorizada en la VPS — no se pudo
cotejar ni aplicar nada ahí. Antes de desplegar, renumerar las migraciones 113-115 si en la VPS
ya existen esos números.

El plan completo (contexto, decisiones del dueño, modelo de datos razonado) quedó en
`/home/helminth/.claude/plans/groovy-spinning-sprout.md` de esta sesión de Claude Code. Este
archivo es el resumen que vive en el repo para la próxima sesión.

## Qué se pidió

Inventario por clínica (admin ve las 26, recepción ve la suya), una persona de bodega con
acceso a lo que se envía a cada sucursal (activable desde admin, buscando a la persona),
pedidos de material desde recepción comparados contra el stock para que bodega decida si envía,
pedidos especiales del admin (bodega los ve marcados como tal), estado + fecha estimada de
entrega, notificaciones de stock bajo, y una bitácora de cuándo se pide y cuándo se entrega.

## Decisiones ya tomadas con el dueño

- El stock baja porque **recepción registra consumo** (no solo conteos).
- El umbral de stock bajo es **por material, global** para las 26 clínicas.
- El catálogo de materiales lo mantienen **admin/bodega**, no cada recepcionista.
- Un pedido es **una lista de varios materiales**, no uno por pedido.
- `enviado` es el **estado final** — bodega decide cuánto manda por línea y ahí mismo sube el
  inventario de la clínica. Sin paso de "confirmar recepción" (no se pidió).
- Bodega e inventario son **dos permisos booleanos independientes**, activables persona por
  persona (no por `puesto`), igual que ya existe `puede_ubicar_sucursal`.

## Qué se construyó

- **Migraciones** (`supabase/migrations/`):
  `00000000000113_permisos_inventario.sql` — `usuarios.puede_gestionar_bodega` /
  `puede_gestionar_inventario`.
  `00000000000114_inventario_por_sucursal.sql` — `materiales`, `inventario_sucursal`,
  `inventario_movimientos`, trigger `aplicar_movimiento_inventario` (mueve el stock y notifica
  stock bajo al cruzar el umbral), RLS.
  `00000000000115_pedidos_material.sql` — `pedidos`, `pedido_items`, `pedido_estado_log`
  (bitácora por trigger), RPC `crear_pedido` (recepción/admin) y `bodega_procesar_pedido`
  (bodega decide y, si envía, suma el inventario), RLS.
- **Servicios** (`src/services/supabase/`): `materialesService.js`, `inventarioService.js`,
  `pedidosService.js`. `usuariosService.js` extendido con los dos permisos nuevos.
- **Permisos en UI**: `AuthContext.jsx` mapea los dos campos; `GestionUsuarios.jsx` tiene dos
  checkboxes nuevos en el modal de edición (sección "Inventario") — es el botón que pidió el
  dueño para buscar a la persona y activarla.
- **Menú**: `navItems.js` agrega "Inventario" (admin), "Inventario de mi clínica" y "Pedidos
  (Bodega)" (empleado, ocultos salvo permiso). Iconos `package`/`truck` nuevos en `Icon.jsx`.
- **Pantallas** (`src/components/inventario/`): `InventarioAdmin.jsx` (stock de las 26 clínicas,
  catálogo, pedido especial, todos los pedidos), `BodegaPanel.jsx` (pedidos pendientes vs. stock,
  procesar), `InventarioClinica.jsx` (stock propio, registrar consumo, hacer pedido, mis
  pedidos), `BitacoraInventario.jsx` (compartida, sin ruta propia — es una vista sobre
  `inventario_movimientos`, no una tabla nueva).
- Rutas montadas en `AdminLayout.jsx` (`/admin/inventario`) y `EmpleadoLayout.jsx`
  (`/empleado/inventario`, `/empleado/bodega`).

## Verificado esta sesión

- `npm run lint` — 0 errores nuevos (mismo baseline de 95 antes y después del cambio).
- `npx vitest run` — 512/512 tests pasan (sin regresiones).
- `npm run build` — compila sin errores.

## NO verificado (falta hacerlo antes de dar esto por terminado)

- **Las migraciones SQL nunca se ejecutaron.** No hubo Postgres/Supabase disponible esta sesión
  (ni VPS, ni un local de este proyecto). Cada migración trae su bloque de VERIFICACIÓN al final
  con los `insert`/`select` exactos para probarla a mano con `psql` — correrlos en orden
  (113 → 114 → 115) la primera vez que haya acceso.
- Prueba de extremo a extremo real en el navegador (crear pedido, procesarlo, ver que sube el
  inventario, que dispara la notificación de stock bajo, que la bitácora lo refleja) — solo se
  revisó el código, no se corrió contra datos reales.
- Confirmar los números de migración 113-115 contra lo que de verdad exista en la VPS antes de
  aplicar (el desfase 112 local / 119 VPS sigue sin resolverse).

## Choque de nombres contra Supabase

Revisado contra las 112 migraciones locales (previas a esta): sin choque en tablas, funciones,
triggers, índices ni columnas nuevas de `usuarios`. Pero esto solo prueba contra el repo local —
la VPS puede tener hasta la migración 119 (desfase de arriba) y algo con estos nombres pudo
agregarse ahí sin que este repo lo sepa. Correr esto en la VPS/entorno real ANTES de aplicar
113-115 — vacío en las dos = sin choque real:

```sql
select tablename from pg_tables where schemaname='public'
  and tablename in ('materiales','inventario_sucursal','inventario_movimientos','pedidos','pedido_items','pedido_estado_log');
select proname from pg_proc where pronamespace='public'::regnamespace
  and proname in ('aplicar_movimiento_inventario','crear_pedido','bodega_procesar_pedido','log_pedido_estado');
```
