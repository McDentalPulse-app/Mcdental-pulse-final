# plan.md — Bloques rotatorios en la encuesta

**STATUS:** FASES 0-4 EN PRODUCCIÓN (2026-07-29) · QUEDA FASE 5 (verificación con datos reales)
**Fecha:** 2026-07-29
**Origen:** sesión de grilling. Las cinco decisiones de diseño ya están cerradas (ver más abajo).
**Alcance:** `/opt/pulse/app` en la VPS (producción).

Fase 0 aplicada el 2026-07-29: migración `00000000000098_encuesta_bloques.sql`. Los siete
criterios de aceptación verificados contra la base real, con `rollback` en todo lo que
escribía. Nada de la app cambió de comportamiento todavía: es solo esquema.

> Nota de verificación: la policy de SELECT usa `auth.role()`, que lee el claim `role` del
> JWT y **no** la tabla `usuarios`. Simular una sesión con solo el claim `sub` da un falso
> negativo (0 bloques visibles). Con el JWT completo el empleado ve los bloques, igual que
> ve `encuesta_preguntas`, que lleva la misma expresión.

Fase 1 aplicada: `src/utils/encuestaBloques.js` + 19 tests. Añadidas dos funciones que el
plan no preveía — `repartirPreguntas` y `preguntasDeLaSemana` — para que el filtro
`!p.bloqueId` viva en un solo sitio en vez de repetirse en cada pantalla. Los bloques
desempatan por id cuando comparten `orden`: sin eso, la encuesta cambiaría de preguntas al
refrescar la página.

Fase 2 aplicada: el detector de riesgo y el de comentarios pasan a localizarse por área y
acotados al núcleo. Verificado contra las 61 encuestas reales de producción, capturando el
agregado antes y después del cambio: **idéntico** —
`preguntaDeRiesgo {area: Riesgo, tipo: opcion}`, `riesgos {No: 52, Algo: 8, "Sí, seriamente": 1}`.
6 tests permanentes añadidos a `encuestaDetail.test.js`. Total: 381 tests en verde.

Fase 3 aplicada. Lo que el plan no había visto: **`bloqueId` se perdía en TRES sitios**, no
en uno. `normalizePregunta`, `preguntaToRow` y el mapeo de `getEncuestaPreguntas` construyen
objetos nuevos campo por campo, así que una propiedad no enumerada desaparece en silencio — y
una pregunta sin `bloqueId` pasa por ser del núcleo, o sea que sus escalas habrían entrado al
Pulse Score. Era el riesgo nº1 del plan y llegaba por una vía que no estaba prevista. Los tres
arreglados, con 6 tests en `encuestaPreguntas.test.js` que fijan el invariante.

`EncuestaEmpleado` reparte ahora en dos variables con nombres distintos a propósito:
`preguntas` (lo que se ve: núcleo + bloque) y `paraElScore` (solo núcleo). El criterio de
aceptación está fijado en 3 tests que usan el cálculo REAL: un bloque de tres escalas
respondidas con 2 no mueve un score de 80, **y sin el filtro sí lo movería** — ese segundo
test es el que demuestra que el filtro trabaja y que la igualdad no es casualidad de los datos.

Verificado en producción: `GET /rest/v1/encuesta_bloques` responde 200 y la consola queda
limpia. Total: 390 tests en verde.

**DECISIÓN TOMADA (2026-07-29):** las escalas de un bloque **no** entran en el contexto de la
IA. El AI Engine compara semanas para detectar "cambio de comportamiento" y "tendencia
negativa", y un área que aparece una quincena y desaparece la siguiente dispararía alertas sin
fundamento: no bajó nada, solo cambió el cuestionario. Por el mismo motivo por el que un bloque
no puntúa en el score, tampoco entra en la serie que la IA compara. Las respuestas siguen
visibles en el detalle y en el expediente. Razonamiento en el JSDoc de `resumenEscalas`; para
revertirlo, quitar `!p.bloqueId`.

