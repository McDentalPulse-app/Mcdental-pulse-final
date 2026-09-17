# Plan — Datos bancarios para el depósito de nómina

**STATUS: APROBADO** (2026-09-17) — el dueño contestó las dos consultas de §8: sí a la columna de
*quién*, y la psicóloga **solo ve**. Implementación en curso.
**Fecha:** 2026-09-17
**Rama:** `vps-docker`
**Origen:** pedido del dueño — «que todos pongan su número de tarjeta y de qué banco es para hacer
los depósitos de su nómina, y una leyenda que diga que es responsabilidad de cada empleado tener
actualizada su información; todo esto va en la parte de empleados (ahí lo podrá ver la psicóloga o
RH) y la info la actualiza cada quien en Perfil».

**Grado:** XL. Son datos bancarios de toda la plantilla (PII + dinero), así que por
`task-grade-routing` arranca arriba: spec escrita y aprobada antes de código, y **dos** líneas de
revisión independientes antes de darlo por hecho (corrección + seguridad).

---

## 0. La decisión que ordena todo el plan

**No hace falta una tabla nueva.** El esquema ya resuelve el problema difícil, y lo resuelve bien:

- `public.usuarios` tiene RLS desde la migración 030: un empleado **solo puede leer su propia
  fila**. Gestión (`admin` / `rh` / `psicologa`) lee todas.
- Lo que ve el resto de la plantilla es `public.usuarios_directorio`, una vista `security definer`
  con **lista blanca explícita** de columnas: `id, name, role, sucursal, puesto, avatar_url,
  inactivo`. Una columna nueva **no aparece ahí sola**; hay que añadirla a mano.

O sea que columnas nuevas en `usuarios` son privadas por construcción. Es exactamente el camino que
ya tomó `sueldo` en la migración 156, que es el mismo tipo de dato (nómina, sensible, visible solo
para gestión). Se repite ese patrón en vez de inventar otro.

El candado de auto-edición es el trigger `prevent_usuario_privilege_escalation`, cuya versión
vigente (migración 153) limita lo que alguien fuera de gestión puede cambiar en su propia fila a
`avatar_url` y `banner_url`. **Ese es el único punto que hay que abrir**, y hay que abrirlo con
precisión quirúrgica.

---

## 1. Decisiones del dueño (2026-09-17)

| # | Pregunta | Respuesta |
|---|---|---|
| D1 | ¿Tarjeta o CLABE? | **Los dos, y que aparezcan ambos** |
| D2 | ¿Quién ve el número completo? | **RH, Administración y psicóloga** |
| D3 | ¿Rastro de cambios? | **Sí: fecha del último cambio, visible en la ficha** |
| D4 | ¿Se guarda también *quién* lo cambió? (§8.1) | **Sí**, columna `datos_bancarios_actualizado_por` |
| D5 | ¿La psicóloga edita o solo ve? (§8.2) | **Solo ve.** Editar datos bancarios ajenos queda en `admin` / `admin_plus` / `rh` |

---

## 2. Objetivo y no-objetivos

**Objetivo.** Que cada persona capture desde *Mi perfil* su banco, su CLABE y su número de tarjeta,
y que RH, Administración y la psicóloga los vean en la ficha del empleado junto con la fecha del
último cambio. Más una leyenda de responsabilidad visible en los dos lados.

**No-objetivos** (explícitos, para que nadie los dé por incluidos):

- No se dispersa nada hacia el sistema de cobros ni hacia comisiones. Es solo captura y consulta.
- No se genera layout bancario ni archivo de dispersión.
- No se toca la pantalla de Nómina ni el cálculo de sueldos.
- No se cifra la columna en la base (ver §7, riesgo aceptado y por qué).

---

## 3. Fase 1 — Migración 163

Cuatro columnas en `public.usuarios`, todas anulables (nadie nace con datos bancarios):

| Columna | Tipo | Para qué |
|---|---|---|
| `banco` | `text` | Nombre del banco, de un catálogo cerrado |
| `clabe` | `text` | 18 dígitos |
| `tarjeta` | `text` | 16 dígitos |
| `datos_bancarios_actualizado_en` | `timestamptz` | D3: cuándo se tocó por última vez |

**Se guardan solo dígitos**, sin espacios ni guiones: la pantalla los formatea al mostrarlos. Así
dos capturas del mismo número no quedan distintas en la base.

`CHECK` de formato en la base, no solo en la pantalla — es la lección que dejó escrita la migración
162: *una pantalla no es un candado*.

```sql
check (clabe is null or clabe ~ '^[0-9]{18}$')
check (tarjeta is null or tarjeta ~ '^[0-9]{16}$')
```

