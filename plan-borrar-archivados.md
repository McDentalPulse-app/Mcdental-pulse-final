# Borrar archivados definitivamente (solo admin)

**STATUS:** HECHO (commit `ea1001f`, desplegado 2026-08-07)
**Fecha:** 2026-08-07
**Dónde se implementa:** `/opt/pulse/app` en la VPS (2.25.150.106).

---

## Qué se pide

Un botón en **Gestión de Personal** (`GestionUsuarios.jsx`) para que el **admin** borre
definitivamente a los empleados archivados.

## Lo que ya existe y lo que no

- `usuariosService.eliminarUsuario()` → edge function `admin-delete-usuario` → borra
  `auth.users`, que cascadea a `usuarios` y de ahí a **23 tablas**. Ya está escrito y probado,
  pero **hoy ningún botón lo llama**: la baja de personal es `archivado` (reversible).
- La edge function acepta hoy a **admin, rh y psicologa**. Eso cambia (ver abajo).

## Decisiones del dueño (2026-08-07)

1. **Avisar con números y dejar pasar.** La confirmación dice exactamente qué se va a perder
   ("412 checadas, 38 encuestas, 2 notas psicológicas") y pide **escribir el nombre** para
   confirmar. El admin decide con el dato enfrente; no se bloquea.
2. **RH y Psicóloga solo archivan. Borrar definitivo es solo del admin** — y se cierra también
   el hueco del backend, no solo el botón.

## Lo verificado antes de escribir esto

- Borrado de ensayo (transacción deshecha) sobre los **16 archivados**: los 16 se borran limpio.
  Los FK `NO ACTION` (avisos.creado_por, reuniones.creado_por, rostros.enrolado_por…) **no
  bloquean**, porque las filas que referencian caen antes por cascada.
- De los 16: 11 con cero historial (varios son basura de pruebas), 3 con 2–4 checadas.
- El admin **sí** tiene RLS de lectura sobre `notas_psicologicas`, `archivos_expediente` y
  `reportes_confidenciales`, así que los números de la confirmación van a ser reales. **No hace
  falta migración ni RPC nueva.**

## Alcance

| Archivo | Cambio |
|---|---|
| `supabase/functions/admin-delete-usuario/index.ts` | El chequeo de rol pasa de `["admin","rh","psicologa"]` a **solo `admin`**. Se actualiza el comentario de cabecera, que hoy dice lo contrario. Redespliegue de la Edge Function (copiar a `volumes/functions` + restart). |
| `src/services/supabase/usuariosService.js` | `contarHistorialUsuario(id)`: cuenta con `head: true` lo que se va a perder (checadas, encuestas, notas psicológicas, archivos de expediente, comisiones, reconocimientos). Solo lectura. |
| `src/hooks/useBajaUsuario.js` | `eliminarDefinitivo(empleado)`: cuenta → confirmación con los números → `prompt` que exige **escribir el nombre exacto** → `eliminarUsuario()` → saca la fila de `usuarios` en memoria. Se actualiza la cabecera del hook, que hoy dice "deliberadamente no hay borrado en cascada detrás de ningún botón". |
| `src/components/admin/GestionUsuarios.jsx` | Botón de papelera, **solo si `user.role === "admin"` Y `emp.archivado`**, junto al de Restaurar. En la tabla y en la tarjeta de móvil. |

### El flujo de confirmación

1. `confirm` en rojo: *"Esto NO se puede deshacer"* + la lista de lo que se borra, con números
   reales. Si no tiene nada: *"No tiene historial registrado."*
2. `prompt`: *"Escribe **NOMBRE COMPLETO** para confirmar."* Si no coincide exacto → se cancela
   con un toast, no se borra.
3. Se llama a `eliminarUsuario`. Errores → toast con el mensaje del servidor.

Dos pasos y uno de ellos exige teclear: es el mismo estándar que archivar (dos confirmaciones),
subido un escalón porque esto no tiene vuelta.

## Criterios de aceptación

1. El botón **no existe** para rh ni psicologa (ni en la tabla ni en móvil), y tampoco para
   ningún empleado no archivado.
2. Si rh o psicologa llaman a la edge function a mano → **403**.
3. La confirmación muestra números correctos (contrastados contra la BD).
4. Escribir mal el nombre no borra.
5. Tras borrar, la fila desaparece de la lista sin recargar y el usuario ya no existe en la BD.
6. Archivar y restaurar siguen funcionando igual para los tres roles de gestión.

## Riesgos

- **Es irreversible y no hay papelera.** El respaldo externo a mcdentalserver es la única vuelta
  atrás, y con el retraso que tenga esa noche.
- **Riesgo legal (señalado al dueño, queda a su criterio):** la LFT obliga a conservar registros
  de asistencia y raya un tiempo tras la relación laboral. Borrar a un ex-empleado deja sin
  evidencia una eventual demanda. No soy quien para juzgarlo; queda dicho.
- El botón nace útil para limpiar las 11 cuentas de prueba archivadas; el peligro real llega el
  día que se archive a alguien con años de historial.

## Orden de ejecución

1. Edge function + redespliegue + comprobar 403 con rh/psicologa.
2. `contarHistorialUsuario` y contrastar contra la BD.
3. Hook + botón.
4. `npm test && npx eslint <tocados> && npm run build` + `build-frontend.sh`.
5. Commit en el git de `/opt/pulse/app`.
