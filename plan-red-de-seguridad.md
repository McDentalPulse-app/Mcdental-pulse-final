# Plan — Que un fallo invisible deje de tardar tres días

**STATUS: FASES 1, 2 Y 3 EN PRODUCCIÓN (2026-08-06). PLAN COMPLETO.**
Queda suelto lo de §5 (3 personas sin rostro aprobado), que no es de este plan.
**Fecha:** 2026-08-06
**Origen:** el dueño pregunta qué le falta a la app, después del incidente de McDental Palmas.
**Alcance:** `/opt/pulse/app` en la VPS. Este archivo vive en dos sitios y hay que mantenerlos
iguales: `/opt/pulse/app/plan-red-de-seguridad.md` y el mismo nombre en el repo del usuario.

---

## 0. La corrección que ordena todo lo demás

Mi primera respuesta a «qué le falta» fue **«la app no sabe avisar cuando está fallando»**. Es
falso, y conviene que quede escrito porque la conclusión contraria lleva a construir lo que ya
existe.

Lo que de verdad pasó con Palmas, comprobado en `notificaciones`:

| Cuándo | Aviso | Estado |
|---|---|---|
| 04, 05 y 06-ago 07:00 | «Revisa la ubicación de McDental Palmas» | **leído** por admin y psicóloga · `critica = false` |

El vigilante **existe, funcionó y avisó tres días seguidos**. El aviso se abrió. Y no pasó nada.

También me equivoqué en una segunda lectura: atribuí a Palmas el aviso «3 personas no pueden
checar». **No es de Palmas** — es de la clave `sin_rostro`, gente sin rostro aprobado, un problema
distinto y todavía abierto (ver §5).

Con eso, el problema no es detección. Es **peso, cobertura del caso parcial, y un envenenamiento
de datos que nadie ha visto todavía.**

---

## 1. Por qué un aviso correcto no sirvió de nada

`revisar_geocercas()` tiene dos alarmas y una sugerencia:

- **`muda`** — cero checadas desde que se fijó la geocerca. Se notifica **crítica**.
- **`lejos`** — la mediana de las checadas reales cae MÁS LEJOS que el radio. Se notifica **no
  crítica**.
- **`propuesta`** — clínica sin geocerca con un punto claro. No se notifica.

Las dos cosas que fallaron:

**1.1 `muda` no podía disparar.** Exige `count(checadas_después) = 0`. En Palmas, Sandra siguió
fichando todos los días **desde la Oficina Administrativa**, que es justo donde ella misma había
movido la geocerca. La clínica nunca estuvo muda: estaba secuestrada. El detector mira la clínica
en agregado, y en agregado se veía viva.

**1.2 `lejos` sí disparó, pero pesaba lo mismo que un recordatorio.** Y aquí está el error de
diseño, no de implementación: **el branch `lejos` solo existe cuando `distancia > radio`**. Esa
condición, leída despacio, significa que **la gente que trabaja ahí está fuera del área y no
puede fichar**. No hay ningún caso de `lejos` que no sea gente bloqueada. Aun así el texto decía
«Conviene revisar la ubicación» y llegaba sin marcar.

Un aviso no crítico se lee y se olvida; uno crítico se queda clavado en la campana con la
etiqueta «Sigue sin resolverse» hasta que el problema desaparece (mig. 110). La diferencia entre
tres días y una mañana era esa marca.

---

## 2. Fase 1 — Severidad por consecuencia, no por motivo ✅ HECHA

Migración **115** + una línea en `api/tareas-programadas.js`.

- `lejos` pasa a notificarse **crítica**, igual que `muda`. Justificación: la condición de disparo
  ya garantiza gente bloqueada; tratarlo como aviso menor era describir una avería como un recado.
- El texto deja de sugerir y dice lo que pasa: cuántas personas fichan ahí y que están fuera del
  área. El título también: «Nadie puede fichar en X» / «En X no pueden fichar: la ubicación está
  mal puesta».