**El dígito verificador (CLABE módulo 10 ponderado / Luhn en la tarjeta) se valida en el cliente, no
en la base**, y es deliberado: un número bien formado pero equivocado solo perjudica a quien lo
tecleó, que es el dueño del dato. No es una frontera de confianza, es un typo. El `CHECK` de la base
cubre lo que sí importa ahí: que nadie meta letras ni longitudes raras por PostgREST.

**La fecha NO la manda el cliente.** Va en un trigger `BEFORE INSERT OR UPDATE` que la pone en
`now()` cuando cambia `banco`, `clabe` o `tarjeta`, e **ignora** cualquier valor que llegue de
fuera. Si el cliente pudiera escribirla, se podría posfechar o retrasar y el rastro no valdría nada
— que es justo lo que D3 pide evitar.

### 3.1 Abrir el trigger anti-escalación, y solo esto

Se recrea `prevent_usuario_privilege_escalation` con las tres columnas nuevas sumadas a la resta del
self-service, igual que hizo la migración 097 con `banner_url`:

```sql
if (to_jsonb(new) - 'avatar_url' - 'banner_url'
                  - 'banco' - 'clabe' - 'tarjeta'
                  - 'datos_bancarios_actualizado_en' - 'updated_at')
   is distinct from (to_jsonb(old) - ... ) then
  raise exception 'No autorizado: solo puedes cambiar tu foto, tu portada y tus datos bancarios.';
end if;
```

`datos_bancarios_actualizado_en` entra en la resta porque **el trigger de fecha ya la habrá
cambiado** cuando esta comprobación corra; si no se restara, guardar la CLABE propia fallaría
siempre. El orden de los triggers importa y se verifica.

⚠️ **Hay que recrear la versión de la migración 153 íntegra**, con la jerarquía admin_plus, el
organigrama y los seis módulos. Copiar una versión vieja aquí borraría candados de autorización que
ya existen. Es el riesgo más alto de toda la fase.

### 3.2 Lo que NO se toca

`usuarios_directorio` se queda **exactamente igual**. Se añade una verificación explícita que
comprueba que las columnas nuevas no aparecen en la vista.

---

## 4. Fase 2 — `src/utils/bancos.js` + pruebas

Funciones puras, sin React ni Supabase:

- `validarClabe(v)` → 18 dígitos + dígito verificador (módulo 10 con pesos 3,7,1).
- `validarTarjeta(v)` → 16 dígitos + Luhn.
- `soloDigitos(v)`, `formatClabe(v)`, `formatTarjeta(v)` para mostrar en grupos legibles.
- `BANCOS` — catálogo cerrado de bancos mexicanos + «Otro».

**Por qué catálogo y no texto libre:** con texto libre acabas con «BBVA», «Bancomer», «bbva
bancomer» y «BVA» en la misma columna, y RH no puede agrupar ni confiar en lo que lee.

Prueba: `src/utils/bancos.test.js`, con CLABEs y tarjetas de dígito verificador conocido, casos de
transposición (el error que el dígito verificador existe para cazar) y los límites (vacío, letras,
longitud de más y de menos).

---

## 5. Fase 3 — Captura en *Mi perfil*

`Perfil.jsx` hoy es **solo lectura** («Para cambiar tus datos contacta a Recursos Humanos»). Se suma
una `Card` nueva, *Datos bancarios*, que sí es editable, con banco (select), CLABE, tarjeta y un
botón de guardar.

Los tres campos son **opcionales por separado**: hay quien solo tiene CLABE. Se valida lo que esté
lleno.

**La leyenda del dueño**, visible aquí y en la ficha:

> Es responsabilidad de cada colaborador mantener sus datos bancarios actualizados. Un depósito
> enviado a una cuenta equivocada por información desactualizada no puede recuperarse.

`usuariosService.js` gana `guardarDatosBancarios({ banco, clabe, tarjeta })`, que escribe solo sobre
la fila propia. `AuthContext` y `mapUsuario` mapean los campos nuevos.

---

## 6. Fase 4 — Consulta en la ficha del empleado

En `FichaEmpleado.jsx`, un bloque *Datos bancarios* visible para `admin`, `admin_plus`, `rh` y
`psicologa` (D2), con banco, CLABE, tarjeta, botón de copiar y la fecha del último cambio. Si está
vacío, dice «Sin capturar» — distinto de un dato en blanco, igual que hace Nómina con el sueldo.

---

## 7. Riesgos y lo que se acepta a conciencia

