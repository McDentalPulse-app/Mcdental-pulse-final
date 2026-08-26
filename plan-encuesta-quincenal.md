# Plan — La encuesta pasa de semanal a quincenal

> ## 🔴 REVERTIDO EL 2026-08-17. ESTE PLAN RESOLVIÓ EL PROBLEMA EQUIVOCADO.
>
> **STATUS REAL: la encuesta es SEMANAL. La rotación de bloques sigue siendo quincenal.**
>
> El dueño aclaró el 17 de agosto: cuando dijo «cada 15 días» se refería a **cada cuánto rotan
> LAS PREGUNTAS del bloque**, no a cada cuánto se contesta la encuesta. La rotación ya era
> quincenal antes de este plan (`quincenaNumero`, ceil(n/2) en `encuestaBloques.js`) y nunca se
> tocó. Lo que este plan cambió —la cadencia de respuesta— no era lo que se pedía.
>
> **Consecuencia asumida y correcta:** el mismo bloque de 3 preguntas sale **dos semanas
> seguidas**. La §1.2 de abajo lo trata como un desajuste que había que arreglar; no lo era.
>
> **Qué estuvo quincenal:** del lunes 10 al domingo 16 de agosto de 2026 (una sola quincena, Q4).
> Las 76 encuestas guardadas con clave `2026-W33` se contestaron **todas dentro de esa semana**
> (fechas del 10 al 16), así que ninguna quedó mal atribuida al volver a semanal.
>
> **Cómo se revirtió:** `PRIMER_PERIODO_QUINCENAL = null` en `src/utils/constants.js` y en su
> gemelo de `api/tareas-programadas.js`. Las dos implementaciones ya trataban el corte nulo como
> «nunca quincenal», así que no hizo falta borrar la maquinaria ni migrar la base. Se hizo el
> lunes 17 a las 23:15, con **cero encuestas contestadas todavía esa semana** — verificado contra
> la base antes de tocar nada—, así que nadie tuvo que contestar dos veces.
>
> **Tests reescritos:** `constants.periodoQuincenal.test.js` → `constants.cadenciaEncuesta.test.js`,
> más los bloques quincenales de `periodos.test.js` y `api/periodo.frontVsApi.test.js`. 574 en
> verde. Lo que fijaban sobre paridad de semanas y cambio de año se conservó: la rotación de
> bloques sigue colgando de ahí.
>
> **La maquinaria quedó apagada, no borrada.** Si algún día se quiere quincenal de verdad, se
> enciende poniendo la primera semana de un par (número impar) en las DOS constantes.
>
> Lo de abajo se conserva tal cual se escribió el 2026-08-06, incluido lo que resultó estar mal.

**STATUS ORIGINAL (2026-08-06): FASES 0-2 EN PRODUCCIÓN · FASE 3 PENDIENTE · FASE 4 SIN APROBAR.**

- **D1 aprobada (2026-08-06):** pares de semanas ISO. Clave = primera semana del par.
- **D2 aprobada (2026-08-06):** las 143 encuestas semanales se quedan como están.
- **D3 aprobada (2026-08-06):** el corte es **2026-W33** (lunes 10 de agosto), vía la constante
  `PRIMER_PERIODO_QUINCENAL`. Desplegado hoy e **inerte hasta el lunes**: verificado que hoy
  `claveDelPeriodo()` sigue devolviendo `2026-W32`, idéntico a la semana. Se activa solo.
- **D5 aprobada (2026-08-06):** la tendencia compara contra el período anterior. **No hizo falta
  tocar código**: `scorePrevio` en `usePulseSemana` ya toma la encuesta con la clave inmediatamente
  menor, así que al volverse quincenales las claves, «la anterior» pasa a ser la quincena pasada
  sola. Queda verificarlo en pantalla (Fase 3).
- **D4 sin respuesta explícita.** Se asume la recomendación —dejar a los 11 de W32 sin sus
  respuestas de bloque— porque no afecta al Pulse Score. Si se quiere otra cosa, hay que decirlo.