*Aceptación:* la RPC devuelve el texto nuevo contra los datos reales; el aviso llega con
`critica = true`; y **no se toca la lógica de detección** — solo el peso y las palabras. Lo que ya
detectaba, sigue detectándolo igual.

---

## 3. Fase 2 — El caso parcial: personas, no clínicas ✅ HECHA

Era el agujero de verdad: nada miraba a una persona concreta. Si de cuatro personas tres quedan
bloqueadas y una ficha, la clínica se veía sana por todos lados — `muda` no disparaba, y la
mediana que usa `lejos` se la comía la que sí fichaba (13 m, «ok»). El agregado no escondía el
problema, lo certificaba como correcto.

Migración **116**: `personas_que_dejaron_de_fichar()`, más `revisarPersonasQueNoFichan` en la
tarea diaria. Dos motivos: `dejo_de_fichar` y `nunca_ficho`. **Es agnóstico a la causa** — no sabe
de geocercas; detecta silencio donde antes había datos, venga de una geocerca, de un rostro sin
aprobar, de un teléfono nuevo o de la app caída.

### La primera versión estaba mal, y los datos reales lo dijeron

La escribí midiendo **ausencias sueltas en los últimos 7 días**. Contra producción devolvió **18
personas**:

| Fallo | Qué pasó |
|---|---|
| Se perdía a quien buscaba | Juana y Valeria **no salían**: tenían 2 entradas y el umbral pedía ≥3, así que caían en la grieta entre «tiene costumbre» y «nunca fichó» |
| Marcaba a quien fichó hoy | 6 filas con `ultima_fecha` = ese mismo día. Contar ausencias sueltas es medir **ausentismo** (trabajo de RH), no bloqueo |
| Marcaba a la dirección | Mario, Ana Goretty y Maricruz: tienen horario cargado pero no fichan nunca. Filtrar por «tiene horario» en vez de por rol fue un error |

16 de 18 eran ruido y faltaban los 2 que importaban. Exactamente el fallo del que advertía este
plan antes de escribirlo.

### La regla que sí funciona

**Días laborables transcurridos desde la última vez que SÍ pudo fichar** — una racha que llega
hasta hoy, no ausencias dispersas. Más: filtro por rol (`empleado`, `doctor`), basta **una**
entrada previa para contar como «fichaba», y tope de 30 días para no arrastrar expedientes viejos.
Se descuenta todo lo justificado: festivos, vacaciones y permisos **aprobados**, días sin horario,
y el periodo de prueba de la app.

Resultado contra producción — 6 filas, y las tres de Palmas nombradas:

```
JUANA GARAY COVARRUBIAS          | McDental Palmas          | dejo_de_fichar | 2 días | 03-ago
VALERIA TERESA ALCARAZ GARCÍA    | McDental Palmas          | dejo_de_fichar | 2 días | 03-ago
CINTHYA GUADALUPE UGALDE PEDRAZA | McDental Palmas          | nunca_ficho    | 3 días
DANNA ESMERALDA SANTOS MARTINEZ  | McDental Madero          | dejo_de_fichar | 4 días | 31-jul
PERLA IDESVI CRUZ INOCENCIO      | McDental Tampico Obregon | dejo_de_fichar | 4 días | 31-jul
MARIANA PADRON CRUZ              | Oficina Administrativa   | dejo_de_fichar | 4 días | 30-jul
```

**Las tres últimas son casos reales que nadie estaba mirando** y que no tienen nada que ver con
Palmas: llevan entre 4 y 7 días sin fichar, sin vacaciones ni permiso aprobado. Alguien tiene que
averiguar si están bloqueadas, de baja o ya no trabajan aquí.

*Aceptación cumplida:* nombra a las 3 personas que sabemos que estaban bloqueadas; no incluye a
nadie que haya fichado hoy; no incluye a la dirección; `service_role` puede ejecutarla (probado
con `set role`, que es el camino real del api). Un solo aviso con la lista y no uno por persona —
seis por tres destinatarios serían 18 filas y una campana llena deja de leerse.