| # | Riesgo | Qué se hace |
|---|---|---|
| R1 | Un empleado lee la cuenta de otro | **Cerrado por el esquema**: RLS deja ver solo la fila propia, y el directorio es lista blanca. Se verifica con un caso real, no por lectura del SQL |
| R2 | Alguien redirige la nómina de otro cambiándole la cuenta | Gestión puede editar filas ajenas *by design*. La fecha de D3 deja rastro de **cuándo**, pero no de **quién** — ver §8 |
| R3 | Recrear mal el trigger borra candados vigentes | Se parte de la versión 153 íntegra y se comprueba después que los módulos, el organigrama y la jerarquía siguen bloqueados |
| R4 | La columna no está cifrada | **Riesgo aceptado.** Quien tiene acceso a la base ya tiene el sueldo de todos. Cifrar exigiría gestionar una llave que hoy no existe, y RH necesita leer el número para depositar. Queda anotado como deuda si algún día se audita |
| R5 | El cliente posfecha el rastro | Cerrado: la fecha la pone un trigger e ignora lo que mande el cliente |
| R6 | Un número válido pero de otra persona | Ningún sistema lo detecta. Es lo que cubre la leyenda |
| R7 | El autor del sello bloquea o pierde el rastro al dar de baja a esa persona | **Hallazgo HIGH de la revisión de seguridad.** Con FK y `NO ACTION` el borrado de esa persona falla con un error opaco e indestrabable desde la app; con `ON DELETE SET NULL` la acción referencial dispara el trigger del sello, que restaura el valor y deja la FK violada igual. Se resuelve quitando la FK: la columna es un uuid pelado y la pantalla dice «por un usuario dado de baja» cuando no resuelve |

---

## 8. Consultas resueltas (2026-09-17)

**§8.1 — La fecha dice *cuándo*, pero no *quién*. → RESUELTO: se añade la columna.**
`datos_bancarios_actualizado_por uuid` **sin foreign key** (ver R7), puesta por el mismo trigger
que pone la fecha y con la misma regla: **el cliente no la escribe**. Si la solicitud no cambia
ningún dato bancario, el trigger **restaura** los dos valores anteriores, que es lo que impide
manipular el sello sin tocar el dato.

**§8.2 — La psicóloga solo ve. → RESUELTO.** Guarda nueva en el trigger, *antes* del bloque de
self-service:

```sql
if (new.banco is distinct from old.banco
    or new.clabe is distinct from old.clabe
    or new.tarjeta is distinct from old.tarjeta)
   and new.id is distinct from public.current_usuario_id()
   and public.current_role() not in ('admin', 'rh') then
  raise exception 'No autorizado: solo Administración y RH pueden cambiar los datos bancarios de otra persona.';
end if;
```

Tres cosas que esta guarda hace a propósito:

- **`admin_plus` pasa** porque `current_role()` lo pliega a `'admin'`, igual que en el resto del
  trigger.
- **La psicóloga sigue pudiendo editar los SUYOS**: la condición exige que la fila sea ajena. Es
  empleada también, y bloquearle su propio perfil sería un efecto colateral absurdo.
- Es defensa redundante para un empleado (la RLS ya le impide escribir en filas ajenas), y la única
  defensa real para la psicóloga, que sí tiene UPDATE sobre toda la tabla.

En la pantalla, el bloque de la ficha se muestra en **modo lectura** para la psicóloga: ve los
números, no ve el botón de editar.

---

## 9. Orden de despliegue y marcha atrás

1. **Migración 163 primero**, frontend después — mismo acoplamiento que la 159 y la 160: el cliente
   manda las columnas nuevas en cada guardado y una base sin ellas rompería el guardado de perfil.
2. La migración es aditiva: columnas anulables y un trigger que solo *amplía* lo permitido. Una base
   con la 163 y el frontend viejo conviven sin ruido.
3. **Marcha atrás:** `drop` de las cuatro columnas y restaurar el trigger desde la 153. No hay
   pérdida de datos preexistentes porque no existían antes.

**Verificación antes de dar nada por hecho** (`adversarial-review`, dos líneas por ser XL):

- Corrección: dígitos verificadores contra casos conocidos, el trigger de fecha, el guardado.
- Seguridad: que un empleado **no** pueda leer la cuenta de otro ni por `usuarios` ni por
  `usuarios_directorio`, que no pueda escribir en filas ajenas, y que los candados de la 153 sigan
  en pie. Probado contra una base real, no leyendo el SQL.

---

## 10. Archivos que toca

| Archivo | Qué |
|---|---|
| `supabase/migrations/00000000000163_datos_bancarios.sql` | nuevo |
| `src/utils/bancos.js` + `.test.js` | nuevos |
| `src/components/common/Perfil.jsx` | Card editable + leyenda |
| `src/services/supabase/usuariosService.js` | `mapUsuario` + `guardarDatosBancarios` |
| `src/contexts/AuthContext.jsx` | mapeo |
| `src/components/empleados/FichaEmpleado.jsx` | bloque de consulta |
| `src/App.css` | estilos |