**Fecha:** 2026-08-06
**Origen:** el dueño reporta «a algunas personas les salen más preguntas que a otras, pero
debiera ser igual a todos y cada 15 días».
**Alcance:** `/opt/pulse/app` en la VPS (producción). Este archivo vive en dos sitios y hay que
mantenerlos iguales: `/opt/pulse/app/plan-encuesta-quincenal.md` y el mismo nombre en el repo
del usuario.
**Antecedente:** `plan-encuesta-bloques.md` (Fases 0-5 en producción desde 2026-07-29). Este
plan **no** rehace ese trabajo: los bloques funcionan. Lo que falta es que la encuesta se
conteste con la misma frecuencia con la que rotan.

---

## 1. Los dos síntomas, y por qué son problemas distintos

### 1.1 Preguntas desiguales — YA NO PASA, y no hubo fallo de código

Los 6 bloques se crearon el **2026-08-04 a las 10:21** (hora de Monterrey), a mitad de la
semana W32. El cuestionario se lee **en vivo** cada vez que alguien abre la encuesta, así que
la población quedó partida por el minuto en que contestó:

| Cuándo contestó | Personas | Preguntas |
|---|---|---|
| 3-ago → 4-ago 10:14 | 11 | 10 (solo núcleo) |
| 4-ago 11:56 → hoy | 19 | 13 (núcleo + bloque) |

Verificado contra las respuestas reales de W32: los 30 contestaron las 10 del núcleo; solo 19
contestaron las 3 de «Confianza para hablar», que es el bloque de esta quincena.

**Consecuencia que SÍ queda:** por el `unique (empleado_id, semana)`, esos 11 no pueden volver
a contestar W32. Se quedan sin las 3 respuestas del bloque de Q3. No afecta al Pulse Score —
los bloques no puntúan, por diseño de `plan-encuesta-bloques.md`.

**Consecuencia que se repetirá:** no hay foto del cuestionario por período. Cualquier edición a
mitad de quincena vuelve a partir a la gente en dos grupos, en silencio. Ver Fase 4.

### 1.2 La cadencia — ESTE es el problema, y empieza el lunes

El bloque rota cada quincena, pero la encuesta se contesta **cada semana**. Comprobado
ejecutando las funciones reales de la app:

| semana | quincena | bloque que toca |
|---|---|---|
| 2026-W31 | Q3 | Confianza para hablar |
| 2026-W32 | Q3 | Confianza para hablar ← hoy |
| 2026-W33 | Q4 | Cómo anda tu cuerpo |
| 2026-W34 | Q4 | Cómo anda tu cuerpo |

Todo lo demás es semanal: el `unique (empleado_id, semana)`, `getISOWeek()`, el reinicio de los
lunes (`refreshSemana`), y `formatSemanaDisplay`, que numera semana a semana. Lo único
quincenal es la rotación del bloque.

Nadie ha contestado aún el mismo bloque dos veces, porque los bloques nacieron a mitad de W32.
**A partir del lunes 10 de agosto (W33) sí:** «Cómo anda tu cuerpo» en W33 y otra vez en W34.

Que la intención era quincenal lo dice el texto que escribió RH:

> «¿Qué tan bien has dormido **estas dos semanas**?»
> «¿Hay algo que hiciste **estas dos semanas** y sientes que pasó desapercibido?»

Preguntado cada semana, ese texto es falso.

---

## 2. El hallazgo que obliga a decidir antes de codificar

**Ya hay DOS definiciones de «quincena» en el código, y están desfasadas una semana.**

- `encuestaBloques.js` → pares de semanas ISO (lunes a domingo), ancladas en `LAUNCH_WEEK`.
- `periodos.js` → 14 días de **sábado a viernes**, anclados en el sábado de la semana de
  lanzamiento, «porque así se trabaja aquí y así se paga». Se usa en los reportes de RH.

Lado a lado (ejecutado, no calculado a mano):

| semana | lunes | Q (bloques) | quincena de nómina (`periodos.js`) |
|---|---|---|---|
| 2026-W31 | 2026-07-27 | Q3 | 2026-07-18 → 2026-07-31 |
| 2026-W32 | 2026-08-03 | Q3 | 2026-08-01 → 2026-08-14 |
| 2026-W33 | 2026-08-10 | Q4 | 2026-08-01 → 2026-08-14 |
| 2026-W34 | 2026-08-17 | Q4 | 2026-08-15 → 2026-08-28 |

