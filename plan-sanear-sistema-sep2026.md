# Plan — Cerrar lo pendiente después de la semana de Admin+ y el merge del 02-sep

STATUS: DRAFT
Fecha: 2026-09-02
Origen: el dueño pregunta qué le falta al sistema, después de cerrar Admin+/módulos/intercambios
y descubrir (vía push) la rama `origin/vps-docker` perdida desde agosto.
Alcance: este repo + `pulse-db`/`pulse-api-server`/`pulse-frontend` en la VPS + la PC de la
oficina + la PC vieja del `helminth` histórico.

---

## Corrección antes de empezar

En la respuesta anterior dije que "vigilancia de geocercas" nunca se construyó. **Es falso** —
lo escribí de memoria (del `HANDOFF-pulse-vps.md` de julio, que quedó viejo) en vez de revisar el
código, justo el error que este mismo repo advierte no cometer. `revisar_geocercas()` y el aviso
`dejo_de_fichar`/`nunca_ficho` ya están en producción desde el 6 de agosto
(`plan-red-de-seguridad.md`, Fases 1-3, completo). El aviso "5 personas no han podido fichar" que
vimos hoy en el navegador **es ese sistema funcionando correctamente** — está avisando de un
problema real que nadie investigó todavía, no de un hueco de monitoreo. Corregido abajo (§2).

---

## §1. Respaldo externo — 34 días de silencio

**No es un bug de código.** Leído `api/revisar-respaldos.js`: el aviso dispara cuando no llega un
"latido" de `tirar-respaldo.sh`, que corre **en la PC de la oficina** a las 03:20 local (por
diseño de seguridad: la VPS nunca tiene una llave que alcance la red interna — ver
`infra/README.md`). 34 días de silencio significa que esa máquina está apagada, sin red, o el
cron se cayó — no algo que yo pueda arreglar desde acá.

**Necesito que el dueño (o quien esté en la oficina) revise, en esa PC:**
1. ¿Está encendida y con red?
2. `crontab -l` (o el programador de tareas si es Windows) — ¿sigue el trabajo de las 03:20?
3. Correr `tirar-respaldo.sh` a mano una vez y ver si falla, y con qué error.

Yo puedo escribir el diagnóstico paso a paso si hace falta, pero la ejecución es en esa máquina.

**Confirmado en `pulse-db` real (02-sep):** el último latido verificado es del **29 de julio,
16:29 UTC** — 35 días. Ningún latido desde entonces, ni fallido ni exitoso: silencio total desde
ese día, coincide con la migración a la VPS. Refuerza que es la máquina, no un fallo intermitente.

## §2. Casos reales de asistencia bloqueada — investigar, no construir

Listas sacadas en vivo de `personas_que_dejaron_de_fichar()` y el chequeo de `sin_rostro`
(02-sep, más frescas que el aviso que viste en la campana — una persona ya se resolvió sola):

**4 bloqueadas para fichar** (sin vacación ni permiso aprobado que lo explique):

| Nombre | Sucursal | Última entrada | Días laborables perdidos |
|---|---|---|---|
| MARIANA AGUILAR LOPEZ | Oficina Administrativa | 08-ago | **19** |
| ANA KAREN MEZA GONZALEZ | Oficina Administrativa | 26-ago | 3 |
| KAREN SANTIAGO MARTINEZ | McDental Mante | 27-ago | 3 |
| ELISA HASHIRA LEOS LARA | McDental Palmas | 29-ago | 2 |

Mariana lleva **19 días** — la más vieja con diferencia, y en Oficina Administrativa (no una
clínica remota) es más raro todavía que nadie lo haya notado.

**1 sin rostro aprobado** (con `exigir_rostro` activo, no puede checar):

| Nombre | Sucursal | Puesto |
|---|---|---|
| HANIA TORRES PEÑA | McDental Tuxpan | Doctora |

Esto ya no es información que yo pueda seguir sacando — necesito que alguien de RH/gestión
confirme, por cada una: ¿sigue trabajando ahí? ¿es un bloqueo real (geocerca, dispositivo) o ya se
fue y falta darla de baja?

## §3. `HANDOFF-pulse-vps.md` desactualizado

No refleja nada de esta semana (Admin+, módulos, intercambios, migración 151, el merge de
`origin/vps-docker`). Lo reescribo con el estado real — doc, sin riesgo, lo hago directo salvo que
prefieras revisarlo antes.

## §4. `/opt/pulse/app` en la VPS: tercera copia de historia git

Hoy se confirmó que la VPS tiene su propio HEAD (`f3e2257`, no existe en ningún repo local) y
archivos modificados sin commitear que nunca coincidieron ni con este checkout ni con
`origin`/`prod`. No causó daño hoy — todo lo que hacía falta ya estaba ahí — pero es la misma
clase de sorpresa que el `origin/vps-docker` perdido, solo que en la otra dirección.

Propuesta: comparar (no fusionar a ciegas) el HEAD de la VPS contra `vps-docker` local, igual que
se hizo hoy con `origin/vps-docker` — mismo método, mismo cuidado. Esto es trabajo real, no
mecánico; lo separaría en su propia sesión, no lo metería en esta misma tanda.

## §5. Seguridad — PC vieja (`100.92.81.83`) sin dar de baja

Tiene la llave SSH sin passphrase y `pulse-password-temporal.xlsx`. Necesito saber si sigue
alcanzable (¿la prendiste desde julio?) antes de proponer cómo. Si responde: borrado seguro de
`~/.ssh` y el Excel, y sacarla de `authorized_keys` de la VPS. Si no responde nunca más: dar la
llave por comprometida y rotarla en la VPS (nueva llave, actualizar `HANDOFF`).

## §6. Deuda técnica menor (bajo riesgo, sin prisa)

- 27 errores de eslint preexistentes — cada uno necesita mirarse (ya no son mecánicos, los
  mecánicos se limpiaron esta semana). Los reviso y arreglo los que sean seguros; los que
  impliquen cambio de comportamiento real los reporto en vez de tocarlos a ciegas.
- Test pgTAP para la exclusividad de intercambios (sugerido por el checker de la migración 151) —
  para que el próximo cambio a ese índice tenga una prueba automática, no solo el comentario de
  VERIFICACIÓN.

## §7. Bloqueado en vos, no hay nada que planear todavía

- `api/tareas-programadas.js`: ¿traemos al repo las ~120 líneas que solo viven en la VPS
  (encuesta quincenal, aviso de geocerca "lejos", aviso de gente sin fichar)?
- Inventario: cantidades reales por sucursal y umbrales de stock bajo por material.

## §8. Opcional, no lo hago sin que lo pidas

- Terminar el botón de llamada directa desde Mensajes (`SalaJitsi`/`enSala`) que quedó a medias
  en la rama perdida — hoy lo descarté a propósito en el merge.
