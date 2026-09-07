# Permitir marcar desde cualquier clínica

**STATUS:** APPROVED
**Fecha:** 2026-08-07
**Dónde se implementa:** `/opt/pulse/app` en la VPS (2.25.150.106) — el repo local no alimenta nada.

---

## Problema

Hay gente que va a apoyar a otra clínica y **no puede checar**. Hoy el candado de
geocerca resuelve la sucursal desde `usuarios.sucursal` (su clínica asignada) y evalúa
contra ESA y solo esa:

- Cliente: `src/utils/geo.js` → `evaluarUbicacion(ubicacion, sucursal)`; `ChecadorEmpleado.jsx`
  deshabilita el botón cuando el estado es `fuera` o `sin_gps`.
- Servidor (la ley): `api/checar.js` llama a la RPC `checar_ubicacion(p_empleado_id, …)`,
  que hace `usuarios.sucursal → sucursales` y rechaza con 403 si sale `fuera`.

Estando en otra clínica, la distancia a la suya son kilómetros → `fuera` → bloqueado.

Las 26 sucursales están activas y todas tienen geocerca con radio de 50 m.

## Decisión de producto (confirmada con el dueño, 2026-08-07)

1. El permiso deja marcar **dentro del área de CUALQUIER clínica activa**, no desde
   cualquier lado. En su casa o en la calle sigue bloqueado — el control de ubicación no
   se pierde, solo deja de estar amarrado a una sola clínica.
2. La checada se guarda con la **sucursal donde físicamente marcó** (`asistencias.sucursal_id`),
   para que RH vea dónde estuvo apoyando. Su **horario, turno y zona horaria siguen saliendo
   de su clínica asignada** — es donde vive su horario, y moverlo rompería el cálculo de
   retardos.
3. Es un permiso **por empleado, apagado por defecto**. Mismo patrón que
   `usuarios.puede_ubicar_sucursal` (migración 103).

## Alcance

### 1. Migración `00000000000118_marcar_en_cualquier_clinica.sql` (nueva)

**a) Columna**

```sql
alter table public.usuarios
  add column if not exists puede_marcar_en_cualquier_clinica boolean not null default false;
```
Con `comment on column` explicando qué permite y por qué existe.

**b) Función nueva `public.sucursal_para_checada(p_empleado_id, p_lat, p_lng, p_precision)`**
→ OUT `sucursal_id uuid`, `estado estado_ubicacion`, `distancia integer`.

Un solo sitio donde vive la regla, igual que hizo la 063 con `evaluar_ubicacion`:

- Resuelve la clínica asignada (`usuarios.sucursal → sucursales activa`).
- **Permiso apagado** → evalúa contra la asignada y devuelve su id. Comportamiento
  idéntico al de hoy, bit a bit.
- **Permiso encendido**:
  1. Evalúa la asignada primero. Si da `dentro`, gana (evita mover de sucursal a quien
     está en la suya y tiene otra clínica pegada al lado).
  2. Si no, busca entre las activas con coordenadas la que dé `dentro`, quedándose con
     la **más cercana**.
  3. Si ninguna da `dentro` → `fuera`, con la distancia a la clínica más cercana (para
     que el mensaje sea útil) y `sucursal_id` = la asignada.
- `sin_gps` y `sin_geocerca` se comportan como hoy: sin GPS bloquea; sin geocerca
  configurada **no** bloquea (es olvido del admin, no del empleado).

**c) `checar_ubicacion` — se recrea con la MISMA firma**, delegando en la función nueva.
Así `api/checar.js` no se toca y el backstop del servidor pasa a conocer el permiso.

**d) `registrar_checada` — se recrea completa** (cuerpo de la 107, misma firma) cambiando
**solo el bloque de ubicación**: en vez de `evaluar_ubicacion` contra la asignada, llama a
`sucursal_para_checada`, y el `insert` guarda `sucursal_id` = la que devolvió la función.
`v_tz`, `v_fecha`, `v_hora_local` y todo el bloque de turno/salida **siguen saliendo de la
clínica asignada** (`v_sucursal`) — sin cambios.

**e) Grants** iguales a los de hoy (`service_role`), y comentario de rollback al pie como
hace la 103.

RLS: la política de `update` sobre `usuarios` es por fila (admin/rh/psicologa), no por
columna → no hay que tocarla. **A verificar antes de dar por bueno.**

### 2. Cliente — el candado en vivo