No es que difieran: es que **cada quincena de bloques se reparte entre dos quincenas de
nómina**. El JSDoc de `periodos.js` ya avisaba de este precio y lo aceptaba a sabiendas para
los reportes. Al volver la encuesta quincenal, la pregunta deja de ser teórica: la encuesta
tiene que caer en UNA de las dos rejillas.

---

## 3. Decisiones abiertas (son del dueño, no mías)

**D1 — ¿Qué quincena manda?** ✅ **APROBADA: (a) pares de semanas ISO.**

*Decisión de diseño derivada, tomada al implementar (no requiere aprobación aparte pero conviene
saberla):* la clave que se guarda en `encuestas.semana` seguirá siendo **una semana ISO** — la
PRIMERA del par. Así la columna no cambia de tipo ni de formato, `formatSemanaDisplay`,
`semanaNumero`, `rangoDeSemana` y `mesDeSemana` siguen parseándola, y las 143 filas existentes
siguen significando exactamente lo mismo (D2). El coste es cosmético: una encuesta contestada en
la segunda semana del par se guarda con la clave de la primera.

- **(a) Pares de semanas ISO** (la de los bloques). El período de encuesta sigue siendo un par
  de semanas limpio, la llave `semana` se puede derivar sin tocar fechas y la serie del score
  queda ordenada. Coste: el reporte quincenal de RH sigue partiendo cada período en dos.
- **(b) Quincena de nómina** (sábado a viernes). El reporte cuadra con lo que se paga. Coste:
  la llave deja de ser una semana ISO, hay que migrar la columna, y una encuesta contestada en
  sábado cambia de período respecto a hoy.
- *Recomendación:* (a). El motivo es que la llave `semana` es la columna de la que cuelgan el
  `unique`, el historial, la tendencia y la IA; cambiarla a un rango de fechas es el cambio
  caro, y el desajuste con nómina ya existe hoy y ya se decidió aceptarlo.

**D2 — ¿Qué se hace con las 143 encuestas semanales ya guardadas (8 semanas)?** ✅ **APROBADA:
(a) se quedan como están.**

- (a) Dejarlas como están y arrancar quincenal desde el próximo corte. El historial queda con
  dos frecuencias: semanal hasta W32, quincenal desde ahí. Las gráficas de tendencia mostrarán
  puntos más juntos al principio.
- (b) Reagrupar el pasado en quincenas. Hay que decidir qué score gana cuando una persona
  contestó las dos semanas de una quincena (¿el último? ¿el promedio?), y eso **reescribe
  historial** que la psicóloga ya ha leído y anotado.
- *Recomendación:* (a). Es reversible, no toca dato existente, y la única molestia es cosmética.

**D3 — ¿Arranca el lunes 10 de agosto (W33)?**
Es el próximo corte natural y es justo el que evita el primer bloque repetido. Si se aprueba
después del lunes, Q4 ya estará empezada y hay que decidir si W33+W34 cuentan como el primer
período quincenal o se espera a W35.

**D4 — Los 11 de W32 sin respuestas de bloque: ¿se deja así?**
Reabrirles W32 exige tocar el `unique` o borrar sus encuestas. Recomendación: dejarlo. No
afecta al score y el bloque volverá a salir en Q9.

**D5 — ¿Qué pasa con lo que compara semana contra semana?**
Con la encuesta quincenal, la serie tiene la mitad de puntos. Afecta a:
- `usePulseSemana` (tendencia ↑/↓/→ contra la encuesta anterior) — sigue funcionando, pero
  «anterior» pasa a ser hace 15 días, no hace 7.
- `AIEngine`, que arma el contexto como `Encuestas (N semanas)` con el score de cada una.
- Texto de cara al usuario que dice «semanal»: `aiRiskEngine.js` («Pendiente de evaluación
  semanal», «Monitorear semanalmente»), y el encabezado de `EncuestaEmpleado` («Semana …»).
- *Pregunta concreta:* ¿la tendencia debe seguir comparando con el período inmediatamente
  anterior (recomendado), o mantener una ventana de tiempo fija?

---

## 4. Superficie de impacto (medida, no estimada)