*Sin verificar en vivo:* la tarea corre a las 07:00 y no la disparé a mano, porque manda
notificaciones reales a las tres personas de gestión.

---

## 4. Fase 3 — La mediana envenenada ✅ HECHA

Antes de esta fase, con Palmas sin geocerca, la RPC proponía como ubicación de la clínica un punto
a **996 m, en otro edificio** (la Oficina Administrativa). Las propuestas no se notifican, así que
nadie la iba a ver por sorpresa — pero estaba en la pantalla de Sucursales esperando un «aceptar»
que habría vuelto a bloquear la clínica entera.

Migración **117**: mediana **por persona** primero, y luego la mediana de esos puntos. Una persona,
un voto, fiche una vez o cincuenta. Los guardias viejos contaban personas en el conjunto pero no
exigían que coincidieran entre sí: «13 checadas de 3 personas» era en realidad una persona repetida
nueve veces.

**Los dos branches llevan guardianes distintos, y esto es lo importante del diseño:**

| | Guardián | Por qué |
|---|---|---|
| `propuesta` | exige **acuerdo** (≥3 personas dentro de 75 m del centro) | alguien la va a aceptar con un clic; ante la duda, callarse |
| `lejos` | **sin** acuerdo, solo el centro | es una alarma de gente encerrada fuera, y aquí el error caro es el silencio |

Si hubiera puesto el acuerdo también en `lejos`, Palmas habría dejado de disparar la única alarma
que sí funcionó. Sensibilidad para la alarma, confianza para la sugerencia.

**Y de paso arregla el punto ciego de `lejos` que documentaba la Fase 1.** Medido contra las
checadas reales de Palmas (Sandra 9 en la oficina, Juana 2 y Valeria 2 en la clínica):

```
mediana VIEJA (una checada, un voto)  ->   13 m de la geocerca mala  ->  «ok», sin alarma
mediana NUEVA (una persona, un voto)  ->  992 m de la geocerca mala  ->  dispara `lejos`
```

Dos votos contra uno devuelven el centro a la clínica. La alarma que tardó tres días habría llegado
el primer día y con el número correcto.

*Aceptación cumplida, medido sobre las 23 sucursales con checadas utilizables:*
- **22 no se mueven**: el centro cambia entre 0 y 3 m y en todas las personas concuerdan.
- **Palmas** mueve su centro 980 m (vuelve a la clínica) y solo 2 de 3 concuerdan → deja de
  proponer. La RPC pasa de 1 fila a **0**: la trampa desaparece sin inventar falsas alarmas.
- Se probó primero exigiendo ≥2 checadas por persona y **se descartó**: dejaba de vigilar Madero y
  Tampico Obregón, que habían perdido una votante justo porque alguien dejó de fichar. Castigaba a
  las clínicas con problema. Sin ese mínimo, las 22 siguen vigiladas.
- Firma de la función idéntica (mismos tipos, LANGUAGE sql, STABLE, SECURITY DEFINER, search_path).

---

## 5. Suelto, encontrado por el camino: 3 personas sin rostro ⬜

El aviso `sin_rostro` dice **«3 personas no pueden registrar entrada»**, con `exigir_rostro`
activo. Se notificó el 05-ago, se leyó, y sigue así. No es de Palmas y no lo he investigado: son
tres personas que hoy no pueden fichar por un motivo distinto. Merece su propio rato.

---

## 6. Lo que este plan NO propone

- **Construir un vigilante.** Ya está, y es bueno: ventanas comparables de 24 h para no confundir
  bloqueo con domingo, mediana en vez de promedio para que una checada de otra ciudad no arrastre
  el centro, freno de 48 h para no repetir la misma alarma, y el dato en el título para que
  empeorar sí vuelva a avisar. Nada de eso hay que rehacerlo.
- **Subir la severidad de todo.** Si todo es crítico, nada lo es. `propuesta` sigue sin notificar
  y las alarmas de salud siguen con su clasificación.