| Archivo | Cambio |
|---|---|
| `src/utils/geo.js` | Añadir `evaluarUbicacionEnVarias(ubicacion, sucursales)`: el mejor veredicto de la lista (gana `dentro`; si no, el `fuera` más cercano). `evaluarUbicacion` se queda intacta. `textoCandado` acepta un modo "cualquier clínica" para decir *"Acércate a una clínica McDental para poder checar"* en vez de nombrar la suya. |
| `src/components/asistencia/ChecadorEmpleado.jsx` | Ya carga `getSucursales()` completo y se queda con la suya. Si `user.puedeMarcarEnCualquierClinica`, evalúa contra **todas las activas**. `tz` se sigue tomando de la clínica asignada. |
| `src/contexts/AuthContext.jsx` | Mapear `puede_marcar_en_cualquier_clinica → puedeMarcarEnCualquierClinica`, junto a `puedeUbicarSucursal`. |

### 3. Admin — la casilla

| Archivo | Cambio |
|---|---|
| `src/services/supabase/usuariosService.js` | `mapUsuario`: leer la columna. `updateUsuario`: dejarla pasar al payload. |
| `src/components/admin/GestionUsuarios.jsx` | Casilla **"Permitir marcar desde cualquier clínica"** en la sección *Puesto y sucursal* del modal de editar, con la ayuda: *"Para quien va a apoyar a otras clínicas. Seguirá necesitando estar dentro del área de alguna clínica para poder checar."* Entra en `formData`, `abrirModal` y el payload de guardado. |

Al **crear** un empleado no aparece: nace en `false` y se activa editando. No se toca la
edge function `admin-create-usuario`.

### 4. Pruebas

- `src/utils/geo.test.js` (ya existe): casos de `evaluarUbicacionEnVarias` — dentro de la
  suya, dentro de otra, fuera de todas (devuelve la distancia mínima), lista vacía, sin GPS.
- `npm test` + `npm run lint` + `npm run build` en la VPS.
- Comprobación en la BD de que la migración aplica y de que **con el permiso apagado el
  veredicto no cambia** para un empleado real (comparar `checar_ubicacion` antes/después).

## Criterios de aceptación

1. Empleado **sin** el permiso: todo exactamente igual que hoy (dentro de la suya ficha,
   fuera no, sin GPS no).
2. Empleado **con** el permiso, parado en otra clínica: el botón se habilita y la checada
   entra, guardada con la sucursal donde marcó.
3. Empleado **con** el permiso, en su casa: sigue bloqueado, con mensaje que dice que se
   acerque a una clínica.
4. El retardo/turno de quien apoya en otra clínica se sigue calculando con el horario y la
   zona horaria de su clínica asignada.
5. La casilla se ve y persiste en editar empleado; por defecto apagada para los ~100 actuales.

## Riesgos y decisiones abiertas

- **La migración recrea `registrar_checada` entera.** Es el punto delicado: si se copia mal
  el cuerpo de la 107 se rompe el cálculo de turnos. Se copia literal y solo se sustituye el
  bloque de ubicación.
- ~~**Mensaje del servidor:** `api/checar.js` dice *"Acércate a tu clínica"* en el 403.~~
  **HECHO (2026-08-07, commit `0bf1dbd`).** `quienLlama` pasa a traer el permiso —igual que ya
  traía `soporte_ti`— y el 403 dice *"una clínica McDental"* a quien lo tiene. De paso se arregló
  un segundo texto con el mismo defecto y más visible: la confirmación tras fichar decía
  *"Ubicación confirmada · <clínica asignada>"* aunque la checada se hubiera guardado en otra;
  ahora nombra la que quedó registrada en la fila.
- **Reportes por sucursal:** `asistencias.sucursal_id` hoy casi no se usa en el frontend
  (solo se mapea en `asistenciasService`); los reportes agrupan por `usuarios.sucursal`. Es
  decir, guardar la clínica real no mueve ningún reporte existente — queda como dato para
  cuando se quiera explotar.

## Orden de ejecución

1. Migración + aplicarla con `docker exec -i pulse-db psql`.
2. Verificar en BD que el veredicto no cambió para permiso apagado.
3. Cliente (`geo.js` + test, `ChecadorEmpleado`, `AuthContext`).
4. Admin (`usuariosService`, `GestionUsuarios`).
5. `npm test && npm run lint && npm run build` + `build-frontend.sh` (URL pública, no la de `api.env`).
6. Commit en el git local de `/opt/pulse/app`.