Archivos que tocan la semana de la encuesta, por identificador:

| Identificador | Archivos |
|---|---|
| `isSemanaActual` | `EncuestaEmpleado`, `InicioEmpleado`, `PsicologaSeguimiento`, `GestionEncuestas` |
| `semanaActual` | `usePulseSemana`, `AIEngine`, `HRDashboard`, `PsicologaSeguimiento`, `ChecadorEmpleado` |
| `semanaDisplay` | `EncuestaEmpleado`, `InicioEmpleado`, `GestionEncuestas` |
| `formatSemanaDisplay` | 13 archivos (los 3 dashboards, expediente, historial, ficha, reportes, IA, `periodos.js`…) |
| `normalizeWeek` | `encuestaDetail.js`, `HistorialEmpleado` |
| `bloqueDeLaSemana` | `EncuestaEmpleado`, `GestionEncuestas`, `GestionBloques`, 2 servicios |
| `refreshSemana` | `App.jsx` (el timer que cruza el lunes) |

En base de datos: `encuestas.semana` (texto), `uq_encuestas_empleado_semana`.

**AÑADIDO EL 2026-08-06, no estaba en la primera versión de este plan.** Hay un **sexto portón,
en el servidor**, que no salió en el grep original porque no importa nada de `constants.js`:

`api/tareas-programadas.js` tiene **su propia copia de `getISOWeek`** (línea 26) y manda el
recordatorio de encuesta los **martes, jueves y viernes** (`DIAS_RECORDATORIO_ENCUESTA = [2,4,5]`)
a todo `role='empleado'` sin encuesta de `semana = getISOWeek()`.

Si la cadencia pasa a quincenal y esto no se cambia, **durante la segunda semana de cada quincena
todo el mundo recibe tres recordatorios por una encuesta que ya contestó** (o que no le toca). Es
el efecto más visible de un cambio a medias, y le llega al teléfono de 95 personas.

Entra en la Fase 2, no en la 3: es lógica de cadencia, no texto. Y ojo con la duplicación —
compartir el concepto entre `src/` y `api/` no es trivial (el api no importa del front), así que
lo más probable es que haya que duplicar la regla a conciencia y dejar constancia en los dos
lados. Detalle aparte: el recordatorio solo va a `role='empleado'`, así que los doctores nunca lo
reciben. No lo toco — pero si es un olvido, es otro ticket.

`ChecadorEmpleado` y `GestionHorarios`/`ImportarHorarios` usan «semana» para **asistencia y
horarios**, que son otra cosa y NO se tocan. Es la trampa principal de este cambio: el mismo
nombre para dos conceptos distintos.

---

## 5. Fases propuestas

Cada fase deja la app funcionando. Ninguna se despliega sin la anterior verificada.

**Fase 0 — Un solo sitio que diga qué período es.** ✅ **HECHA (2026-08-06).**
Añadidos a `constants.js`: `periodoActual` y `periodoDisplay` (live bindings, actualizados por
`refreshSemana` junto con los de semana), `esPeriodoActual(clave)` y `claveDelPeriodo()`. Hoy son
alias exactos de la semana. Migrados los 8 sitios de la encuesta en 9 archivos, 30 ediciones.

`claveDelPeriodo()` es función y no live binding a propósito: es lo que se ESCRIBE en
`encuestas.semana` (`EncuestaEmpleado.jsx:77`, el único punto de escritura), y calcularlo en el
momento del envío es lo que hacía `getISOWeek()` antes. Con un live binding, una app abierta desde
antes del lunes guardaría la clave vieja hasta que el timer de `App` la refrescara.

*Aceptación cumplida:* eslint sin hallazgos nuevos —comparado linteando las versiones de HEAD en
el mismo directorio, para que use la misma config: los 12 problemas previos siguen siendo los
mismos y de hecho **hay uno menos** (`semanaActual` estaba importado y sin usar en
`PsicologaSeguimiento` y se cayó al reescribir la línea). 517 tests en verde (512 + 5 nuevos).

*El criterio de aceptación que escribí antes era flojo* y lo digo aquí para que no se repita:
«el agregado de encuestas idéntico antes y después» no prueba nada, porque esta fase no toca la
base y el agregado se mueve solo mientras la gente contesta (de hecho se movió, de 30 a 31 en
W32, mientras trabajaba). Lo que de verdad sostiene esta fase es el diff 1:1 y los tests.