**Fase 4a aplicada** (lo que protege los datos):
- **Un cuarto y un quinto sitio** perdían `bloqueId`: el `toRow`/`fromRow` de
  `encuestaPreguntasService` (el que de verdad escribe en la base) y la serialización que
  detecta cambios en `GestionEncuestas` (sin ella, mover una pregunta a un bloque no contaba
  como cambio y el botón de guardar no hacía nada). Ambos arreglados.
- Selector "Cuándo se pregunta" en el formulario: núcleo o bloque, diciendo en cada opción si
  cuenta para el score.
- Texto y opciones **congelados** en preguntas ya contestadas, con la razón a la vista.
- `AREAS_RESERVADAS` + validación al guardar: un bloque no puede usar un área del núcleo.
- El encabezado dice qué bloque toca esta quincena (se deriva, no se guarda).
- CRUD de bloques en el servicio (`crearBloque`, `actualizarBloque`, `eliminarBloque`), con
  mensajes claros para nombre duplicado (23505) y bloque con preguntas dentro (23503).

Verificado de punta a punta en producción: se creó el bloque "Carga de trabajo" con una
pregunta, se comprobó que el encabezado lo anunciaba y que la pregunta aparecía en la lista, y
**se borraron los dos** — no se deja material de prueba en la encuesta de 95 personas. 397 tests
en verde.

**Fase 4b aplicada:** `GestionBloques.jsx`, componente nuevo autocontenido que se inserta en
Gestión de Encuestas con una línea (el editor ya tenía 412 líneas). Crear, renombrar en línea,
reordenar con ↑/↓ —el orden ES la secuencia de la rotación—, activar/desactivar y eliminar.
Cada bloque muestra cuántas preguntas tiene y qué turno ocupa, y el que toca lleva la etiqueta
"Esta quincena (Qn)".

Probado desde la interfaz como lo haría RH: crear el bloque (toast + aparece con "0 preguntas ·
turno 1 de 1" + etiqueta "Esta quincena (Q3)" + el encabezado se actualiza solo), y eliminarlo
(modal de la app, no diálogo nativo → lista vacía con su mensaje + encabezado de vuelta al
núcleo). La base quedó en 0 bloques y 10 preguntas de núcleo.

> Defecto encontrado y corregido de paso: `.mc-hint` es `display: flex; gap: 8px`, así que cada
> `<strong>` y cada trozo de texto se convertía en un flex item y el párrafo salía partido en
> columnas. Se envuelve el texto en un `<span>`. **El mismo defecto estaba ya en producción en
> Gestión de Sucursales**, cuyo hint también lleva un `<strong>`: arreglado también.

> **~~DECISIÓN PENDIENTE~~ (resuelta arriba):** `resumenEscalas()` filtra por
> `tipo === "escala"` sobre las preguntas que se le pasen, y sus llamadores le pasan el listado
> completo del contexto — que ahora incluye las de bloque. Así que **las escalas del bloque ya
> están entrando en el contexto que se manda a la IA.** No corrompe el Pulse Score (ese va por
> `paraElScore`), pero mezcla temas distintos en el mismo prompt. Hay que decidir si eso es
> más información útil o ruido que descoloca las alertas. Sin decidir a propósito: se avisó
> antes de tocarlo.

---

## Objetivo

Que las preguntas de la encuesta cambien cada dos semanas **sin romper la comparación
histórica del Pulse Score**, que es de lo que viven el historial, la flecha de tendencia, el
foco rojo por sucursal y las alertas de "tendencia negativa" del AI Engine.

La forma de conseguir las dos cosas a la vez es separar la encuesta en dos partes:

- **Núcleo** — las 10 preguntas actuales, todas las semanas, sin cambios. **Solo ellas
  producen el Pulse Score.**
- **Bloque rotatorio** — 2 a 4 preguntas que cambian cada quincena. Se responden y se
  reportan, pero **no entran al score**.

## Decisiones cerradas

| Decisión | Resuelto |
|---|---|
| Comparabilidad del score | Núcleo fijo + bloque rotatorio |
| Quién elige el bloque | Banco con rotación automática cíclica, sin fechas ni cron |
| Cadencia | El bloque acompaña al núcleo **las dos semanas** de la quincena |
| Tipos en los bloques | Cualquiera, y se arregla el detector de riesgo |
| Editar preguntas contestadas | Texto y opciones congelados; orden/área/activa libres |

## Supuestos

Si alguno no se sostiene, cambia el plan:

1. Las áreas del núcleo (`Riesgo`, `Emocional`, `Estrés`, `Liderazgo`, `Motivación`,
   `Relaciones`, `Satisfacción`, `Carga`, `Personal`, `Comentarios`) quedan **reservadas**:
   un bloque no puede usarlas, porque el motor de riesgo lee por área.
2. Banco vacío → solo núcleo. Un solo bloque → ese bloque siempre. Ninguno de los dos casos
   es un error.
3. El banco lo administran admin, RH y psicóloga (los mismos que ya editan preguntas).
4. La encuesta sigue siendo **semanal** y sigue bloqueando la salida del sábado.

---

## Fase 0 — Esquema

**Migración `00000000000098_encuesta_bloques.sql`**

- Tabla `encuesta_bloques`: `id uuid pk`, `nombre text not null unique`, `descripcion text`,
  `orden int not null default 0`, `activo bool not null default true`, timestamps.
- `encuesta_preguntas.bloque_id uuid null references encuesta_bloques(id)`.
  **`null` significa núcleo**, así que las 10 preguntas actuales quedan bien sin tocarlas.
- Índice en `encuesta_preguntas(bloque_id)`.
- RLS: SELECT para autenticados, escritura para `('admin','rh','psicologa')` — copia exacta
  del esquema que ya tiene `encuesta_preguntas`.
- `on delete restrict` en la FK: borrar un bloque con preguntas dentro debe fallar, no
  dejar preguntas huérfanas.

**Aceptación:** las 10 preguntas actuales tienen `bloque_id is null`; el Pulse Score de las
61 encuestas existentes no cambia (se calcula igual, porque el núcleo es todo).

## Fase 1 — La rotación (lógica pura)

**Nuevo `src/utils/encuestaBloques.js`**

```js
export const quincenaNumero = (week) => {
  const n = semanaNumero(week);              // ya existe en constants.js
  return n == null ? null : Math.ceil(n / 2); // W1,W2 → Q1
};

export const bloqueDeLaSemana = (week, bloques = []) => {
  const activos = bloques.filter((b) => b.activo).sort((a, b) => a.orden - b.orden);
  const q = quincenaNumero(week);
  if (!activos.length || q == null) return null;
  return activos[(q - 1) % activos.length];
};
```

Sin estado, sin fechas, sin cron: la misma semana siempre da el mismo bloque, y no hay nada
que se pueda quedar "sin programar".

**Aceptación:** W1 y W2 dan Q1; W3 y W4 dan Q2; con 4 bloques, Q5 vuelve al primero; banco
vacío devuelve `null`; una semana anterior al lanzamiento devuelve `null`.

## Fase 2 — Arreglar el detector de riesgo

Es el bug latente que la feature dispararía, así que va **antes** de que existan bloques.

**`src/utils/encuestaDetail.js`**

```js
// Antes: "la única de tipo opcion" — un bloque con otra pregunta de opción se la robaba.
export const getPreguntaRiesgoRenuncia = (preguntas = []) =>
  preguntas.find((p) => !p.bloqueId && /riesgo/i.test(p.area || "")) ||
  preguntas.find((p) => !p.bloqueId && p.tipo === "opcion") ||   // respaldo
  null;
```

Igual para `getPreguntaAbierta` (área `Comentarios`). El respaldo por tipo se conserva para
no depender de que el área esté bien escrita en filas viejas, pero **acotado al núcleo**.

**Aceptación:** recalcular los riesgos de las 61 encuestas existentes antes y después y
comprobar que **ninguno cambia**. Después, con un bloque de prueba que incluya una pregunta
de tipo `opcion`, el riesgo de renuncia sigue leyendo la del núcleo.

## Fase 3 — La encuesta del empleado

**`src/services/supabase/encuestasService.js`** (o donde viva hoy `getEncuestaPreguntas`)
- Traer bloques. `getEncuestaPreguntas` sigue devolviendo **todas** las preguntas, activas e
  inactivas: el detalle histórico las necesita o los bloques pasados saldrían como
  "Pregunta registrada" sin texto.

**`src/components/empleados/EncuestaEmpleado.jsx`**
- Mostrar núcleo + el bloque de la semana. Subtítulo con el nombre del bloque
  ("Esta quincena: Carga de trabajo").
- **El punto de más riesgo de todo el plan:** `calcularScoreEncuesta(preguntas, respuestas)`
  hace la media de las de escala. Si se le pasan núcleo + bloque y el bloque trae escalas,
  **entran al score y lo corrompen**. Hay que pasarle explícitamente solo el núcleo:
  `preguntas.filter((p) => !p.bloqueId)`.

**Aceptación:** un bloque con 3 preguntas de escala **no mueve el score**; contestar la
encuesta guarda las 13 respuestas en el jsonb; el score sale idéntico al que saldría sin
bloque.

## Fase 4 — El banco en el editor

**`src/components/admin/GestionEncuestas.jsx`**
- Sección de bloques: crear, renombrar, ordenar, activar/desactivar.
- Al crear o editar una pregunta, elegir si es núcleo o de qué bloque.
- Mostrar qué bloque toca esta quincena y cuál la siguiente (se deriva, no se guarda).
- **Congelar** texto y opciones de las preguntas que ya tengan respuestas, con la razón a la
  vista: "ya fue contestada; para reformularla, desactívala y crea una nueva".
  Detección: `select exists(select 1 from encuestas where respuestas ? id::text)` — a 61
  filas es instantáneo.
- Impedir las áreas reservadas al asignar una pregunta a un bloque.

**Aceptación:** el campo de texto de una pregunta contestada está deshabilitado y explica por
qué; se puede desactivarla y duplicarla; intentar usar el área "Riesgo" en un bloque avisa.

## Fase 5 — Verificación

- Migración aplicada y RLS comprobada con `rollback` para los tres roles de gestión.
- Riesgos de las 61 encuestas: idénticos antes y después (Fase 2).
- Score de una encuesta con bloque: idéntico al de una sin bloque.
- En el navegador, con la sesión de psicóloga: crear un bloque, verlo aparecer en la
  encuesta, contestarla, y comprobar que el detalle muestra las respuestas del bloque.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Una escala de bloque se cuela al score y corrompe la serie | Filtro explícito `!p.bloqueId` en el cálculo + criterio de aceptación de la Fase 3 |
| El detalle histórico pierde el texto de bloques viejos | `getEncuestaPreguntas` sigue trayendo las inactivas |
| Un bloque usa un área del núcleo y contamina los riesgos | Áreas reservadas, validadas en el editor |
| Nadie llena el banco y la encuesta se queda igual | Banco vacío es un estado válido: solo núcleo, sin errores |

## Fuera de alcance

- **La participación.** Hay 61 encuestas en 7 semanas con ~100 colaboradores: menos del 10%,
  ya con el bloqueo del sábado activo. Rotar preguntas no va a mover eso. Merece su propia
  investigación y es probablemente más valioso que esta feature.
- Reportes agregados por tema de bloque (comparar "Carga de trabajo" de Q3 contra Q7). Las
  respuestas quedan guardadas para poder hacerlo después, pero la vista no entra aquí.
- Bloques distintos por sucursal o por rol: todos ven el mismo bloque, como se pidió.

---

## Cómo revisar este plan

Anota en este archivo con `TODO:`, `FIXME:` o `Q:` y lo reflejo. Cuando esté conforme,
cambia **STATUS** a `APPROVED` y empiezo por la Fase 0.