*Prueba nueva y permanente* (`src/utils/constants.periodo.test.js`, 5 casos): no fija que el
período sea la semana —eso cambia en la Fase 2— sino la COHERENCIA entre las cuatro piezas. El
caso que importa es `esPeriodoActual(claveDelPeriodo()) === true`: si la clave que se guarda no
es la que el portón reconoce, la persona manda su encuesta y la app se la vuelve a pedir de
inmediato, con el `unique` rechazando el segundo envío. Ese desajuste es exactamente lo que
puede aparecer al cambiar la cadencia en un sitio y no en otro.

*Cambio de comportamiento, uno y diminuto:* `ChecadorEmpleado.jsx:270` era el cuarto portón de
«¿ya contestó?» y el único que comparaba a mano contra el live binding en vez de usar la función.
Ahora usa la misma que los otros tres. Podían divergir al cruzar el lunes con la app abierta;
en la práctica nunca, porque ese código vive dentro de una rama que solo corre en sábado.

**Fase 1 — Tests que fijan la cadencia deseada.** ✅ **HECHA (2026-08-06).**
`src/utils/constants.periodoQuincenal.test.js`. Se ejecutaron ANTES de implementar: 10 en rojo
por el motivo correcto (`claveDePeriodo is not a function`) y 1 en verde, la de coherencia, que ya
se cumplía. No por un import roto.

**Fase 2 — La cadencia cambia.** ✅ **HECHA Y DESPLEGADA (2026-08-06).**
`claveDePeriodo(semana)` mapea cada semana ISO a su clave de período; desde el corte, las dos
semanas del par devuelven la primera. `claveDelPeriodo()` es lo que se escribe.

`esPeriodoActual` normaliza LAS DOS partes antes de comparar, en vez de exigir igualdad exacta.
Cubre un caso real: un teléfono con el bundle viejo en caché manda `semana: getISOWeek()`, que en la
segunda semana de la quincena es W34 y no W33. Con igualdad exacta el portón no lo reconocería, la
app le volvería a pedir la encuesta, y se guardaría una segunda fila con clave W33 — dos encuestas
en la misma quincena, sin que el `unique` lo impida porque las claves difieren.

**El sexto portón, el del servidor, entró aquí** (`api/tareas-programadas.js`): la regla está
duplicada porque `api/` y `src/` son bundles independientes. Un comentario que diga «cambia los
dos» no impide que alguien cambie uno, así que hay un test que los compara semana a semana
(`api/periodo.frontVsApi.test.js`) — y **pilló una divergencia real, mía**, ver abajo. El
recordatorio ahora filtra con `.in("semana", [primera, segunda])`, así que reconoce las dos claves
del par. Su texto se dejó NEUTRO («Encuesta pendiente», sin «semanal» ni «quincenal») para que sea
correcto antes y después del corte, sin depender de la hora del despliegue.

*Aceptación cumplida:* 535 pruebas en verde (era 512 al empezar la sesión), eslint limpio en los 5
archivos, y contra la base: 0 encuestas con clave W33 o W34, así que el lunes nadie arranca a
medias. Un test fija además que las 8 claves que existen hoy en producción no se reagrupan (D2).

**DOS FALLOS QUE APARECIERON AQUÍ Y NO ESTABAN PREVISTOS:**

1. **Preexistente, en `isoWeekToMonday`:** anclaba en el 1 de enero en vez del 4, así que
   `2026-W53` y `2027-W01` devolvían el MISMO lunes y `semanaNumero` les daba a las dos n=27; de
   ahí en adelante la numeración iba corrida una semana respecto a `getISOWeek`. No se podía
   dejar para después porque **el emparejamiento quincenal depende de la PARIDAD de
   `semanaNumero`**: en el cambio de año se emparejarían las semanas equivocadas y un bloque se
   repetiría o se saltaría. Arreglado con el anclaje del 4 de enero, que `rangoDeSemana` ya usaba
   en el mismo archivo. Comprobado que no mueve ningún dato actual (para W27..W32 las dos formas
   dan el mismo lunes) y que ninguna prueba existente se rompió. Lo encontró el test de ida y
   vuelta de 160 semanas.
2. **Mío, en el gemelo del servidor:** copié al `api/` la versión vieja del anclaje y solo
   arreglé la del front. Lo pilló el test front-vs-api en la primera ejecución (`n=28: expected
   '2027-W01' to be '2026-W53'`). Y eslint pilló un tercero, un `return { semana }` huérfano tras
   renombrar la variable, que habría reventado la tarea en ejecución y no en el build.

**Fase 3 — Lo que se ve.** ⬜ PENDIENTE. Nada de esto rompe datos: son etiquetas que quedan mal.

Lista concreta, medida sobre el código ya desplegado:

- **Encabezados «Semana {periodoDisplay}»** en `EncuestaEmpleado`, `InicioEmpleado` y
  `GestionEncuestas`. Desde el lunes dirán «Semana 2026-W07» durante las dos semanas del par —
  o sea que en la segunda semana el número se queda quieto. Es el coste cosmético que D1 aceptó.
  Debería decir «Quincena N · del d al d».
- **`rangoDeSemana(semana)` en `HRDashboard`**: pinta el rango de fechas de UNA semana, así que
  desde el lunes muestra 7 de los 14 días del período.
- **`aiRiskEngine.js`**: «Pendiente de evaluación semanal», «Monitorear semanalmente».
- **`AIEngine`**: arma el contexto como `Encuestas (N semanas)`.
- **El reporte «semana» de `periodos.js`** agrupa por la columna `semana`; desde el corte esa
  columna ya es una quincena, así que la opción «semana» del reporte de RH devuelve quincenas
  bajo una etiqueta que dice semana. Es el sitio donde una etiqueta mal puesta puede llevar a
  una decisión mal tomada, así que de la Fase 3 es lo primero.
- **Verificar D5 en pantalla**: que la flecha ↑/↓ compare contra la quincena anterior. El código
  ya lo hace (`scorePrevio` toma la clave inmediatamente menor); falta verlo.

*Aceptación:* revisión con sesión real de las 3 pantallas de gestión y la del empleado. **Esto
necesita que alguien con cuenta lo abra** — yo no tengo sesión.

**Fase 4 — Foto del cuestionario por período (cierra §1.1).**
Que la encuesta guarde qué preguntas se le mostraron, o que el cuestionario quede congelado al
abrir el período. Cierra el agujero de que una edición a mitad de período parta a la gente.
*Aceptación:* añadir una pregunta a mitad de período no cambia lo que ve quien ya contestó, y
dos personas del mismo período tienen siempre el mismo número de respuestas.
*Nota:* esta fase es separable — se puede aprobar sola, sin el cambio de cadencia.

**Fase 5 — Documentar.**
`plan-encuesta-bloques.md` (que da por hecha la cadencia semanal), `HANDOFF` y este archivo.

---

## 6. Riesgos

1. **El mismo nombre para dos conceptos.** «Semana» es la de la encuesta Y la de horarios y
   asistencia. Un cambio con buscar-y-reemplazar rompe la asistencia. Mitigación: Fase 0 nombra
   el concepto nuevo (`periodo`) en vez de redefinir `semana`.
2. **Historial que la psicóloga ya leyó.** D2b reescribiría scores sobre los que hay notas
   escritas. Mitigación: D2a, que no toca nada.
3. **Comparabilidad del Pulse Score.** Es el riesgo que ya identificó
   `plan-encuesta-bloques.md`: el score es la media del núcleo, y el núcleo no cambia, así que
   el score sigue siendo comparable. Lo que cambia es cada cuánto hay un punto en la serie.
4. **Menos señal para detectar riesgo.** Pasar de 52 a 26 mediciones al año es la mitad de
   oportunidades de ver a alguien caer en rojo. Es una decisión de producto, no técnica, y
   conviene decirla en voz alta: el dueño pidió quincenal y esto es lo que cuesta.
5. **La ventana es corta.** Si esto no se decide antes del lunes 10, el primer bloque repetido
   ya habrá salido. No rompe datos — solo se ve repetitivo y el texto «estas dos semanas»
   queda mal dos veces.
