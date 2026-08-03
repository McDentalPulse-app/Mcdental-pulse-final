# McDental Pulse

Plataforma interna de **bienestar organizacional** para McDental. Gestiona encuestas
semanales (Pulse Score), expedientes, permisos/descuentos/reconocimientos de RH,
reportes confidenciales clínicos y un motor de IA. PWA en español, cuatro roles:
**admin · rh · psicóloga · empleado**.

## Stack

- **Frontend:** React 19 + Vite + React Router 7 (PWA con `vite-plugin-pwa`)
- **Datos:** Supabase (Postgres + Row Level Security) · Supabase Auth · Supabase Storage para archivos de expediente
- **IA:** Google Gemini (`gemini-2.5-flash`) vía proxy serverless (la key vive en el servidor)
- **Iconos:** lucide-react · estilos en `src/index.css` (tokens) y `src/App.css`

## Puesta en marcha

```bash
npm install
npm run dev      # desarrollo (Vite). Para probar /api/gemini en local usa `vercel dev`
npm run build    # build de producción
```

### Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

| Variable | Dónde | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | cliente | Config pública del SDK de Supabase (no son secretos; la seguridad la da RLS) |
| `GEMINI_API_KEY` | **servidor** | Key de Gemini. Sin prefijo `VITE_` → no entra al bundle. La consume `api/gemini.js`. En producción se configura en Vercel → Environment Variables |
| `MCTIC_API_URL` | **servidor** | URL de MCTIC (sistema de tickets de TI), p. ej. `https://mctic.vercel.app`. La consume `api/soporte-ticket.js` |
| `MCTIC_INTEGRATION_KEY` | **servidor** | Clave de servicio de MCTIC. **Debe ser idéntica** a la que tiene MCTIC en su propio entorno, o rechazará los tickets con 401 |

> ⚠️ La IA se llama a través del proxy `api/gemini.js`. Nunca pongas la key de Gemini con prefijo `VITE_` (quedaría expuesta en el bundle del navegador).

## Estructura

```
api/gemini.js            Proxy serverless de Gemini (key server-side)
api/soporte-ticket.js    Proxy serverless a MCTIC: alta (POST) y consulta (GET) de tickets
                         de TI. Valida el JWT de Supabase; la clave de integración vive
                         en el servidor y nunca llega al navegador
api/idea-mejora.js       Hermano del anterior para «Ideas de mejora»: escribe en el tablero
                         de Pendientes de MCTIC con la etiqueta idea-pulse. Mismo criterio —
                         el correo del solicitante sale del JWT verificado, nunca del cliente
api/tareas-programadas.js  Cron diario: cierre de jornadas abiertas, recordatorio de encuesta
                         y revisión de geocercas (`revisar_geocercas`)
supabase/
  migrations/            Schema SQL + RLS policies + Storage policies
  functions/             Edge Functions (admin-create-usuario, admin-reset-password)
src/
  components/            UI por rol (admin, rh, psicologia, empleados, ia, layout, common…)
  contexts/              Auth, Global, Notification, Theme
  services/supabase/     Acceso a datos (una función por operación)
  utils/                 pulseScore, constants (semanas), helpers, analysisEngine,
                         asistencia (estados, horaEnClinica, FIN_PERIODO_PRUEBA),
                         periodos (semana/quincena/mes), errores, exportarExcel…
  config/                supabase, theme, constants
```

## Despliegue

**Desde el corte del 2026-07-27, producción es la VPS.** Vercel + Supabase Cloud siguen
encendidos pero congelados, como única vía de rollback.

- **Producción — VPS.** `https://mcdentalpulse.duckdns.org`. Docker sobre `2.25.150.106`,
  código en `/opt/pulse/app`, Supabase autoalojado (Postgres, Auth, Storage, Realtime,
  Edge Functions) y Jitsi en el mismo servidor. Es la única instalación que usa la clínica.
  Runbook completo en `/opt/pulse/HANDOFF.md`.
- **Backup — `MCDentalSist/MCDentalPulseBackUp`** (remoto `origin`). La rama **`vps-docker`**
  es el espejo de lo que corre en producción; `main` quedó en el árbol previo al corte.
- **Rollback — `McDentalPulse-app/Mcdental-pulse-final`** (remoto `prod`), el repo que
  alimentaba Vercel. Desde el 2026-08-03 su `main` vuelve a estar al día con la VPS, para que
  la vía de rollback no arranque tres días atrás.

> **Dónde se trabaja: `vps-docker`.** Es la rama que existe en la VPS y la que se empuja a los
> dos repos. `origin/main` quedó en el árbol previo al corte y la `develop` de `prod` es
> historia más vieja todavía; ninguna de las dos despliega nada.

### Cómo se despliega en la VPS

| Qué | Cómo |
|---|---|
| Frontend | `/opt/pulse/build-frontend.sh` — **siempre este script**, nunca un `docker build` a mano: la URL de Supabase se compila DENTRO del bundle y la usa el navegador, así que tiene que ser la pública. Tomarla de `api.env` mete `http://pulse-kong:8000` (la dirección interna de Docker) y deja la app sin poder iniciar sesión. El script la fija, verifica que el bundle la contenga y, si no, aborta y restaura la imagen anterior |
| Migraciones | `docker exec -i pulse-db psql -U postgres < supabase/migrations/000000000001NN_*.sql` |
| Edge Functions | copiar a `/opt/pulse/pulse-supabase/supabase-project/volumes/functions/` y reiniciar `pulse-edge-functions` |
| API | reconstruir la imagen `pulse-api` y recrear `pulse-api-server` |

### Sobre Vercel

`McDentalPulse-app/Mcdental-pulse-final` **despliega solo**: cada push a `main` dispara un
deploy de producción de `vercel[bot]`. `mcdental-pulse-final.vercel.app` responde hoy un **307
temporal hacia la VPS**, conservando la ruta (`/admin/ai` → `mcdentalpulse.duckdns.org/admin/ai`).

Hasta el 2026-08-03 ese redirect se había desplegado **a mano** y no estaba en git: el
`vercel.json` del repo seguía siendo el de la aplicación completa, con sus `crons`. Era una
trampa — cualquier push a `main` habría reemplazado el redirect por la app y reactivado las
tareas programadas por su cuenta. **Ahora `vercel.json` ES el redirect**, así que el repo dice
lo que Vercel hace y un despliegue accidental ya no puede romperlo. En la VPS ese archivo no lo
lee nadie.

> **Para volver a Vercel de verdad** (rollback): recuperar el `vercel.json` completo — está en
> el historial, `git log --oneline -- vercel.json` — y revisar antes las variables de entorno
> del proyecto y los `crons`, que volverían a dispararse.

> 🔴 **La vía de rollback está rota hoy, y no por el redirect.** Los dos últimos despliegues de
> Vercel fallaron: el del 2026-07-31 (`f1a27e7`) y el del 2026-08-03 (`f0985a0`). La causa más
> probable es el **tope de funciones serverless del plan Hobby, que son 12**: el último
> despliegue que sí funcionó —`29bc64e`, del 24 de julio— tenía exactamente 12, y hoy `api/` ya
> lleva **19** (los archivos que empiezan por `_` son helpers y no cuentan). Es decir: mientras
> el redirect siga en pie la clínica no lo nota, pero **si hiciera falta volver a Vercel, no
> compilaría**. Salir de ahí pasa por subir de plan o por fusionar funciones hasta bajar de 12.

---

## Changelog

### 2026-08-03 (noche, 5) · En el teléfono, Soporte TI quedaba fuera de la pantalla

> Reportado como «no se ve el chat de Soporte TI y hay que hacer mucho scroll». Las dos cosas
> tenían la misma causa.

- **🔴 La lista de conversaciones estaba recortada a 72px, con filas de 56px.** Cabía **una
  conversación y media**. Quien tiene a la psicóloga y a Soporte TI —o sea, toda la plantilla—
  veía la primera y nada más: la tira de 72px no parece desplazable, así que no había ninguna
  pista de que hubiera algo debajo. Y había un **segundo cerrojo** en el breakpoint de 430px que
  lo apretaba todavía más, a 112px: en un teléfono normal se veía la cabecera y una fila.
- **🔴 Y el chat seguía debajo, así que la página entera pedía scroll.** El contenedor usaba
  `min-height`, o sea que el contenido lo empujaba hacia abajo: había que bajar y subir para ver
  la interfaz, además del scroll interno del chat. Ahora tiene **alto fijo** al hueco disponible
  y lo único que se desplaza es la lista o los mensajes, por dentro.
- **🆕 O la lista, o el chat — nunca los dos aplastados.** El mismo patrón que ya usa el
  expediente: la lista ocupa la pantalla, y al abrir una conversación se retira y aparece un
  botón para volver. En escritorio no cambia nada, porque allí las dos columnas caben.

El detalle que lo hacía invisible: `selected` cae por defecto en la primera conversación, así
que en el teléfono **siempre** había un chat abierto y la lista nunca llegaba a verse entera. La
clase de detalle mira `selectedId` —lo que la persona ha abierto— y no `selected`.

Verificado con Chromium a 390px en los dos estados, sobre el CSS ya compilado.

### 2026-08-03 (noche, 4) · RH aprobaba vacaciones sin saber de qué día a qué día eran

- **🔴 La pantalla de vacaciones no enseñaba las fechas.** Pedía `v.inicio` y `v.fin`, dos campos
  que el servicio **nunca ha devuelto** —se llaman `fechaInicio` y `fechaFin`—, así que pintaba
  la palabra **«al» suelta**, sin fechas a los lados, y debajo «5 días». O sea que quien aprobaba
  unas vacaciones no sabía de cuándo a cuándo eran. El dato estaba en la base desde siempre
  (20 al 24 de agosto): solo no llegaba a la pantalla. Es el tipo de fallo que no revienta nada
  y por eso puede vivir meses a la vista.
- **🆕 Las fechas se dicen como las diría una persona.** «20 ago 2026 al 24 ago 2026» en vez de
  `2026-08-20`, y un solo día no se repite dos veces. Mismo formato en vacaciones y en permisos,
  que enseñaban la fecha cruda de la base — correcta, pero se lee como un dato de sistema.
- **⚠️ Sin fecha fin es UN SOLO DÍA, no un rango abierto.** La primera versión del formateador
  decía «Desde el 10 ago 2026» cuando faltaba el fin, y eso habría afirmado que tres permisos
  reales seguían abiertos: en permisos, `fecha_fin` nulo significa justamente permiso de un solo
  día (migración 038). Cazado al probarlo contra los datos de producción antes de desplegar.
- **🆕 El comentario de RH por fin se ve en vacaciones.** Se guardaba al aprobar o rechazar, pero
  no se enseñaba en ninguna parte: quien escribía el motivo de un rechazo no volvía a verlo.

9 pruebas nuevas para el formateador, incluida una que fija el fallo original: nunca debe quedar
un «al» sin fechas alrededor.

### 2026-08-03 (noche, 3) · El expediente abría con un hueco del tamaño de media pantalla

> Reportado como «se ve mal acomodado». Lo reproduje con el CSS compilado de verdad y el
> problema estaba a la vista en el primer golpe de ojo.

- **🔴 «Datos generales» dejaba dos columnas vacías a su derecha.** Las secciones se colocaban
  con `grid: repeat(auto-fit, minmax(320px, 1fr))`, o sea tres columnas en una pantalla normal.
  «Datos generales» es una tarjeta de ancho normal **seguida de una ancha** («Archivos», que
  ocupa `1 / -1`), así que se quedaba **sola en su fila** con dos huecos al lado. Era lo primero
  que se veía al abrir cualquier expediente.
- **🔴 Y encima estiraba los datos en vertical.** Encerrados en una tarjeta de 320px, los ocho
  campos —puesto, sucursal, ingreso, antigüedad, cumpleaños, teléfono, estatus, encuestas— se
  apilaban en ocho renglones. Su propia rejilla interna (`expediente-datos`, `minmax(240px, 1fr)`)
  puede repartirlos en cuatro columnas: solo le faltaba sitio. Ahora va a lo ancho y ocupa **dos
  filas en vez de ocho**.
- **🔴 Huecos entre secciones de altura distinta.** En una rejilla, cada fila es tan alta como su
  tarjeta más alta: «Vacaciones» con una fila junto a «Permisos» con siete dejaba un agujero
  debajo de la corta. El contenedor pasa de `grid` a **columnas** (`columns: 340px` +
  `break-inside: avoid`), que empaquetan las tarjetas una debajo de otra sin aire muerto. Las
  secciones anchas cruzan con `column-span: all`, que parte el flujo justo donde se quiere.

Verificado con Chromium sobre el CSS ya compilado, en escritorio y en un móvil de 390px (donde
cae a una sola columna, como antes).

- **🔴 Y la sección «vacía» nunca se encogió, aunque el código creyera que sí.** Había una regla
  para ello desde hace tiempo —recortaba el relleno de la tarjeta— pero no servía de nada:
  `.expediente-seccion-vacio` y `.mc-empty` tienen **la misma especificidad**, y `.mc-empty`
  está 5.000 líneas más abajo en `App.css`, así que ganaba por orden y conservaba sus 24px
  arriba y abajo y su centrado. Cada sección sin datos era una caja de ~140px con una frase
  flotando en medio, y en un expediente recién creado son **seis cajas así seguidas**. Anidada
  bajo el modificador son dos clases, que ganan sin depender de dónde caiga la regla. Ahora una
  sección vacía es su título con una línea debajo, alineada a la izquierda: es una nota al pie,
  no un estado vacío de pantalla completa.
- **🆕 Vacaciones, Permisos y Reconocimientos pasan a ancho completo**, como Archivos. A dos
  columnas quedaban tarjetas estrechas medio vacías y una tercera sola con un hueco al lado.

### 2026-08-03 (noche, 2) · Los tres dashboards dejan de ser tres copias que se estaban separando

> Petición: que RH y psicóloga tengan los elementos que les faltan del de admin. Al abrirlos, el
> problema no era que faltaran bloques sino que **el mismo bloque estaba escrito tres veces**.

- **🔴 «Sucursales en riesgo» estaba duplicado literal** entre admin y psicóloga: la misma lista,
  el mismo modal, las mismas clases, con la única diferencia del nombre de la variable de estado.
  Y el cálculo de semanas, scores y semáforo —unas 60 líneas— también estaba copiado, **y ya
  había empezado a divergir**: el de psicóloga cortaba a 6 semanas y el de admin a 8 sucursales,
  cada uno por su cuenta. Con RH sumándose habrían sido tres copias.
- **🆕 Un solo cálculo (`usePulseSemana`) y tres bloques compartidos** — `SucursalesEnRiesgo`,
  `FocoRojo` y `ScorePorSucursal`. El dashboard de admin pasa de **554 líneas a 95**: lo que
  queda es la composición, que es lo único que de verdad cambia entre roles.
- **🆕 Psicóloga** estrena la cabecera del admin (rejilla de KPIs y el Pulse Score grande, en vez
  de las cuatro tarjetas sueltas) y **Score por Sucursal**. Mantiene «Casos prioritarios», que es
  suyo. **No** lleva «Foco Rojo»: sería la misma gente dos veces en la misma pantalla.
- **🆕 RH** estrena **Foco Rojo** y **Score por Sucursal**. Decisión del dueño: ve los nombres
  igual que admin. Es coherente con la migración 099, que le dio a RH las mismas capacidades, y
  con que ya descarga el reporte de bienestar con nombres y scores — verlo en la portada no le da
  acceso nuevo, se lo pone delante.

**Un detalle de rendimiento que salió del linter:** `selRawWeeks` se calculaba suelto, así que
era un array nuevo en cada render y el `useMemo` que recorre los ~100 empleados con todas sus
encuestas se recalculaba **siempre**. Ahora tiene su propio `useMemo`.

### 2026-08-03 (noche) · El dashboard de RH era una maqueta, y la gráfica de bienestar enseñaba un tercio de la empresa

> Petición: que los dashboards de RH y psicóloga se parezcan al de admin, y que la gráfica de
> tendencia se pueda ver por semana porque con 26 clínicas se volvió ilegible. Al abrirlos
> aparecieron dos cosas que nadie había pedido arreglar porque nadie sabía que estaban rotas.

- **🔴 El dashboard de RH no enseñaba datos: los inventaba.** Los cuatro indicadores estaban
  escritos a mano en el código —«3 vacaciones pendientes», «4 retardos», «2 descuentos»— y la
  lista de pendientes hablaba de un tal **«Luis Torres», que no existe en la base**. Eran los
  restos de la maqueta original, sirviéndose como si fueran ciertos. Reconstruido entero con
  datos reales: vacaciones y permisos que de verdad esperan aprobación (con el nombre de quien
  los pidió y sus fechas), descuentos del periodo, y retardos y faltas calculados con el **mismo
  `construirDias`** que pinta el calendario y los reportes — dos criterios distintos serían dos
  pantallas diciendo cosas distintas de la misma persona.
- **🔴 La gráfica de bienestar llevaba tiempo ocultando dos tercios de las clínicas.** Ponía seis
  semanas a la vez con una barra por sucursal dentro de cada semana: con 26 clínicas son 156
  barras, así que el código las recortaba a las 8 primeras (`.slice(0, 8)`) **sin decirlo en
  ninguna parte**. Ahora se elige la semana con un selector y se ven **todas** las que
  contestaron.
- **🆕 El color pasa a ser el semáforo, no un color por clínica.** Con 26 series, 26 colores
  dejan de distinguirse entre sí y obligan a bajar a la leyenda para responder la única pregunta
  que importa: cuáles están mal. Verde/amarillo/rojo lo contesta de un vistazo, y es el mismo
  código que la app ya usa en todas las demás pantallas. Las barras van ordenadas de mayor a
  menor, así que el problema está siempre en el mismo sitio: a la derecha.
- **🆕 Línea punteada con la semana anterior.** Es lo que convierte una foto en una tendencia:
  sin ella, un 72 no se distingue de un 72 que viene de 85.
- **🆕 Un solo bloque de tendencia para los tres roles.** Antes el mismo código estaba duplicado
  en admin y psicóloga y ya se había ido separando; ahora es un componente con su propio
  selector, y RH lo estrena.

**Dos fallos que solo aparecieron al dibujarlo.** El componente se renderizó con los datos reales
de producción (20 sucursales de la semana W31) antes de desplegarlo, y salieron dos cosas que
ninguna prueba habría cazado:

1. **La línea punteada se desplomaba a cero** entre sucursales sin dato previo. La causa es un
   clásico de JavaScript: `Number(null)` es `0` y `Number.isFinite(0)` es `true`, así que la
   guarda `Number.isFinite(Number(v))` daba por bueno un hueco y lo dibujaba como un cero. La
   gráfica inventaba caídas al suelo que nunca ocurrieron.
2. **Una sucursal con dato previo aislado no dibujaba nada** — un punto suelto en una polilínea
   es invisible. Ahora se pinta como punto para que ese «veníamos de 83» no desaparezca.

**La gráfica pasa a usar `recharts`.** La primera versión se dibujó a mano en SVG y se parecía al
diseño de referencia, pero no era igual: ni la alineación de los ejes, ni el tooltip que sigue al
ratón (un `<title>` de SVG lo pinta el sistema operativo, tarda un segundo y no se puede
maquetar). El diseño de referencia es recharts, así que se instala. Pesa **368 KB**, pero:

- va en **su propio chunk, cargado en diferido** (`lazy` + `Suspense`), así que solo lo descarga
  quien abre un dashboard con gráfica. El layout de empleado sigue en 2,6 KB;
- y en esta app el bundle ya carga **15 MB de OpenCV** para el reconocimiento facial: al lado de
  eso es marginal.

Las partes de Untitled UI del ejemplo (`charts-base`, `ChartTooltipContent`, las clases
`text-utility-brand-*`) **no existen en este proyecto** — solo está su paquete de iconos, no su
librería de componentes. Se sustituyen por un tooltip propio con los tokens de la app.

> Las animaciones van **apagadas**, igual que en el diseño de referencia, y no es un descuido
> suyo: recharts **reanima en cada re-render**, así que al cambiar de semana las 26 barras
> volverían a crecer desde cero delante de quien esté leyéndolas. Es además la única versión que
> se pudo verificar renderizada. Se encienden cambiando `isAnimationActive` en `WeeklyScoreChart`.

**Las barras van de PEOR a MEJOR, y el orden importa más de lo que parece.** La primera versión
iba de mayor a menor, y al probarla con las 26 clínicas apareció el fallo: en una pantalla de
1280px caben 23, así que **las tres últimas se salían por la derecha — y eran justo las tres
peores** (Tuxpan 67, Popular Tampico 63, Popular Irapuato 59). La gráfica escondía su propia
conclusión detrás de un scroll horizontal que mucha gente no ve. Con las peores primero, lo
accionable está siempre a la vista y lo que se va por la derecha son las clínicas que van bien.
Verificado con las 26 en escritorio (caben todas) y en un móvil de 390px (entran unas seis, con
la barra de desplazamiento visible, y la roja es la primera).

### 2026-08-03 (tarde) · No todas las clínicas están en la misma hora, y el sistema creía que sí

> Empezó como «a algunos les marca descanso aunque sí registraron entrada». La causa era simple
> —ocho personas sin horario cargado— pero tirando del hilo apareció algo que llevaba semanas
> corrompiendo registros en silencio: **el sistema entero daba por hecho que las 26 clínicas
> viven en `America/Monterrey`**, y dos no.

- **🔴 Ocho personas sin ningún horario, y por eso «de descanso» todos los días.** Un día sin
  fila en `horarios` es DESCANSO por diseño (mig. 035) — así un domingo no puede salir como
  falta. Pero eso hace **indistinguible** «hoy libras» de «nadie te cargó el turno», y las ocho
  altas del 30–31 de julio (posteriores a la carga masiva) cayeron ahí. El efecto es peor que la
  etiqueta: sin horario **no se puede llegar tarde ni se puede faltar**, así que estaban fuera de
  todo control de asistencia. Dieciocho días-persona afectados. Cargados sus turnos, esos días se
  reclasificaron solos: el estado se deriva, no se guarda.
- **🆕 Turno automático al dar de alta (migración 107).** Un trigger crea el turno estándar —
  lunes a viernes 10:00-19:00, sábado 10:00-14:00, tolerancia 10 min— con la persona. Se puso en
  la **base** y no en la pantalla de alta a propósito: cubre los tres caminos por los que puede
  nacer un usuario (la pantalla de RH, la edge function y cualquier alta manual), y el hueco se
  abrió justamente porque uno de ellos no pasaba por horarios. De paso, índice único por
  `(empleado, día)`: ahora que hay un escritor automático, dos turnos el mismo día no pueden
  colarse en silencio.
- **🔴 Hermosillo acumulaba retardos falsos todos los días.** Sonora es UTC-7 y no aplica horario
  de verano, así que sus checadas se leían **una hora tarde**. Con turno de 10:00 y 10 minutos de
  tolerancia, esto marcaba RETARDO a gente que llegaba antes de su hora:

  | Persona | Llegó (hora de Hermosillo) | Retardo que apuntaba el sistema |
  |---|---|---|
  | Dania Limón | 09:54 | 55 min |
  | Dania Limón | 09:48 | 49 min |
  | Roberto Esparza | 09:43 | 44 min |
  | Roberto Esparza | 09:32 | 33 min |

  Cuatro personas, todos los días, alimentando la tabla que sustenta descuentos.
- **🔴 Y Reynosa, al revés: sus retardos reales eran invisibles.** Es municipio fronterizo y por
  el decreto de 2022 conserva el horario de verano de EE.UU.: hoy va en UTC-5. Se le leía **una
  hora temprano**, así que cualquiera podía llegar hasta una hora tarde sin que apareciera nada.
  Siete personas. Corregido, y sin dramas: con la tolerancia de 10 minutos casi todos siguen
  puntuales — sale **un** retardo real de 26 minutos.
- **🆕 `sucursales.zona_horaria`, y el nombre IANA en vez de un desfase.** Un `-06:00` guardado a
  mano se rompería solo en noviembre, cuando Reynosa cambie de horario. Con el nombre
  (`America/Matamoros`) el cambio lo resuelve el sistema operativo, y hay una prueba que lo
  fija: la misma llegada da 30 minutos de retardo en agosto y en diciembre. Se valida al
  escribir, porque una zona mal escrita rompería **todas** las checadas de esa clínica y se
  descubriría a las ocho de la mañana con la gente en la puerta.
- **🆕 La zona horaria llega hasta el final.** `registrar_checada` la resuelve de la sucursal
  antes de decidir en qué día natural cae la checada; el checador, el calendario de Asistencia y
  los Excel de Reportes leen cada checada en la hora de SU clínica; y el cron dejó de construir
  las salidas automáticas con `-06:00` fijo — a Hermosillo le cerraba la jornada a las 18:00
  locales, una hora antes, quitándole una hora trabajada a quien ya se había olvidado de marcar.
- **🆕 El recordatorio de salida pasa a llamarse cada hora.** Con horas fijas de cron habría
  avisado solo a las clínicas del centro: las 19:10 de Monterrey son las 18:10 en Hermosillo. Al
  resolver la hora por persona, una sola entrada horaria cubre los tres husos, sigue funcionando
  cuando Reynosa cambie de horario y no hay que recalcular nada al abrir una clínica nueva.

- **🔴 El cierre automático podía dejar la salida ANTES de la entrada.** Lo destapó revisar los
  días de esas ocho personas: quien fichaba **después** de su hora de turno —pasó de verdad el 31
  de julio, el día del estreno, cuando la plantilla probó el checador por la tarde— recibía una
  salida automática a la hora de su turno, o sea anterior a su propia entrada. Medido: jornadas
  de **−42, −40 y −11 minutos**. No envenenaba las sumas (`minutosTrabajados` devuelve null ante
  un negativo) pero dejaba el día con una pareja entrada/salida imposible de interpretar. Ahora,
  si la hora del turno cae antes de la entrada, se cierra a la entrada más la jornada mínima, y
  la nota lo dice. Las tres jornadas imposibles ya existentes quedaron anuladas.
- **🆕 Corregidos los días de los ocho.** El 31 de julio de Karla, Merie y Rubén vuelve a ser
  «periodo de prueba» — sus checadas de las 19:11–19:41 no eran una jornada, era probar la app
  después de la hora. Y la falta de Conrado del sábado queda justificada: no tiene rostro
  registrado y `exigir_rostro` está activo, así que **el checador no le deja fichar**; marcarle
  falta era culparle de no usar algo que el sistema le impide usar. **No se tocaron los retardos
  reales** (Alicia 39 min, Sofía 18 min): borrarlos sería falsear el registro en el otro sentido.

**Lo que se descartó por el camino:** León y Popular Poza Rica también salían con medianas de
entrada raras (13:57, 14:36), pero no es huso ni turno equivocado — son las checadas de prueba
del 31 de julio por la tarde, que con solo tres días de datos arrastran la mediana. Sus entradas
reales van de 09:42 a 10:08. **Solo Hermosillo y Reynosa tenían problema de zona horaria.**

> ⚠️ **Pendiente, y no es de estas ocho personas: el turno del sábado no refleja lo que se
> trabaja.** Las 110 personas tienen cargado sábado 10:00-14:00, pero el sábado 1 de agosto
> salieron **52 personas con mediana a las 17:59**, y solo 8 antes de las 14:30. Mientras el
> turno diga 14:00: el cierre automático corta la jornada del sábado cuatro horas antes, el
> recordatorio de salida suena a las 14:10, y cualquiera que se quede hasta las 18:00 dispara el
> aviso de «salida anticipada» al revés. Decidir si el sábado es media jornada o completa es de
> dirección, no del código.

### 2026-08-03 · El checador: el anti-spoofing llevaba toda su vida sin medir nada, y la cámara se quedaba en negro hablando sola

> Repaso del módulo con los datos de producción delante (426 checadas en 7 días, 84 personas).
> Lo que salió no fue un fallo sino una cadena: una excepción silenciosa dejaba sin datos al
> anti-spoofing, sin datos no se puede calibrar, sin calibrar hay que pedir el giro de cabeza en
> **todas** las checadas, y ese giro es hoy la primera causa de que a alguien no le dejen fichar.
> Buena parte de la fricción diaria del checador colgaba de un `.extract()` mal encadenado.

- **🔴 El anti-spoofing no ha medido nunca nada** (`api/_rostro.js`). `sharp` aplica
  `.extract()` **antes** que `.extend()` cuando van encadenados, así que el recorte se calculaba
  contra la imagen **sin acolchar** y se salía siempre por la derecha: `extract_area: bad extract
  area` en **el 100% de las checadas** — 301 excepciones en 7 días y `liveness_score` en NULL en
  todas las filas. No se vio nunca porque quien llama se traga el error a propósito (que se caiga
  el modelo no puede impedir una checada), y esa decisión, que es correcta, es justo la que lo
  mantuvo invisible. Arreglado separando el acolchado del recorte en dos tuberías. La geometría
  pasa a estar cubierta por 8 pruebas —cara pegada al borde, cara mayor que la foto, horizontal—
  que **fallan 6 de 8 con el código anterior**: era código sin una sola prueba.
- **⚠️ Y por eso mismo, el piso de anti-spoofing NO se enciende todavía.** Arreglar la medición
  despertaba de golpe un bloqueo (`viveza < 0.10`) que jamás se había ejecutado contra una cara
  real, en estas clínicas y con esta luz. Habría sido repetir la lección del 0.363 el mismo día
  que se arregla el bug. Se mide, se guarda y **no se bloquea**: `ANTISPOOF_BLOQUEA` en
  `api/checar.js` se pone en true cuando Calibración enseñe las dos nubes con datos de verdad, y
  entonces el umbral saldrá de esos datos.
- **🔴 Tres fallos por mala luz mandaban a RH un aviso de "Posible suplantación" con nombre y
  apellidos** (migración 106). Los tres motivos de fallo caían en la misma tabla sin
  distinguirse. Medido: de 66 fallos en 7 días, **26 eran "no se distingue tu cara"** —luz,
  contraluz, encuadre— y solo **7** una cara que de verdad no coincidía. O sea que la mayoría de
  esas alertas acusaban a alguien de suplantar su propia cuenta por pelearse con la luz de las
  ocho de la mañana. Ahora se guarda el motivo y solo avisan los dos que son de identidad
  (`no_coincide` y `reto_no_coincide`, este último el ataque de enseñar la foto de otro y girar
  la cabeza propia). Un aviso que casi siempre es falso deja de leerse, y se lleva por delante
  el que sí importa.
- **🆕 La cámara avisa de la luz antes de que el servidor rechace la foto.** El navegador detecta
  con BlazeFace y el servidor con YuNet: no son igual de permisivos, y lo que los separa suele
  ser la iluminación. Ahora, con la cara ya bien encuadrada, se mide la luminancia de la cara
  contra la del fondo y se dice lo que se puede arreglar: *"tienes una luz fuerte detrás"*,
  *"hay poca luz para verte bien"*. **Avisa y no bloquea** —hay una prueba dedicada a que nunca
  devuelva un veto—: dejar sin fichar a quien trabaja en un recibidor a oscuras sería peor que
  el problema que se intenta resolver.
- **🔴 Al terminar de checar, la pantalla se quedaba en negro y la voz seguía hablando.**
  `CapturaSelfie` nunca reiniciaba su estado al cerrarse la cámara: se quedaba en `"lista"` para
  siempre, así que el `<video>` seguía visible con un stream ya detenido —el rectángulo negro— y
  el bucle de guía, que solo se apaga cuando el estado deja de ser `"lista"`, seguía corriendo
  sobre esa imagen congelada, no encontraba ninguna cara y repetía *"colócate frente a la
  cámara"* **encima de la confirmación de la checada**. Los dos síntomas, una sola causa. De
  paso se veía un tercero: al entrar a la pantalla, sin haber pulsado nada, la caja decía
  *"Abriendo la cámara…"* de forma permanente sin que hubiera ninguna cámara abriéndose. Ahora
  la cámara se monta **solo mientras se está checando**.
- **🆕 Confirmación en medio de la pantalla, con la hora escrita.** Antes solo había un toast, y
  con el recuadro negro detrás la gente no sabía si había fichado — y volvía a intentarlo, que
  es la peor respuesta posible: la segunda checada del día es la **salida**. El aviso dice
  "Entrada registrada · Hoy a las 09:35", más el retardo o el "fuera de tu clínica" si los hubo.
  Se cierra solo a los 8 segundos y también con el botón: al revés que el aviso de versión
  nueva, este no tiene por qué exigir un toque a las ocho de la mañana con el teléfono en una
  mano. La voz se **calla** antes de confirmar, así que la frase por fin se oye entera en vez de
  entrar en la cola detrás de las pistas de encuadre.
- **🆕 Recordatorio de salida sin marcar.** Una de cada seis checadas la cerraba el sistema al
  día siguiente: **70 de 426 en 7 días, repartidas entre 56 personas distintas**. Y una salida
  puesta por el cron es una hora estimada, no la real — quien se fue a las 19:40 quedaba
  registrado a las 19:00. Ahora, a los 10 minutos de su hora de turno, quien tenga entrada sin
  salida recibe un aviso. La ventana (+10 a +70 min) permite que el mismo endpoint sirva a los
  dos horarios de la clínica —19:00 entre semana, 14:00 el sábado— con dos entradas de cron y
  cero lógica de calendario. La ruta del aviso se arma con el **rol** de cada quien y no fija a
  `/empleado/checador`: el checador vive bajo cuatro prefijos y una URL fija habría repetido el
  fallo que dejaba a los doctores rebotando, arreglado dos días antes.

- **🔴 Una salida anulada dejaba la jornada abierta para siempre.** Lo cazó la primera checada
  de prueba del día: al anularla, la persona seguía contando como "ya cerró su día". Ni el
  cierre automático la volvía a mirar —así que el día se quedaba en «incompleto» sin que nadie
  lo tocara nunca más— ni el recordatorio nuevo la avisaba. Las dos consultas filtraban
  `anulada` en las **entradas** pero no en las **salidas**, y anular es justo lo que hace RH
  cuando una checada está mal: no es el caso raro, es el caso. Ahora las dos aplican la misma
  regla que `emparejarChecadas` lleva siempre en el cliente — para el cálculo, una checada
  anulada no existe.

**Lo que NO se tocó, y por qué:** `PROBABILIDAD_RETO` sigue en 1.0 — se pide el giro de cabeza
en todas las checadas. Es la causa directa de la mitad de los fallos (33 de 66 tenían la cara
correcta, con score sobre el umbral), así que la tentación de bajarlo era grande. Pero mientras
el anti-spoofing no esté calibrado, ese giro es la única barrera contra enseñarle una foto
impresa a la cámara — confirmado en vivo en su día. Primero los datos, después el umbral, y solo
entonces bajar el reto.

### 2026-08-01 · Reportes deja de ser cuatro botones fijos, y una encuesta que llevaba cinco días sin poder enviarse

> El día empezó con un fallo callado: **desde el 27 de julio no había entrado una sola
> encuesta** y nadie lo sabía, porque la pantalla decía «No se pudo guardar la encuesta» en
> vez del motivo real que Postgres sí estaba dando. El resto del día se fue en Reportes, que
> respondía a la pregunta equivocada: sabía de encuestas y de nada más, y el mismo dato salía
> por tres sitios distintos según desde dónde se pidiera. La lección que se repitió tres veces
> hoy es la misma de la auditoría del 30: **un error que no se enseña convierte un problema de
> dos minutos en una tarde de adivinar.**

- **🔴 Nadie podía enviar la encuesta (migración 105).** El trigger
  `encuestas_calcular_score()` exigía respuesta numérica de **todas** las preguntas de escala
  activas —núcleo y bloques—, pero el empleado solo ve el núcleo más el bloque de la quincena,
  y con los cuatro bloques apagados no ve ninguno: mandaba 6 respuestas y el trigger pedía 14.
  Ahora cuenta solo el núcleo (`bloque_id is null`), que es exactamente lo que ya hacía el
  cliente en `repartirPreguntas()`: las de bloque se responden y se reportan, pero **no
  puntúan**, porque si puntuaran el score dejaría de ser comparable entre quincenas — y de esa
  comparación viven el historial, la tendencia y el foco rojo por sucursal. La validación no se
  afloja: del núcleo se sigue exigiendo número en rango 1-10.
- **🔴 Y el motivo real nunca llegó a la pantalla.** `addEncuesta` tiraba el mensaje de
  Postgres y lo cambiaba por un texto fijo. Por eso se leía «No se pudo guardar la encuesta»
  en lugar de «Falta la respuesta de una pregunta de escala», y por eso el fallo del trigger
  pasó cinco días invisible.
- **🔴 El checador mandaba al doctor a otro sitio.** Las dos navegaciones iban fijas a
  `/empleado`: un doctor pulsaba «Registrar mi rostro», `App.jsx` veía que la ruta no empieza
  por `/doctor` y lo rebotaba a su portada. Son **12 doctores sin rostro aprobado**, es decir
  12 personas que dependían de que RH les fichara a mano. Ahora la ruta se arma con el rol de
  quien mira.
- **🔴 Los cinco «Excel» eran CSV con cada celda escrita como texto.** El score, el promedio
  del mes, las horas trabajadas y la puntualidad no se podían sumar, promediar ni graficar sin
  rehacer el archivo columna por columna. Ahora son `.xlsx` de verdad con `exceljs`, que ya
  estaba instalado y ya se cargaba por import dinámico: ni una dependencia nueva ni un byte al
  arranque. Lo que más importa no es el formato sino las columnas numéricas: **donde no hay
  dato la celda queda vacía** en vez de llevar el texto «Sin datos», porque un `PROMEDIO()`
  sobre una columna con texto dentro devuelve error aunque las demás celdas estén bien.
- **🔴 El detalle de asistencia decía horas que nadie trabajó.** Las checadas se guardan en
  UTC y Monterrey va seis horas por detrás, pero el reporte volcaba el timestamp crudo: decía
  que una empleada entró a las 15:35 y salió al día **siguiente** a la 1:01, cuando entró a las
  9:35 y salió a las 19:01 del mismo día. No es un problema de formato — quien lee ese reporte
  saca conclusiones falsas sobre los horarios de su gente. La conversión vive ahora en
  `horaEnClinica()` dentro de `utils/asistencia`, junto al resto de la lógica y no en la
  pantalla, porque el calendario y el reporte tienen que decir la misma hora.
- **🔴 El cierre automático de respaldo cerraba a las 18:00, una hora antes de tiempo.** Ese
  cierre usa la hora de salida del horario de cada quien —19:00 entre semana, 14:00 el
  sábado— y solo cae en la hora por defecto los días sin horario cargado. Esa hora por defecto
  no era la de nadie: **le recortaba una hora trabajada justo a quien ya se había olvidado de
  marcar salida.** Pasó 3 veces, todas el 31 de julio.
- **🔴 Un fallo al descargar se veía igual que «no pasó nada».** Ninguna de las siete
  descargas atrapaba errores: la promesa quedaba rechazada sin que nadie la escuchara y la
  pantalla se quedaba exactamente igual. Ahora todas pasan por `conAviso()`, que enseña el
  motivo real con el mismo `mensajeDeFallo` que ya usa el resto de la app.
- **🔴 Los tickets llegaban a MCTIC sin el nombre de quien pide ayuda.** `SoporteTI` arma el
  solicitante con `user?.name`, pero los cuatro layouts lo montaban sin pasarle la prop: el
  ticket salía con el correo pelado. La identidad seguía siendo confiable —el correo lo pone
  el servidor desde el JWT ya verificado— así que esto era legibilidad, no seguridad.
- **🆕 Reportes: elegir QUÉ reporte, no solo de cuándo.** Antes el reporte de asistencia estaba
  escondido dentro del calendario, con su propio botón y su propio rango mes a mes, y
  vacaciones, permisos y descuentos solo se miraban en pantalla. Tres sitios para la misma
  pregunta hecha en dos partes. Ahora hay un selector de tipo —**asistencia** (resumen por
  persona y detalle por día), **bienestar** y **vacaciones/permisos/descuentos**— encima del de
  periodo. El criterio de qué es falta, retardo o periodo de prueba **no se reimplementa**: el
  reporte llama al mismo `construirDias` que pinta el calendario, porque dos copias del
  criterio serían dos reportes que un día dicen cosas distintas sobre la misma persona. Las
  ausencias se filtran por **solapamiento** y no por el día en que empiezan: unas vacaciones
  que arrancan el viernes y acaban el martes salen en las dos semanas que cruzan.
- **🆕 Semana, quincena o mes — y cualquier periodo anterior.** Había un «Reporte Semanal» y
  un «Reporte Mensual» clavados al periodo en curso, aunque la pantalla ya tenía el historial
  entero cargado. Ahora son dos formas de mirar —detalle y consolidado— y el periodo se elige
  aparte. Las tres duraciones **no** se agrupan igual, y está escrito en `utils/periodos.js`:
  la semana por la columna `semana` (ISO); la **quincena de sábado a viernes**, porque así se
  trabaja y así se paga aquí, y es la única que agrupa por fecha de respuesta —una semana de
  encuesta puede repartirse entre dos quincenas, y es el precio de que cuadre con la nómina—;
  y el mes por las semanas cuyo **lunes** cae dentro, porque filtrar por fecha de envío partía
  las semanas a caballo y ningún mes tenía la semana entera. Verificado con las 67 encuestas
  de producción: en los tres modos la suma por periodos da exactamente 67.
- **🆕 El periodo de prueba de la app deja de parecer faltas.** Hasta el 31 de julio la app se
  estuvo probando: había horario cargado para toda la plantilla y solo una parte checaba —14
  personas el 30 de julio, 56 el 31—, así que casi todos los días anteriores salían **falta**.
  Nadie faltó. Se añade el estado `PRUEBA`, con su color en el calendario, su entrada en la
  leyenda y su columna en el Excel; no cuenta como falta, no entra en el cálculo de puntualidad
  y no aparece en «justificar faltas en bloque». **No se rellena la tabla con asistencias
  inventadas**, que era la otra forma de arreglarlo: un registro fabricado no se distingue de
  uno real, y `asistencias` es la tabla que sustenta descuentos, retardos y bajas — dentro de
  tres meses nadie podría decir si alguien de verdad llegó puntual el 24 de julio, y en un
  pleito laboral esos registros hablan. Reversible cambiando una fecha: `FIN_PERIODO_PRUEBA`.
- **🆕 «Ideas de mejora» deja de ser un placeholder.** Llevaba desde que reemplazó al viejo
  Soporte TI diciendo «módulo en desarrollo». Ahora la idea entra al tablero de **Pendientes**
  que TI ya mira a diario, con la etiqueta `idea-pulse`, y quien la propuso ve aquí mismo en
  qué va —Recibida / En marcha / Aplicada, que son las tres columnas del Kanban dichas en el
  idioma de quien propone—. Sin prioridad crítica, al revés que un ticket: una idea de mejora
  nunca es una urgencia; si algo urge, es un ticket.
- **🆕 El detalle de asistencia pasa a ser cuadrícula, no lista.** Era una fila por persona **y
  por día**, con el nombre y la sucursal repetidos en cada renglón: 700 renglones para
  responder de un vistazo si alguien faltó el martes. Ahora es una fila por persona, un día por
  columna, y las cuentas del periodo al final — de 700 renglones a 100.
- **🔴 Tema oscuro: los iconos de marca casi no se veían.** El cuadro de Reportes se pintaba
  con un gradiente que terminaba en `--mc-verde-claro`, color **crudo** de la paleta pensado
  para fondo claro; en oscuro dejaba un parche casi blanco. Al quitarlo quedó a la vista el
  segundo fallo que ese blanco tapaba: el icono usaba `--mc-marca-texto`, que en oscuro
  resolvía a un azul oscuro sobre caja oscura — **contraste 1.46:1, se adivinaba**. Corregido
  con los tokens que sí cambian con el tema (`--mc-brand-suave` y `--mc-icono-accion`): de
  1.46:1 a **4.23:1** en oscuro, y 4.94:1 sin tocar en claro. Mismo arreglo en el hover de la
  pantalla de acceso, cuyo borde era además un teal fijo escrito a mano que dejó de coincidir
  con nada el día que el color de la app se volvió configurable.
- **🆕 Iconos que dicen lo que hacen.** `spreadsheet` apuntaba a una rejilla de cuatro
  cuadros — el icono estándar de «menú de aplicaciones», que no dice hoja de cálculo ni dice
  descargar. Ahora es una tabla, y las acciones de descarga usan un documento con flecha.
- **🆕 `index.html` se sirve con `Cache-Control: no-cache`.** Es el único archivo que dice qué
  rutas tienen los assets: sin eso el navegador podía quedarse con un index viejo pidiendo el
  bundle anterior — se desplegaba, el servidor tenía el cambio, y al usuario no le llegaba.

**Queda pendiente la causa de fondo del tema oscuro:** `accentPalette.js` escribe
`--mc-verde-claro` y `--mc-marca-texto` como estilo **en línea** sobre `<html>` (vía
`AccentContext`, para que el color de marca sea configurable), y un estilo en línea gana a
cualquier hoja de estilos. Las versiones oscuras de esas dos variables que `[data-theme=dark]`
sí define **nunca se aplican**, y ningún componente puede corregirlo desde su propio CSS.
Mientras eso siga así, cualquier superficie que use una de las dos se verá mal en oscuro.


### 2026-07-31 · Cada clínica fija su propia ubicación, y un cambio de contraseña que dejaba a la gente fuera

> **25 de las 26 sucursales no tenían geocerca**, y configurarlas obligaba a viajar clínica por
> clínica porque «Usar mi ubicación actual» solo existía en la pantalla de admin. Se resolvió
> dejando que la recepcionista de cada clínica la capture ella misma, estando dentro — lo que
> abre un riesgo nuevo que mandó sobre todo el diseño: **estar «fuera» BLOQUEA la checada**, así
> que una geocerca mal puesta deja a una clínica entera sin poder fichar.

- **🆕 Recepción fija la ubicación de su clínica desde su teléfono (migración 103).** Permiso
  `puede_ubicar_sucursal` como booleano y **no** el texto de `puesto`, que tenía tres grafías
  distintas (se normalizaron de paso); otorgado a las 26 activas. La RPC
  `fijar_geocerca_mi_sucursal` es `security definer` y **no recibe id de sucursal**: la resuelve
  del propio usuario, así que no hay forma de nombrar una ajena. Rechaza precisión peor que
  100 m y no toca el radio. Los triggers `sellar_geocerca` y `log_geocerca` rellenan solos quién
  y cuándo —venga el cambio de admin o de recepción— y dejan cada cambio en historial. Admin ve
  quién la fijó, con qué precisión, y gana un botón para **quitarla al instante**. Verificado
  con 6 pruebas en base simulando sesiones reales (propia/ajena, GPS malo, empleado sin
  permiso, escalada de privilegios) y una prueba end-to-end por HTTPS con sucursal desechable.
- **🆕 Vigilancia de geocercas (migración 104).** El punto ciego: lo intuitivo sería contar
  checadas con `ubicacion_estado = 'fuera'`, y **no sirve** — `checar.js` responde 403 y no
  inserta fila, así que una checada bloqueada no deja rastro en ninguna tabla. El síntoma no es
  «muchas fuera», es **silencio**: una clínica que fichaba y de pronto deja de aparecer.
  `revisar_geocercas()` detecta tres casos — *muda* (fichaban 2+ personas, se fijó geocerca,
  cero checadas desde entonces), *lejos* (la mediana de sus checadas cae fuera del radio) y
  *propuesta* (sin geocerca, pero ya hay datos para calcularla) — y se engancha al cron diario
  que ya existía, con freno anti-repetición de 48 h. **Mediana y no promedio:** una sola checada
  desde otra ciudad arrastraría el centro. Solo notifica *muda* y *lejos*; avisar las propuestas
  a diario las volvería ruido.
- **🆕 Aviso fijo en portada mientras la clínica siga sin ubicación.** La campanita no bastó: de
  las 9 recepcionistas pendientes, **7 ni la abrieron**, y solo 4 de las 9 tienen push. El aviso
  **no se puede cerrar** — no va de una preferencia de quien lo ve, va de que las checadas de
  toda su clínica se guardan sin ubicación — y desaparece solo cuando el dato está puesto. Si
  la sucursal de la persona no aparece en la tabla no se enseña nada, para no dejar un aviso
  perpetuo que quien lo ve no puede quitar.
- **🆕 Que una doctora también pueda fijarla.** Ébano se quedó sin recepcionista. El servidor ya
  lo permitía —la 103 mira el permiso, no el rol—; faltaba todo del lado del navegador: el menú
  de doctor, la ruta en `DoctorLayout` y el banner. El permiso se sigue dando persona a persona.
- **🆕 Aviso a quien no tiene la ubicación activada, y panel de permisos en Mi perfil.** Sin
  permiso de ubicación el botón de fichar no se activa, y hasta hoy la persona solo veía un
  botón muerto y se enteraba a las ocho de la mañana. El panel (cámara, ubicación, micrófono,
  avisos) existe porque el aviso de push ya prometía «puedes activarlos luego desde tu perfil» y
  ese sitio no existía. El estado se lee del navegador en cada visita y **no** se guarda en la
  fila del usuario: el permiso es del dispositivo, no de la cuenta. Si el navegador está en
  `denied` no hay API para volver a preguntar, así que en vez de un botón que no hace nada se
  enseña la ruta de los ajustes, distinta por navegador.
- **🆕 La foto de perfil se ve en grande al picarla.** Solo se veía del tamaño de una moneda en
  todas las pantallas. El cambio va dentro de `Avatar`, así que lo heredan los 22 sitios que lo
  usan; se apaga donde el avatar ya vive dentro de un botón, porque un botón dentro de otro es
  HTML inválido y le robaría el clic al control.
- **🆕 El expediente pasa a lista + detalle.** Las pestañas obligaban a un clic por sección y
  dejaban la tarjeta con mucho aire. Ahora la lista de empleados a la izquierda y el expediente
  entero de un scroll a la derecha; una sección vacía se encoge a un renglón.
- **🔴 El cambio de contraseña funcionaba, pero la app decía que no — y dejaba a la gente
  fuera.** `auth.updateUser` emite `USER_UPDATED`, eso disparaba `cargarPerfil`, y ese SELECT
  sale **antes** de que `mark_password_changed` apague el flag y a veces llega **después**: el
  panel reaparecía con la contraseña ya cambiada. La persona creía que había fallado, la
  reescribía igual, Auth contestaba 422 `same_password`, y entonces volvía a entrar con `emp123`
  — que ya no existía — y se quedaba fuera. Verificado contra producción: tras el 422, el login
  con la nueva daba 200 y con `emp123` daba 400, o sea que **el cambio había surtido efecto
  todas las veces**. Ahora se ignora `USER_UPDATED`, el 422 `same_password` deja de tratarse
  como error (significa que ya está puesta) y si falla solo el RPC ya no se miente diciendo que
  falló el cambio.
- **🔴 La psicóloga veía la pantalla de rostros vacía (migración 102).** La migración 052 le dio
  SELECT sobre `public.rostros` pero no sobre `rostro_fotos` ni sobre el bucket `rostros`: le
  llegaban las 38 filas y **cero fotos**, así que no podía comprobar si la cara era de quien
  decía ser.

**Detalle que solo salió probándolo:** en `revisar_geocercas`, `revoke ... from public` **no
basta**. Supabase concede `EXECUTE` a `authenticated` y `anon` por default privileges, y hay que
revocárselo por nombre. Comprobado que ambos reciben «permission denied» y que `service_role`
puede. La integración se probó dentro del contenedor sin disparar el resto del cron: era
viernes, y habría re-notificado la encuesta a toda la plantilla.


### 2026-07-30 (tarde) · Auditoría del sistema y cierre de los hallazgos

> Auditoría de los tres frentes —frontend, backend y seguridad— sobre 34.137 líneas, 18
> endpoints, 4 edge functions y 35 tablas. El resultado de fondo es bueno: RLS activa en
> las 35 tablas sin una sola policy permisiva, los 18 endpoints autentican, los tres que
> manejan objetos ajenos verifican propiedad, ninguna función `SECURITY DEFINER` sin
> `search_path` fijo, y cero secretos de servidor en el bundle (se decodificaron los JWT:
> solo el `anon`, que es el correcto). Lo que sigue es lo que sí había que arreglar.

- **🔴 Se podía subir contenido ejecutable a un bucket público (migración 101).** Los 7
  buckets tenían `allowed_mime_types = null`: cero validación de tipo en el servidor.
  `avatars` y `banners` son además públicos y se sirven desde el MISMO ORIGEN que la app.
  La pantalla sí validaba —`avatarService` re-codifica por canvas a JPEG— pero eso es
  validación de cliente, y la app le entrega al navegador la anon key y el JWT: bastaba
  llamar a la API de storage directamente con `contentType: 'text/html'`. La policy solo
  mira el nombre del archivo. Resultado: **XSS almacenado en el origen de la app**.
  `nosniff` no protegía —hace que el navegador CONFÍE en el tipo declarado— y la CSP
  estaba en Report-Only. Cerrado con listas por bucket. Verificado en producción: html y
  svg rechazados con 415, jpeg legítimo sigue pasando.
- **🔴 Los 16 sitios que quedaban tragándose el motivo del fallo.** El mismo patrón que
  tuvo la pantalla de IA caída diciendo "revisa la conexión" mientras el servidor
  contestaba un 413. Estaban encima de escrituras con RLS, que al bloquear no lanza un
  error de permisos sino que afecta cero filas — así que nadie podía distinguir red de
  permisos de validación. Se extrae `motivoFallo`/`mensajeDeFallo` a `utils/errores.js`
  (con tests) y se aplica en `useAppActions`, `AuthContext` y `Perfil`. **No** se aplica en
  `ForzarNotificaciones`: ahí el catch envuelve `Notification.requestPermission()` y un
  "NotAllowedError" en pantalla es peor que el texto genérico.
- **🔴 La psicóloga no podía restablecer contraseñas pese a la paridad de la 099.** La
  guarda del frontend seguía en `["admin","rh"]` y le respondía "no tienes permiso" sin
  llamar a nadie. Además, `functions.invoke` **envuelve** los 4xx: `error.message` decía
  "Edge Function returned a non-2xx status code" y el motivo real viajaba en
  `error.context`. Sin desenvolverlo, mostrar el mensaje era tan inútil como el texto fijo.
- **🆕 CSP de Report-Only a ACTIVA.** Antes de tocar nada se sirvió el bundle compilado
  con la política forzada y se recorrieron 19 pantallas (13 de admin + 6 de empleado,
  incluido el checador con cámara y wasm): **0 violaciones**. La primera versión de esa
  prueba daba 0 en falso —la app ni arrancaba— y solo se detectó por una comprobación de
  sanidad que exigía sesión iniciada y contenido en pantalla. Sin cubrir: entrar a una
  sala de Jitsi (`frame-src`) y el escáner de recibos.
- **🆕 Primer arnés de pruebas de la capa que no tenía ninguna
  (`supabase/tests/rls_invariantes.sql`).** Los 402 tests de vitest cubren `utils/` y ni
  uno tocaba policies. Ocho invariantes contra una base real, dentro de una transacción
  con rollback: que un empleado no lea la conversación de otro, que no se autoapruebe un
  permiso, que no se haga admin, que solo se vea a sí mismo, y que gestión sí vea a todos.
  8/8 en local y 8/8 en producción, sin tocar un dato.

**Detalle que solo salió probándolo:** Supabase compara la cadena COMPLETA del mime. La
grabadora de notas de voz manda `audio/webm;codecs=opus`, y una lista explícita lo
rechazaba con 415 — la migración habría roto las notas de voz en Chrome y Android. Por eso
el audio va con comodín `audio/*` y las imágenes NO: `image/*` dejaría pasar
`image/svg+xml`, que es justo el vector que se cierra.


### 2026-07-30 · La IA llevaba días muerta por un tope de caracteres, y la pantalla mentía sobre ello

> Reportado como "la IA no funciona". No era la llave de Gemini, ni el modelo, ni la cuota,
> ni el SDK: era un límite de longitud puesto a ojo que la plantilla real desbordaba. Lo
> difícil no fue el fallo, sino que las tres fuentes que uno consulta primero — la pantalla,
> el log del contenedor y el propio código — apuntaban a sitios equivocados.

- **🔴 Toda llamada a la IA moría con un 413.** `api/gemini.js` rechazaba cualquier prompt
  de más de 8000 caracteres. `buildContexto()` emite una línea por empleado (~180
  caracteres), así que con los **98 activos** el prompt ronda los **18.200**: lo pasaba por
  2,3 veces. Ese tope no era un límite del modelo — `gemini-2.5-flash` admite del orden de
  un millón de tokens — sino un número puesto a ojo por debajo del uso real. Subido a
  64.000, que deja margen para triplicar la plantilla. En desarrollo no se veía nunca: con
  3 empleados de prueba el contexto son ~600 caracteres.
- **🔴 El 413 no dejaba rastro en ningún log.** Es un `return` temprano y no pasa por
  `console.error`, así que `docker logs pulse-api-server` llevaba 7 días sin un solo error
  de Gemini mientras la pantalla no funcionaba. Apareció en el **access log de nginx**:
  cinco `POST /api/gemini` con código 413, todos con referer `/admin/ai`. El log del
  contenedor solo cuenta lo que el código decide contar; el del proxy cuenta todo.
- **🔴 La pantalla decía "revisa la conexión" pasara lo que pasara.** El proxy devuelve
  siempre el motivo exacto — llave sin configurar, cuota agotada, sesión inválida, prompt
  largo — y `callAI` lo propaga en `error.message`, pero `AIEngine` lo descartaba en los
  cinco sitios donde captura (los cuatro botones y el chat) y ponía un texto fijo sobre la
  conexión. Eso mandó a buscar el problema en la red, en la llave y en el SDK antes que en
  el propio mensaje. Ahora se muestra el motivo real; solo el fallo de red de verdad (fetch
  rechazado) cae al genérico.
- **🔴 La tabla de Empleados escondía la mitad en el teléfono.** A 390px necesitaba 672px:
  Nombre y Estado llenaban la pantalla, y Puesto, Antigüedad y el botón de dar de baja
  quedaban fuera — alcanzables solo arrastrando de lado, y sin ninguna pista de que
  existieran. A 360px se ocultaba el 50%. Pasa a tarjetas reusando el mecanismo que Gestión
  de Personal ya tenía resuelto (`.gestion-personal-desktop-only` / `-mobile-list`), así
  que ambas pantallas se ven igual y seguirán viéndose igual si alguien las retoca.

- **🔴 Editar cualquier empleado disparaba un cambio de nombre de usuario que nadie pidió.**
  `GestionUsuarios` comparaba el username **normalizado** (`normalizarUsername`: espacios a
  puntos, sin acentos) contra el **guardado sin normalizar**. La migración de Firestore dejó
  **101 de 106** con espacio (`maria treto`) y su correo de acceso ya normalizado
  (`maria.treto@mcdental.internal`), así que abrir a cualquiera de esos 101 y pulsar Guardar
  — sin tocar el campo — daba siempre "cambió": psicóloga veía *"No tienes permiso para
  cambiar nombres de usuario"* y **rh y admin pasaban, renombrando la credencial en
  silencio**. Ahora se comparan los dos lados normalizados: un cambio real se sigue
  detectando, uno inventado no.
- **⚠️ rh y psicóloga pasan a tener las mismas capacidades que admin (migración 099).**
  Decisión del dueño, tomada con las consecuencias explicadas. Se retiran: la reserva a
  admin de cambiar `role` y `auth_user_id` (trigger), la de borrar usuarios en definitiva,
  la de crear cuentas privilegiadas, y las dos guardas que impedían a un rh restablecer la
  contraseña o cambiar el username **de un admin**. Consecuencia directa, anotada aquí a
  propósito: **una cuenta de rh o psicóloga comprometida equivale al sistema comprometido**,
  porque puede promoverse a admin sin que nada lo impida. Se revierte volviendo a poner
  `'admin'` en las comparaciones de la migración 099.

- **🆕 Eliminar notas psicológicas.** El seguimiento dejaba agregar notas pero no quitarlas,
  así que una nota escrita por error se quedaba para siempre. La policy
  `notas_psicologicas_all_gestion` ya era `ALL`, o sea que el borrado estaba permitido en la
  base desde el principio y solo faltaba el camino en la interfaz. Pide confirmación —
  reusando el mismo `confirm` que las bajas de personal, para no tener dos formas distintas
  de confirmar en la misma app — y no es optimista: la lista solo cambia cuando la base lo
  confirma, porque una nota clínica borrada no se recupera.
- **🆕 Historial de permisos y vacaciones en el expediente, con la fecha de solicitud.**
  El expediente tenía Vacaciones pero **no Permisos**, así que para saber qué había pedido
  una persona había que irse a la pantalla de Permisos y filtrar. Ahora salen los dos, con
  *"Solicitado el ..."* en cada renglón: `fecha` es el día que quiere librar y `createdAt`
  el día que lo pidió, y en un expediente hacen falta las dos — "pidió el 3 un permiso para
  el 20" no es lo mismo que "lo pidió el 19". Ordenado por fecha de petición, lo más
  reciente arriba. Visible para admin, RH y psicóloga. La causa se pinta con
  `ETIQUETA_CAUSA`: en la base se guarda acotada al catálogo (`tramite_oficial`) y sin
  traducir era eso lo que se leía en pantalla.

- **🆕 Soporte TI para RH y psicóloga.** Lo tenían empleados y doctores, pero no gestión:
  si a la psicóloga se le rompía la computadora, no tenía dónde levantar el ticket. Va con
  clave propia (`soporteti`) y no reemplazando a `soporte`, porque en gestión esa clave ya
  es Ideas de mejora — son dos módulos que conviven, no uno que sustituye al otro. El
  componente no dependía del rol y `api/soporte-ticket` tampoco filtra, así que solo hacía
  falta la entrada de menú y la ruta.

- **🆕 Admin y RH ya pueden escribirle a Soporte TI por Mensajes (migración 100).** El canal
  existía desde la 094 —lo atienden Erick y Alfredo por bandera `soporte_ti`, no por rol—
  pero solo alcanzaba a psicóloga, empleado y doctor. Admin y RH eran los únicos del
  organigrama sin forma de reportar una falla de TI por ahí. Estaban fuera porque la única
  conversación que existía era la confidencial con la psicóloga, y **eso no cambia**: ven la
  pantalla con *una* conversación, la de Soporte TI, nunca la de la psicóloga. La garantía
  real no es esa pantalla sino `mensajes_select_participant`, que no deja leer un mensaje a
  quien no lo escribió ni lo recibió. La migración añade `rh` a las policies, que lo tenían
  todo menos ese rol — sin eso RH vería el canal y el envío moriría en RLS.

- **🆕 El mismo historial, ahora también en Expedientes** — y **🔴 las vacaciones llevaban
  tiempo sin mostrar fecha ahí**. La fila pintaba `{v.inicio} al {v.fin}` y esos campos no
  existen: el servicio mapea `fechaInicio`/`fechaFin`, así que salía literalmente " al ".
  Corregido, añadida la sección Permisos que faltaba, y las dos con *"Solicitado el ..."*
  ordenadas por fecha de petición. Los tres layouts ya pasaban `permisos`; solo faltaba
  usarlo. Lo ven admin, RH y psicóloga.

**Desplegado hoy: solo el API** (`build-api.sh`), que es donde vive el arreglo de la IA.
El resto — frontend, edge functions y la migración 099 — está commiteado pero **no sale
hasta aplicar la migración, copiar las funciones y correr `build-frontend.sh`**.

### 2026-07-28 · Chat rehecho, videollamadas propias, retención y respaldo externo

> El día siguiente al corte. Primero salieron a la luz tres cosas que el corte había
> roto en silencio, y después se construyó encima: mensajería nueva, servidor de vídeo
> propio, borrado automático de adjuntos y la copia fuera del servidor.

- **🔴 Todos los endpoints estaban caídos y no se veía.** `@supabase/supabase-js` exige
  Node 22+ para tener WebSocket nativo; el contenedor corría Node 20, así que
  `createClient()` reventaba dentro de `admin()` y con él los 12 endpoints: checar,
  enrolar-rostro, enviar-mensaje, resolver y los dos cron. Desde fuera no se notaba —
  solo aparecía en los logs.
- **🔴 Realtime llevaba desde el corte sin funcionar.** La publicación
  `supabase_realtime` tenía 7 tablas en Cloud y **ninguna** en la VPS. La campana de
  notificaciones, asistencias, encuestas, avisos, comisiones y calendario habían dejado
  de actualizarse solos. Una publicación es un objeto **de clúster**, no vive en ningún
  esquema: por eso no apareció al comparar `public`. Reparada en la migración 085.
- **🔴 Soporte TI había desaparecido para empleados y doctores.** Ideas de mejora debía
  sustituirlo **solo** para gestión; se aplicó a los cinco roles, así que la plantilla
  perdió un módulo que funciona a cambio de un marcador "en desarrollo". Había además una
  tercera copia del rótulo escrita a mano en el menú de usuario, que habría seguido
  desincronizada. Las categorías del header tampoco tenían icono: nuevo mapa
  `GROUP_ICONS` con los 10 grupos en uso.
- **🆕 El canal empleado ↔ psicóloga, rehecho en 6 fases (migraciones 085-089).**
  Aspecto inspirado en los componentes Messaging de Untitled UI, reconstruidos a mano:
  los originales son Pro, TypeScript sobre react-aria-components, y aquí el preflight de
  Tailwind está desactivado a propósito.
  1. Burbujas agrupadas por autor y tramo, separadores de día, doble check de leído y un
     composer de verdad. De paso arregla un bug previo: la hora se sacaba partiendo la
     cadena por un espacio, pero PostgREST devuelve ISO con `T`, así que se pintaba el
     timestamp entero donde iba la hora.
  2. Realtime, "escribiendo…" y presencia. La presencia va por canal **de pareja**: el
     punto verde significa "tiene esta conversación abierta", no "está en la app".
  3. Adjuntos (086): bucket privado y dos políticas. La de lectura necesita las dos
     mitades porque el archivo se sube **antes** de que exista el mensaje. Verificado con
     tres identidades reales: quien envía siempre lo ve, la destinataria solo después de
     que exista el mensaje, y un tercero nunca.
  4. Reacciones, respuestas y borrado para ambos lados (087-088). El borrado pasa por
     endpoint y no por una política de UPDATE porque **la RLS no distingue columnas**:
     permitir borrar permitiría también reescribir el texto sin dejar rastro.
  5. Notas de voz. La onda se calcula de verdad con `AudioContext` al grabar; una onda
     inventada sería mentir sobre el contenido. El micrófono se suelta siempre.
  6. Vista previa de enlaces (089) con endurecimiento SSRF. La comprobación va **dentro
     del lookup de la conexión**, no antes de llamar: validar primero y conectar después
     deja la rendija del DNS rebinding. Verificado que quedan fuera `pulse-kong`,
     `pulse-db`, `127.0.0.1`, `169.254.169.254`, los rangos privados, `::1`, `file://` y
     `gopher://`, y que Wikipedia y GitHub sí funcionan.
- **🆕 Videollamadas con servidor propio (migraciones 090-091).** Gestión convoca
  reuniones eligiendo a quién invita; el personal las ve y responde. **Jitsi en la VPS**:
  el vídeo de una sesión con la psicóloga no sale de la máquina, que es coherente con
  haber salido de la nube. Quién puede entrar se decide en `api/reunion-token.js` y en
  ningún otro sitio: Prosody exige JWT (`allow_empty_token=false`).
  - **Las llamadas se cortaban cada 30-60 segundos.** La causa no era la red. El padre
    pasaba `onSalir={() => …}` — una función nueva en cada render — y estaba en las
    dependencias del efecto, así que **cualquier repintado destruía la videollamada** y
    la volvía a montar. Los timeouts de ICE y el "reason: gone" de jicofo eran la
    consecuencia, no la causa. Dos intentos de arreglo por la vía de los timeouts fueron
    descartados antes de dar con esto. Confirmado con una llamada de 1 h 20 min sin caídas.
  - **TURN configurado** (coturn) para las redes que bloquean UDP directo, con los ocho
    rangos privados denegados: sin eso, el TURN se puede usar para alcanzar Postgres o
    Kong desde fuera.
- **🆕 Retención de adjuntos a 90 días (migración 092).** El canal con la psicóloga
  acumulaba imágenes, documentos y notas de voz indefinidamente. Se va el **archivo**, no
  el mensaje: el texto, las reacciones y las respuestas se quedan. Aviso a los 83 días a
  **ambas partes** para que puedan descargarlo. La burbuja distingue "se eliminó por
  antigüedad" de "mensaje eliminado" — sin esa marca, toda conversación vieja parecería
  censurada. La purga **no puede tocar el texto**: sin esa condición en el trigger sería
  una vía para reescribir lo que alguien dijo. Probado con mensajes fechados hacia atrás,
  sin esperar 90 días.
- **🆕 Respaldo fuera de la VPS (migración 093).** Hasta ahora el respaldo vivía en el
  **mismo disco** que protege: cubría el error humano, no perder la máquina — y esa
  máquina es el único sitio donde existe la clínica desde el corte. La oficina **tira**,
  la VPS no empuja: si comprometieran el servidor, un respaldo de empuje regalaría una
  credencial hacia la red interna de la clínica. Clave con comando forzado
  (`rrsync -ro`), verificada: sin shell, sin pty, sin escritura, sin leer los `.env`, sin
  salir del directorio con `..`. Verificación en tres capas y alarma por **silencio** —
  el modo de fallo peligroso es la oficina apagada en vacaciones, que no genera ningún
  error. *(Pendiente de instalar en la máquina de la oficina.)*
  - **Hallazgo:** `pg_restore -l` **no detecta** un byte cambiado en mitad de los datos —
    solo lee la tabla de contenidos de la cabecera. Lo caza el `sha256`. La comprobación
    que se venía usando en `backup.sh` desde el principio verificaba menos de lo que
    parecía.
- **Cabeceras de seguridad recuperadas.** `vercel.json` mandaba `X-Frame-Options`,
  `nosniff` y CSP; nginx no las replica y nadie las copió en el corte. Restauradas, con
  la CSP en **Report-Only** hasta comprobar que no rompe nada.
- **Infraestructura versionada** (`infra/`). El servidor de vídeo, los server blocks de
  nginx, los cron y los scripts de respaldo vivían **solo** en la máquina. Los secretos no
  entran: salen como `__NO_SE_VERSIONA__`, y el README documenta las **dos parejas que
  tienen que coincidir** (`JWT_APP_SECRET`↔`JITSI_APP_SECRET`, `TURN_CREDENTIALS`↔
  `static-auth-secret`); si se separan, el fallo aparece solo en las redes que usan TURN.

### 2026-07-27 · Corte de producción: de Vercel + Supabase Cloud a la VPS

> Estaba previsto para el martes y se adelantó a petición de la clínica. Se migraron los
> datos del día para que el personal administrativo pudiera **marcar salida** esa misma
> tarde en la versión nueva.

- **Pulse dejó de depender de la nube.** Frontend, API y base de datos pasaron a
  `mcdentalpulse.duckdns.org` sobre Docker en la VPS. Supabase autoalojado completo
  (Kong, GoTrue, PostgREST, Realtime, Storage). Desde aquí, **esta base es la única copia
  de la verdad**: ya no hay un Supabase Cloud detrás del que rescatar nada.
- **Migrados**: 102 usuarios (con los 102 hashes de contraseña intactos, verificado por
  comparación md5 — nadie tuvo que volver a registrarse), 1.636 filas en total y 234
  archivos de storage, sin referencias rotas. Congelación por **redirección a la VPS**.
- **Tres correcciones que el ensayo previo destapó**, cada una encontrada antes de tocar
  producción: las columnas GENERATED no se pueden insertar; había que insertar **solo las
  columnas presentes en Cloud** para que los `NOT NULL DEFAULT` se aplicaran; y los
  nombres de archivo con espacios necesitaban `quote(ruta, safe="/")`.
- **Las políticas RLS de Storage no se migraron con el esquema.** Cloud tenía 21 y la VPS
  1, así que el checador fallaba al subir la selfie. La lección: comparar solo `public`
  deja fuera `storage` y los objetos de clúster.
- **`build-frontend.sh`, y por qué existe.** Una reconstrucción manual metió en el bundle
  la URL **interna de Docker** (`http://pulse-kong:8000`) en vez de la pública, y el login
  dejó de funcionar. Revertido en 726 ms. El script nuevo comprueba que el bundle apunte a
  la URL pública y **aborta y revierte** si no. El frontend no se vuelve a construir a
  mano.
- **`migrar_de_cloud.py` no se puede volver a ejecutar.** Vacía 30 tablas y recarga desde
  Cloud: correrlo ahora destruiría todo lo posterior al corte.

### 2026-07-25 · Firma del autor en los avisos y control de versiones del árbol de la VPS

- **🆕 Los avisos van firmados (migración 084).** El nombre del autor ya no sale de un
  join a `usuarios`: la RLS de esa tabla solo deja a cada quien leer **su propia fila**,
  así que al empleado le llegaba vacío y veía un guion. Ahora se copia en el propio aviso
  con un trigger. El historial muestra el comunicado **completo** (antes recortado a 2
  líneas) y firmado con nombre y rol. La espera del botón "De acuerdo" pasa a ser
  configurable por admin (0-300 s) desde la propia pantalla.
- **Primer control de versiones del código que corre en la VPS** (rama `vps-docker`).
  Hasta entonces vivía como archivos sueltos, sin historial ni marcha atrás. Incluye
  trabajo que no existía en el repo de producción: tabla estilo Untitled UI en
  `/empleados` y `/usuarios`, slideout de detalle, `SortableTh`, `useBajaUsuario`,
  `validacionUsuario` con tests, modal de alta/edición reescrito y archivar-en-vez-de-
  borrar (migración 083).

### 2026-07-24 · Rediseño Untitled UI, navegación en header y voz en el checador

- **🔴 Faltaban 54 de 99 personas en diez pantallas.** `esEmpleadoActivo` pedía
  `role === "empleado"` a secas; el rol `doctor` nació después y nunca se añadió, así que
  los doctores desaparecían de Empleados, los tres dashboards, Reportes RH,
  Reconocimientos, Descuentos, Mensajes, AI Engine y Seguimiento. En producción son 45
  empleados + 54 doctores = **99 personas, y solo se veían 45**. Los datos y los permisos
  estaban bien: era el filtro del cliente. Una línea (`ROLES_PLANTILLA`) arregla los 24
  sitios que lo usan.
- **🆕 Rediseño estilo Untitled UI.** En claro, superficies, textos y bordes pasan a ser
  **neutros** en vez de teal-tintados; la marca queda solo como acento. Radios y sombras
  más contenidos, cards planas. `PageHeader` (41 páginas) pierde el banner con gradiente y
  aura animada. AdminDashboard baja de 8 a 4 secciones y PsicologaDashboard de 6 a 4:
  fuera dos bloques que repetían los KPIs de arriba. Cuatro componentes nuevos que cubren
  repetición real: `EmptyState`, `Tabs`, `FilterBar`, `DateRangePicker`. 308/308 tests.
- **🆕 Navegación en header horizontal para escritorio.** El sidebar vertical se sustituye
  en >768px por un header con las páginas agrupadas por categoría; en móvil sigue
  exactamente igual. Buscador global de páginas por nombre (ignora mayúsculas y acentos).
  Paridad verificada ítem a ítem: admin 20, psicóloga 27, RH 28, empleado 13, doctor 14.
  *(Deuda conocida: `Sidebar.jsx` conserva su propia lista, así que hay dos sitios que
  tocar al cambiar el menú.)*
- **🆕 El checador habla (TTS).** Narra en voz alta lo que ya mostraba en pantalla, para
  quien no está mirando el móvil mientras se encuadra: "acércate", "centra tu cara", "gira
  despacio la cabeza hacia tu izquierda", y confirma: *"Entrada registrada a las 9:15, con
  retardo"*. Web Speech API nativa — sin librerías, sin red, sin coste. Una sola autoridad
  de voz para que no haya dos motores cancelándose. Botón 🔊/🔇, recordado. 318/318 tests.
- **🆕 Bloqueo de salida el sábado sin encuesta (migración 082).** Regla decidida **en el
  servidor** (`registrar_checada`): el sábado, si no hay fila de encuesta para la semana
  ISO actual, no se puede marcar salida hasta contestarla. La entrada no se toca.
- **🆕 Sucursales dinámicas** (se acabó el array fijo), **medallas de reconocimientos**
  (SVG en línea, sin CDN), **eliminar archivo de expediente** (migración 081) y rediseño
  de Vacaciones y Permisos manteniendo intacta la lógica de negocio.
- **Fix:** el editor de avisos crasheaba al reconectarse (`Cannot read properties of null`)
  porque el efecto de sincronización llamaba a `editor.getHTML()` con el editor a medio
  destruir.

### 2026-07-23 · Rol doctor, Comisiones, calendario de la clínica y avisos con formato

- **🆕 Rol `doctor` (migraciones 072-073).** Enum nuevo y backfill de 54 dentistas; hereda
  todo lo de empleado y suma menús propios. Se corrigieron seis filtros que los excluían.
- **🆕 Comisiones (074).** Los doctores fotografían el recibo con la cámara —escáner
  OpenCV que detecta bordes, recorta y endereza— y RH valida o rechaza con mensaje y
  notificación. Tabla + bucket privado.
- **🆕 Calendario de festivos e intercambio de días (075-077).** Festivos oficiales de
  México 2026/2027, distinguiendo **no laborables** (rojo) de **conmemorativos que se
  trabajan** (verde), y solicitud de intercambio de días con índice único por fecha destino
  y aprobación de RH. Corregido el Día del Trabajo 2027: es el 1 de mayo por LFT, la fuente
  lo tenía en el 30 de abril.
- **🆕 Agenda de la clínica (078).** Módulo de eventos por hora con tres vistas (Mes,
  Semana, Día), rejilla de horas, banda de "todo el día" y línea de "ahora". Festivos,
  vacaciones, permisos e intercambios se superponen como eventos de todo el día.
- **🆕 Avisos con texto enriquecido (080).** Negrita, cursiva, listas, títulos y enlaces
  con TipTap. El cuerpo se guarda como HTML y se muestra **sanitizado** (DOMPurify). El
  chunk del editor se carga aparte: no pesa a empleados ni doctores. El trigger de
  notificaciones limpia el HTML a texto plano para la campana.
- **🆕 RH y la psicóloga pueden auto-agendarse** sus vacaciones y permisos, ya aprobados
  (079). Antes no tenían forma de registrar sus propios días de descanso.
- **Migración de todos los iconos a Untitled UI** (`@untitledui/icons`, MIT). El
  componente central `Icon` cambia la app entera desde un archivo.
- **Consolidación de 4 endpoints en `/api/resolver`.** Vercel Hobby permite 12 funciones y
  la feature nueva subió el total a 15. *(Restricción que dejó de aplicar con el corte a la
  VPS cuatro días después.)*

### 2026-07-22 · Color de marca personalizable

- **🆕 Paleta generada en OKLCH** en vez de HSL: preserva la luminosidad perceptual al
  rotar el tono, así el contraste AA se mantiene en todo el espectro — con HSL, el texto
  sobre superficies de marca se volvía ilegible con amarillos y azules. El color se cachea
  por dispositivo, así que **el login ya se pinta con el último color usado**, sin
  parpadeo y sin depender de la sesión (migración 070).
- **Fix (071): el empleado veía "no se puede aplicar el color".** `guardar_mi_color` hace
  UPDATE de `color_acento`, pero el trigger anti-escalación de privilegios (migración 027)
  restringe el self-update de un no-admin a solo `avatar_url` y lo abortaba. Se resolvió
  con el mismo patrón que `mark_password_changed`: una señal local a la transacción que el
  trigger exime, **sin reabrir el hueco** — el empleado no puede activar la señal por su
  cuenta.

### 2026-07-21 · Auto-cierre de jornada, filtros por estado y blindaje del push

- **🆕 Auto-cierre de jornada (migración 069).** El cron diario cierra las entradas sin
  salida de días pasados con la hora de **fin de turno**, no la del cron, marcadas con
  origen `sistema` y una nota. El panel se cortó a partir del 21/07 para arrancar limpio
  (se borraron 14 checadas y 306 permisos de prueba en producción).
- **Las 6 tarjetas de estado ahora filtran** el detalle por empleado, con chip de filtro
  activo.
- **Checador disponible para RH y psicóloga**, que antes no podían marcar.
- **Push, tres causas de raíz atacadas**: se auto-sincroniza la suscripción al cargar y en
  cada despliegue (antes solo con un botón manual), se maneja `pushsubscriptionchange` en
  el service worker (rotación del navegador) y se auto-sana por huella de la clave VAPID.
  Modal obligatorio de activación, con salida solo para iPhone sin instalar.
- **Fix:** el modal bloqueante de avisos no se cerraba (`duplicate key`) y bloqueaba
  también al propio autor del aviso.

### 2026-07-18 · Avisos por sucursal · rediseño de Asistencia y Horarios · auditoría a11y

> Sesión larga de UI + una feature de datos. Todo se probó contra el Supabase **local**
> antes de subir; la migración de avisos se aplica a producción por separado (Management
> API + PAT), y frontend y migración deben desplegarse juntos.

- **🆕 Avisos dirigidos por sucursal (migración 068).** Hasta ahora un aviso era para toda
  la plantilla. Nueva columna `avisos.sucursales text[]` (con `check (cardinality >= 1)` —
  **no** `array_length`, que devuelve `NULL` en arreglos vacíos y un CHECK con NULL *pasa*,
  colando avisos sin destino). La RLS de SELECT se partió en dos: la gestión (admin/rh/
  psicóloga) sigue viendo **todo** el historial para administrarlo, un empleado ve **solo**
  los de su sucursal. El trigger `notificar_aviso_nuevo` (065) ahora notifica en la campana
  solo a la plantilla de las sucursales destino. El **modal bloqueante** filtra del lado del
  cliente por la sucursal de quien mira: sin eso, un admin —que sí puede leer todos— quedaría
  preso del modal de cada aviso local. Los avisos que ya existían se rellenaron con las 25
  sucursales (retrocompatible). El formulario trae un selector de chips con búsqueda,
  "Seleccionar todas"/"Limpiar", contador y validación (mínimo una sucursal); el historial
  muestra badges de destino. Verificado E2E: un aviso a "McDental Tuxpan" le llega a un
  empleado de Tuxpan y **no** a uno de Palmas.
- **Rediseño de la pestaña de Asistencia.** Los filtros pasaron a una barra: búsqueda +
  granularidad como control **segmentado** (Día/Semana/Mes/Año) + navegador de fecha siempre
  visibles, y Sucursal/Empleado en un panel que abre con el botón "Filtros" (con badge del
  número de filtros activos, cierra con Escape y clic-fuera). Los 6 indicadores pasaron de un
  grid que se partía 4+2 a una **tira compacta** de una fila (3+3 / 2 columnas en móvil). Las
  checadas sospechosas ganaron un acento de alerta y un puntito en la fila del empleado
  afectado. Sin cambios en la lógica de días/clasificación.
- **Rediseño de la pestaña de Horarios.** Cada empleado dejó de ocupar un bloque de 7
  tarjetas-día (scroll interminable con ~100 personas) y pasó a una fila de **acordeón** con
  resumen (días marcados + turno estándar + nº de excepciones). Al expandir, un editor de
  "**turno estándar + días**": defines entrada/salida/tolerancia una vez y marcas con chips
  qué días lo usan; los días con un turno distinto salen como **excepciones** editables
  aparte. El estándar se deriva del turno más frecuente de la persona. Reusa
  `upsertHorario`/`deleteHorario`: cero cambios en la capa de datos.
- **Menús desplegables y widgets nativos con tema.** Se agregó `color-scheme` (dark/light) +
  `accent-color` al tema: los popups de `<select>` y los spinners de `<input type=time/number>`
  ya no salían claros sobre el fondo oscuro. El `<select>` de sucursal en Horarios pasó a un
  desplegable propio (reusa `WeekSelect`).
- **Auditoría de accesibilidad y calidad.** Foco de teclado visible y uniforme
  (`:focus-visible` global, WCAG 2.4.7); `prefers-reduced-motion` global; el teal usado como
  texto en modo claro se oscureció (`#0E8C7A` → `#0B7A6B`) para pasar el 4.5:1 de AA; cierre
  con Escape en cuatro modales que no lo tenían (hook `useEscapeKey`); `console.*` se elimina
  del bundle de producción; guard de variables de entorno en `config/supabase.js`;
  `loading="lazy"` en los avatares.

### 2026-07-16 · Hotfix del checador + sidebar seccionada + filtros de Asistencia

> El usuario reportó "no se registran los datos de asistencia" junto con tres pedidos de UI.
> Investigando ese reporte apareció una segunda regresión de la auditoría de seguridad de
> hoy mismo — no algo que el usuario supiera nombrar, la encontró la investigación.

- **🔴 Hotfix: `api/checar.js` rechazaba checadas reales.** El chequeo de "frescura" del
  `selfiePath` agregado en la auditoría de hoy comparaba `Date.now()` del servidor contra un
  timestamp puesto por el **navegador del empleado** en el nombre del archivo. Con 60
  segundos de margen, cualquier teléfono con el reloj desincronizado —común en Android de
  gama baja— rechazaba la checada siempre, sin importar que la persona estuviera al frente
  de la cámara. Confirmado por el usuario: ni admin/RH ni el propio empleado en "Historial"
  veían checadas nuevas, lo que descarta un problema de RLS y apunta a que la fila nunca se
  llegaba a crear. Ventana ampliada a 10 minutos — sigue acotando el replay (no se puede
  reusar una selfie de horas/días atrás) sin depender de que el reloj del teléfono esté
  sincronizado al segundo.
- **Sidebar de escritorio seccionada.** Cada ítem de navegación ya traía un campo `group`
  opcional, usado hasta ahora solo para agrupar la hoja "Más" del tabbar móvil — el desktop
  lo ignoraba y pintaba 20-24 ítems como lista plana. Se generalizó la función de agrupado
  para reusarla también en desktop: cero cambios en los datos de navegación, mismo campo,
  ahora leído en los dos lugares.
- **Filtros de Asistencia sin estilo.** "Agrupar por" y "Empleado" (y los inputs de fecha)
  no tenían `className`: quedaban con el widget nativo del navegador en vez del estilo del
  resto de la app. Se aplicaron las clases `list-filter-select`/`list-filter-input`, que ya
  existían y ya se usan en otras pantallas.
- **Búsqueda + filtro por sucursal en Asistencia.** Mismo patrón que `GestionUsuarios.jsx`
  (`list-filters-grid--2col` + `table-search` + `SUCURSALES`), alimentando el `useMemo` de
  `empleados` — el resto de la lógica de días/resumen/CSV no se tocó.

**Pendiente de confirmar por el usuario**: probar una checada real en un teléfono de la
clínica tras el deploy. Si el reloj de algún dispositivo está desfasado más de 10 minutos,
seguiría fallando — en ese caso el fix correcto es comparar contra la fecha real de subida
en Storage (metadata del servidor) en vez del nombre del archivo, que no depende de ningún
reloj de cliente pero cuesta una llamada extra a Storage por checada.

### 2026-07-16 · Hotfix: la CSP de la auditoría rompía Realtime y fuentes

> La `Content-Security-Policy` agregada en la auditoría de seguridad de este mismo día
> bloqueaba en producción: el WebSocket de Supabase Realtime (`connect-src` no cubre
> `wss://` con solo `https://*.supabase.co` — son esquemas distintos para CSP) y la carga
> de Fira Code/Fira Sans desde Google Fonts (`style-src` sin `fonts.googleapis.com`,
> `font-src` sin `fonts.gstatic.com`). Se detectó por el propio usuario viendo la consola
> en producción, no en esta sesión. Corregido agregando los tres orígenes faltantes.
> **Lección**: `vercel.json` no aplica en `npm run dev`, así que una CSP nueva solo se
> valida de verdad mirando la consola en producción tras el deploy — no alcanza con que
> compile.

### 2026-07-16 · Aviso de actualización de la PWA

> El service worker ya se actualizaba solo (`skipWaiting` + `clientsClaim`), pero eso solo
> mueve el *worker*: el JS que la pestaña tenía cargado en memoria seguía siendo el viejo
> hasta un reload, y en un PWA de celular —que casi nunca navega ni se cierra del todo— el
> navegador tampoco revisaba solo si había versión nueva. Los usuarios terminaban con la
> app desactualizada sin saber que había que borrar caché a mano.

- **Chequeo activo, no pasivo.** `registration.update()` al cargar, cada 10 minutos y cada
  vez que la app vuelve a primer plano (`visibilitychange`) — antes solo se revisaba en una
  navegación completa, que en un PWA que se queda abierto en el celular casi no pasa.
- **Aviso en el momento exacto del relevo.** `navigator.serviceWorker.oncontrollerchange`
  dispara justo cuando el SW nuevo toma el control. Ahí se muestra un toast — no un reload
  forzado, que podría cortarle a alguien una foto a medias en el checador.
- **Un toast nuevo: persistente y con acción.** `notify.toast.update(mensaje, { label,
  onClick })` reusa el mismo componente `Toast` de siempre (mismo estilo, mismo
  contenedor), solo que no se autocierra a los 4.2s y suma un botón.
- **Escape hatch manual, en "Mi perfil" (los 4 roles).** El chequeo automático depende de
  que el celular vuelva a primer plano o pasen los 10 minutos — probado en un Android real,
  el aviso automático no siempre llega a tiempo de notarse. Se agrega un botón "Buscar
  actualización" que fuerza el mismo chequeo (`registration.update()`) al toque y recarga,
  sin esperar. `src/utils/appUpdate.js` centraliza la lógica para que el chequeo automático
  y el manual no diverjan.

### 2026-07-16 · Auditoría de seguridad: frontend, backend y base de datos

> Tres auditorías en paralelo (frontend, API serverless, migraciones de Supabase) sobre el
> sistema completo, con foco en el checador facial biométrico y los datos de RH más
> sensibles (notas psicológicas, expedientes, reportes confidenciales). **2 hallazgos
> ALTOS y 6 MEDIOS/BAJOS corregidos**, verificados contra el código real (no contra lo que
> decía el reporte) antes de escribir cada fix, y aplicados tanto en el repo como en la
> base de datos de producción.

#### 🔴 Backend — control de acceso roto

- **Replay attack en el checador (`api/checar.js`).** El `selfiePath` que manda el
  cliente no se validaba: cualquiera podía reenviar la ruta de una selfie **vieja ya
  aprobada** (visible en su propio historial) y volver a "checar" sin estar frente a la
  cámara. El freno de abuso tampoco lo detectaba, porque solo cuenta intentos **fallidos**
  y un replay exitoso nunca falla. Ahora se exige que el path sea de la propia carpeta del
  empleado (`${empleadoId}/…`) y tenga menos de 60 segundos.
- **`CRON_SECRET` fail-open.** `api/limpiar-fotos.js` y `api/tareas-programadas.js`
  comprobaban el secreto con `if (secreto && header !== …)`: si la variable de entorno no
  estaba configurada —que era el caso real en producción— la condición entera se saltaba y
  el endpoint quedaba **público**. Ahora es fail-closed: sin `CRON_SECRET` configurado, el
  endpoint responde 500 en vez de abrirse.
- **`api/gemini.js` sin chequeo de rol.** Validaba el JWT pero nunca leía
  `usuarios.role`, así que cualquier empleado autenticado podía pegarle directo al proxy de
  IA (reservado a admin/RH/psicóloga en la UI) con `curl` y saltarse el guardarraíl.
  Corregido reusando `quienLlama()` de `_auth.js`, el mismo patrón que ya usa el resto de
  `api/`.
- **`api/enviar-mensaje.js` sin validar el par remitente/destinatario.** El canal
  "confidencial" empleado↔psicóloga dejaba a cualquier empleado escribirle a cualquier
  otro empleado. Ahora un empleado solo puede escribir a alguien de gestión
  (admin/rh/psicologa).
- **`api/enrolar-rostro.js`** tenía el mismo hueco que el checador: las fotos que RH sube
  para enrolar a otra persona no se comprobaban contra la carpeta de destino.
- **Límites de tamaño** agregados en los tres payloads que no pasaban por Storage
  (`retoFoto` base64, `prompt` de Gemini, `texto` de mensajes) — sin ellos, un payload
  grande forzaba una decodificación/inferencia cara en cada llamada.

#### 🗄️ Base de datos — migración 059

- **Regresión de InitPlan en 5 policies.** La migración 050 (que amplió `encuestas`,
  `notas_psicologicas`, `reportes_confidenciales` y `reconocimientos` a rh/psicologa) las
  recreó **sin** el wrapper `(select current_role())` que la migración 028 exige para que
  Postgres evalúe la función una vez por consulta, no por fila. Justo las tablas que crecen
  sin techo.
- **Auto-aprobación de vacaciones y permisos.** `vacaciones_insert_own_or_rh` y
  `permisos_insert_own_or_rh` (migración 016) solo validaban `empleado_id`, no
  `estado`/`origen`: un empleado podía insertar su propia solicitud, vía `supabase-js`
  directo, ya con `estado='aprobado'` y `origen='rh'`, saltándose el flujo de aprobación
  entero. Mismo tipo de hueco que ya se había cerrado en `usuarios` (mig 023/025) y
  `mensajes` (mig 032), pero se había quedado suelto acá.
- **`descuentos.monto` sin `CHECK`.** Se agrega `CHECK (monto > 0)` como `NOT VALID`
  (exige el mínimo desde ahora sin escanear el histórico, que no se pudo auditar desde el
  repo).

#### 🛡️ Cabeceras de seguridad

`vercel.json` suma `Content-Security-Policy`, `X-Frame-Options: DENY` y
`X-Content-Type-Options: nosniff`. La CSP incluye `wasm-unsafe-eval` y
`worker-src blob:` porque el detector de rostro del cliente (MediaPipe) carga su propio
wasm y worker desde `/mediapipe`.

#### ⚠️ Decisiones y pendientes

- **La contraseña temporal `emp123` no se toca** — se identificó como hallazgo (fija e
  igual para todas las cuentas nuevas/reseteadas) pero es una decisión de negocio explícita
  del dueño, no un bug a corregir en esta ronda.
- **`CRON_SECRET` queda pendiente de configurar en Vercel** (Settings → Environment
  Variables) — sin eso, los crons de limpieza y tareas programadas devuelven 500 a
  propósito en vez de quedar abiertos.
- Un Personal Access Token de Supabase quedó expuesto en el chat de la sesión (dos veces).
  **Pendiente de rotar.**

#### 🧪 Verificación

`npm run lint` (0 errores nuevos sobre los 92 preexistentes del repo, ninguno en los
archivos tocados) y `npm test` (296/296) antes de commitear. La migración 059 se aplicó a
mano vía el SQL Editor de Supabase (el CLI local no estaba autenticado) y se verificó
contra la base real: `pg_constraint` confirma `descuentos_monto_positivo`, `pg_policies`
confirma las 7 policies recreadas.

### 2026-07-13 · El modo oscuro deja de ser un parche

> Rehacer los estilos para que el tema oscuro **forme parte del sistema** en vez de ir por detrás
> arreglándolo. Se retiran las **710 líneas** de `src/styles/dark/` (7 archivos, 180 reglas de
> override) y el color pasa a decidirse en **un solo sitio**: los tokens de `src/index.css`.
> Resultado medido: **0 reglas `[data-theme="dark"]`** fuera del bloque de tokens.

#### 🎯 La causa raíz eran tres capas, cada una tapando la siguiente

1. **Los colores vivían en JavaScript.** `pulseScore.js` devolvía `{ color: "#22c55e" }` y los
   componentes lo aplicaban como `style={{ color }}`. Un estilo inline **gana por especificidad**:
   ninguna regla CSS de tema oscuro podía alcanzarlo. Por eso los overrides no bastaban. *(50 hex en
   JS → 0.)*
2. **`App.css` tenía 379 hex escritos a pelo** *(→ 0; solo quedan máscaras `#000` y comentarios)*.
3. **Y algunos tokens tampoco cambiaban de tema**: `--mc-texto`, `--mc-blanco`, `--mc-verde-oscuro`
   y los cuatro tokens de borde (que eran blanco puro).

Había **seis paletas distintas para el mismo verde de semáforo** (`#059669`, `#22c55e`, `#2F7D5A`,
`#006D5B`…), repartidas entre `index.css`, `pulseScore.js`, `theme.js`, los dos dashboards y
`constants.js`.

#### 🔍 Lo que apareció al medir en vez de mirar

Se escribió una comprobación que **resuelve todos los tokens en tema oscuro y mide la luminancia**
de cada declaración, en lugar de revisar pantallas a ojo. Encontró fallos que llevaban ahí desde
siempre:

- **31 reglas pintaban texto e iconos con `--mc-verde-medio` (`#0E8C7A`)**, que no cambia con el
  tema. Sobre el fondo oscuro da **3:1**: apagado y costoso de leer. El verde de marca **como
  texto** tiene que aclararse en oscuro — y es distinto del verde de marca *en sí*, que también se
  usa de fondo y no debe cambiar. Token `--mc-marca-texto`.
- **Los botones rojo y ámbar eran ilegibles en oscuro.** Fijaban el texto en blanco, pero en tema
  oscuro su fondo es un **pastel claro** (`#FCA5A5`, `#FCD34D`). Y forzar texto oscuro habría roto
  el tema claro, donde esos mismos fondos son `#A84444` / `#9A6B1F`. **Si el fondo se invierte con
  el tema, el texto tiene que invertirse con él**: ningún color fijo sirve. Contraste verificado en
  los 4 casos (5.87 / 8.98 / 4.67 / 11.82 : 1, todos pasan WCAG AA).
- **`.list-filter-select option` no tenía fondo.** El desplegable **abierto lo pinta el sistema
  operativo**, no la página: sin fondo explícito sale **blanco** aunque la app esté en oscuro. Era
  el "submenú blanco" reportado.
- **El bloque `prefers-reduced-motion` llevaba `[data-theme="dark"]`**, así que en tema claro **no
  se aplicaba**: quien pedía "sin movimiento" seguía viendo el fondo animarse.
- **La pill de la pestaña activa del AI Engine nunca se pintó, en ningún tema.** La regla
  `.ai-engine-tab > *` (que sube el icono y el texto por encima de la pill) alcanzaba **también a la
  propia pill** y —con más especificidad— le quitaba el `position: absolute`. Sin él, un `<span>`
  vacío mide **0×0**. En claro no se notaba; en oscuro dejó texto oscuro sobre fondo oscuro.

#### 🧹 Deduplicación

Los 180 overrides no eran 180 decisiones: eran **el mismo par repetido**.

| Par (claro → oscuro) | Token único | Reglas que absorbe |
|---|---|---|
| `--mc-texto` → `--mc-texto-titulo` | `--mc-texto-fuerte` | 10 |
| `slate-600/700` → `--mc-texto-secundario` | `--mc-texto-apagado` | 5 |
| `slate-100/50` → `--mc-superficie-input` | `--mc-superficie-sutil` | 3 |

Y `.expediente-foto-upload` / `-quitar` resultaron ser los botones **"editar" y "borrar"
duplicados**, con su propia copia de los colores… y por tanto su propio override duplicado.

#### 🧱 Otros arreglos de estructura

- **Doble scroll en las listas** (Expedientes, Gestión de Personal). `.list-page` usaba
  `max-height: calc(100vh - 56px)`, y **`max-height` no da una altura definida**: el contenedor se
  dimensiona por su contenido (la tabla entera) y solo *después* se recorta. La tabla, con `flex: 1;
  min-height: 0`, nunca recibía una altura contra la que encoger. Con `height` sí. De paso se va el
  `56px` mágico, que era el padding de `.app-main` copiado a mano.
- **Un solo ritmo vertical** (`--mc-ritmo-pagina`). 26 pantallas usaban `.admin-page` (gap 20px) y 2
  usaban `.list-page` (**gap 0** — cabecera pegada al contenido, y sin `margin: 0 auto`, ni
  centrada). Había además **tres reglas de gap peleándose** en móvil (16/12/12px); la de 16px era
  **código muerto**.
- **En desarrollo, el `ErrorBoundary` muestra el error en pantalla.** Antes atrapaba la excepción,
  pintaba "Algo no salió como esperábamos" y mandaba la causa a la consola: desde fuera eso se ve
  igual que "no carga", sin ninguna pista. En producción se sigue ocultando.

#### ⚠️ Lecciones (las tres son la misma)

- **Un `sed` sobre nombres de props es un refactor de API disfrazado de buscar-y-reemplazar.** Hay
  que comprobar **quién recibe**, no solo quién envía: `<RiskBar color=…>` cuando el componente
  espera `slug` **no da error** — React ignora la prop en silencio y usa el valor por defecto. Se
  añade una auditoría que cruza cada `<Componente prop=…>` contra la firma real.
- **Un `sed` sobre expresiones tiene que anclar la expresión completa.** Sustituir el trozo
  `status.color` dentro de `a.status.color` deja el `a.` colgando: `a.nivelColor(...)`. Reventaba
  "Expedientes IA" y ni el build ni el lint lo veían — `a` existe, así que `no-undef` no protesta.
- **Verificar la intención, no la coincidencia.** Un `grep -q 'nivelTinte'` daba verde porque
  encontraba el **uso**, no el **import**. La app no cargaba.

#### 🛠 Base técnica

Tailwind v4 (`@tailwindcss/vite`, config CSS-first) queda instalado y disponible para código nuevo,
con `@custom-variant dark` enganchado al `data-theme` que ya ponía `ThemeContext`. **Se descartó
migrar las 25 pantallas existentes a Tailwind**: al medirlo, el trabajo caro (reescribir 10.500
líneas) no compraba nada — el valor estaba en sacar los colores de JS y montar la capa de tokens, y
eso ya estaba hecho. `DESIGN.md` recoge la regla nº1: **ningún hex fuera de `src/index.css`**.

### 2026-07-12 · Auditoría completa: seguridad, escalabilidad, concurrencia y calidad

> Auditoría de la app (escalabilidad, multiusuario, concurrencia, índices, seguridad) y
> remediación completa. **20 hallazgos, 18 corregidos.** Seis migraciones (028–033) aplicadas y
> verificadas contra la base, no solo escritas.

#### 🔒 Seguridad
- **El dataset legacy de usuarios sale del código y del bundle.** `src/data/initialData.js`
  conservaba el roster que sirvió de origen para la migración a Supabase. Ya no lo consumía nadie
  —la fuente de verdad es `public.usuarios`— pero **no se eliminaba por tree-shaking**: Rollup no
  puede descartar un export cuyo valor sale de una llamada a función
  (`USERS_RAW.map(applyCanonicalAdminDates)`), así que acababa incluido en el JavaScript de
  producción. **Lección: el tree-shaking se verifica con un `grep` sobre `dist/`, no leyendo los
  imports.**
- **`adminEmployeeDates.js` dejó de pisar a la base.** Mantenía un override por nombre para 14
  empleados administrativos que se aplicaba **por encima** de `usuarios.fecha_ingreso`. Además de
  ser datos en el código, **tapaba el estado real de la base**: 11 de los 14 tenían el campo vacío
  en producción y el hardcode era su única fuente. Las fechas se sincronizaron **primero** a la base
  y **después** se borró el override — al revés, esos empleados se habrían quedado sin fechas.
- **Las tres Edge Functions validan el rol del objetivo, no solo el del llamador.** Las migraciones
  023/025 restringen los cambios de rol con un trigger `BEFORE UPDATE`, pero las Edge Functions usan
  `service_role` (que no pasa por RLS) y el trigger no cubre `INSERT`. `admin-create-usuario`,
  `admin-reset-password` y `admin-update-username` autorizaban con `["admin","rh"]` y luego actuaban
  sobre el usuario objetivo sin volver a comprobar su rol.
- **Mínimo privilegio sobre `public.usuarios`** (migración 030). La policy concedía `SELECT` sobre
  todas las columnas y todas las filas a cualquier autenticado. RLS es *row*-level, no
  *column*-level, así que se separan las dos necesidades: una vista `usuarios_directorio` con el
  subconjunto no sensible (nombre, rol, foto…) legible por todos, y la tabla base restringida a los
  roles que gestionan expedientes y altas — más la fila propia de cada usuario.
- **El Pulse Score se calcula en el servidor** (migración 031). Antes lo calculaba el navegador y se
  insertaba tal cual: nada comprobaba que el score correspondiera con las respuestas. Un trigger
  `BEFORE INSERT` lo recalcula desde `respuestas` y rechaza la encuesta si faltan respuestas de
  escala. *(La fórmula se validó antes de escribirla: reproduce los 36/36 scores ya guardados, con
  diferencia 0.)*
- **El receptor de un mensaje solo puede marcarlo como leído** (migración 032). La policy se llamaba
  `mensajes_update_mark_read`, pero concedía `UPDATE` de la **fila entera**: el receptor podía
  reescribir el `texto` de lo que le mandaron, o el `de_id` para atribuírselo a otra persona.
- **Rate limiting en el proxy de IA** (migración 033). `api/gemini.js` exigía un JWT válido pero no
  limitaba las llamadas: se podía quemar la cuota de Gemini en un bucle. 30 llamadas por hora y
  usuario. El contador vive en una tabla **sin policies de RLS a propósito**: solo se accede vía una
  RPC `security definer`, así que nadie puede borrar su propio contador para saltarse el límite.
- **CORS acotado** en las Edge Functions (antes `*`), configurable con el secreto `ALLOWED_ORIGINS`
  sin tocar código. Y `admin-create-usuario` **valida el username**: un valor de solo caracteres
  inválidos se saneaba hasta quedar en nada y creaba una cuenta inutilizable.

#### 🚀 Despliegue (leer esto)
- **Las Edge Functions llevaban 10 días sin desplegar.** Los arreglos de arriba estaban en el repo,
  pero las versiones **desplegadas** eran del 2026-07-02: el código estaba corregido y el fallo
  seguía vivo en producción. **Las Edge Functions no se despliegan con Vercel** — viven en Supabase
  y necesitan su propio `supabase functions deploy`. Mergear un PR no las toca.
  *(Es la misma trampa que documenta la entrada del 2026-07-11 sobre los tickets, y se repitió.)*

> **Comprobación fija:** después de tocar `supabase/functions/`, verificar la **fecha de despliegue
> real** (`GET /v1/projects/{ref}/functions`). «Mergeado» no es «desplegado». Lo mismo con las
> migraciones: el repo y la base son dos cosas distintas.

#### 🐛 Corregido — la familia de bugs del jsonb `respuestas`
El campo `respuestas` se indexa por el **id de la pregunta** (un UUID), pero varias partes del código
lo leían con **claves numéricas** del dataset legacy. El mismo malentendido produjo **tres** bugs
independientes, y ninguno fallaba de forma visible:

- **Una encuesta sin score se contaba como un 0.** El guard `Number.isFinite(Number(e.score))` estaba
  copiado a mano en **29 sitios**, pero `Number(null) === 0`: una encuesta sin score entraba como un
  cero real, con el semáforo y la prioridad de riesgo que eso implica. Sustituido por un único
  predicado, `tieneScoreValido()`, que acepta el `0` (respuesta real) y descarta `null` / `""`.
  *(En producción no había ninguna fila afectada: ningún dato de los dashboards cambia.)*
- **La respuesta a «¿Has pensado en renunciar?» se guardaba y no se leía nunca.** El motor de riesgo
  buscaba la clave `9`, que no existe en los datos. El ajuste de riesgo por esa respuesta (+15 / +8)
  **nunca se aplicó**, y tres columnas del Excel de RH salían siempre vacías.
- **El prompt de la IA decía `emocional=undefined`.** `buildEmpContexto` leía `respuestas.emocional`,
  `.estres` y `.motivacion`. **La IA analizaba el bienestar de la plantilla sin ver ni una sola
  respuesta de escala** — solo el score agregado.

**Todas las lecturas pasan ahora por los helpers de `encuestaDetail.js`**, que localizan la pregunta
por su **tipo** y leen por su **id**. **No volver a escribir `respuestas[<número>]` a mano.**

#### 🐛 Corregido — concurrencia
- **Las aprobaciones ya no se contradicen con la base.** Vacaciones, permisos, descuentos y mensajes
  leídos pintaban el cambio en la UI **antes** de escribir, y si la escritura fallaba solo mostraban
  un aviso: nunca revertían. La pantalla se quedaba en «Aprobado» mientras la base seguía en
  «pendiente», hasta recargar. Las cuatro acciones revierten ahora al estado previo.

#### ⚡ Datos y rendimiento
- **Se elimina el riesgo de truncado silencioso.** Ninguna lectura tenía `.limit()` ni `.range()`.
  PostgREST corta en `max-rows` (1000 por defecto) **sin dar error**: al superar esa cifra, los
  dashboards habrían calculado promedios y participación sobre datos incompletos sin que nadie lo
  notara. El helper `fetchAll()` pagina hasta agotar la tabla. *(Hoy hay 36 encuestas: es prevención.)*
- **RLS se evaluaba una vez por fila.** Las policies llamaban a `current_role()` directamente y
  Postgres la re-ejecutaba por cada fila escaneada. Envuelta en `(select ...)` → InitPlan: una sola
  evaluación por consulta.

#### 🗄️ Base de datos — migraciones 028 a 033 (aplicadas y verificadas)
| # | Qué |
|---|---|
| 028 | Las 40 policies de RLS con subselect (InitPlan). Misma lógica, mismos permisos |
| 029 | `encuestas.score` a `NOT NULL` + `CHECK (0..100)`; `semaforo` acotado |
| 030 | Vista `usuarios_directorio` + tabla `usuarios` restringida |
| 031 | Trigger que calcula el Pulse Score en el servidor |
| 032 | Trigger que acota el `UPDATE` de mensajes al flag de leído |
| 033 | Tabla + RPC de rate limiting de la IA |

- El historial de migraciones de Supabase iba por la **025** aunque los archivos llegaban a la
  **027**: las 026 y 027 se habían aplicado a mano, fuera de `db push`, y nunca se registraron. Se
  verificó que sí estaban en la base y se registraron las seis. **Aplicar siempre con
  `supabase db push`**, o registrar a mano en `supabase_migrations.schema_migrations`.

#### 🧪 Tests y CI
- **De 0 a 131 tests.** Cobertura sobre `pulseScore`, `aiRiskEngine`, `encuestaDetail`, `helpers` y
  `psicologa` — las funciones puras que sostienen el Pulse Score y la detección de riesgo.
  **Fueron estos tests los que destaparon la familia de bugs del jsonb**; no se buscaban.
- **CI** (`.github/workflows/ci.yml`): `lint → test → build`, más un guardarraíl que **falla el build
  si el roster de empleados vuelve al bundle**. Probado en las dos direcciones.
- El paso de lint queda **no bloqueante** a propósito: el repo arrastra 101 errores de lint
  anteriores a este trabajo (estos cambios no añaden ninguno). Conviene activarlo cuando esa deuda
  esté saldada.

#### 🧹 Dependencias
- **Fuera `firebase-admin` y el script de migración de Firestore**, que ya cumplió su función. Era el
  origen de las 6 vulnerabilidades `moderate` que reportaba `npm audit`. **Ahora: 0.**

### 2026-07-11 · Soporte TI para todos los roles, con estado del ticket

#### ✨ Añadido
- **Todos los roles pueden abrir un ticket de TI**, no solo los empleados. La pantalla de
  Soporte TI existía pero solo estaba enrutada en `EmpleadoLayout` y en el menú del rol
  `empleado`, así que admin, RH y psicóloga no tenían puerta de entrada. El proxy ya aceptaba
  a cualquier usuario autenticado: el cambio es de **acceso**, no de lógica.
  `SoporteTI` se mueve de `components/empleados/` a `components/common/` y se añade la ruta
  `soporte` + el ítem de menú en los layouts de admin, RH y psicóloga.
- **"Mis tickets": el estado del ticket, dentro de Pulse.** La integración era de un solo
  sentido (se mandaba el ticket y no había forma de saber en qué iba). Ahora la pantalla lista
  los tickets del propio usuario con su chip de estado (Abierto / En progreso / Resuelto /
  Cerrado), categoría, prioridad y fecha.
  `api/soporte-ticket.js` atiende `GET`: valida el JWT y pide a MCTIC los tickets del **correo
  del token**, así que nadie puede consultar los de otra persona.

#### 🎨 Corregido (estilos)
- **El formulario del ticket no usaba el sistema de diseño.** Los campos iban como `<label>`,
  `<select>`, `<input>` y `<textarea>` **pelados, sin clase**, así que el navegador los pintaba
  con su apariencia por defecto en ambos temas. Ahora usan `mc-form-label`, `mc-form-input`,
  `mc-form-select` y `mc-form-textarea`, que ya traen sus reglas de modo oscuro en
  `styles/dark/tables-forms.css` — **sin escribir CSS nuevo**.
- `mc-form-grid` es de una sola columna: categoría y prioridad pasan a `mc-form-row-2` para ir
  lado a lado (y colapsar en móvil). Se elimina `mc-form-group-full`, una clase que **no existe**
  en el proyecto y no hacía nada. Se añaden `id`/`htmlFor` para enfocar el campo al pulsar su etiqueta.
- Los chips de estado reusan las variantes de `mc-status-pill` ya existentes, que traen modo oscuro.

#### 🐛 Corregido (producción)
- **La función de tickets nunca había llegado a producción.** El commit que la creó vivía solo en
  el repo de **respaldo** (`origin`); el remoto que despliega es **`prod`**. Además, al proyecto de
  Vercel le faltaban `MCTIC_API_URL` y `MCTIC_INTEGRATION_KEY`, así que el proxy cortaba con 500
  antes de llamar a MCTIC. Con ambas cosas resueltas, el envío de tickets **funciona por primera
  vez** (verificado de punta a punta con una sesión real).

> Recordatorio: `git push origin main` **no despliega**. Producción sale del remoto `prod`.

### 2026-07-02 · sesión 2 (credenciales, sync en vivo, fondo neón, PWA)

#### 🔒 Credenciales
- **Contraseña temporal unificada a `emp123`** (revierte la decisión previa de conservar
  `CambiaEsteTemporal2026!`): reseteados vía service role los 98 usuarios pendientes de
  primer login; el código ya la usaba en edge functions y UI.
- **Blindaje de primer ingreso** (`AuthContext`): entrar con `emp123` siempre fuerza el
  panel "Cambia tu contraseña", aunque `debe_cambiar_password` esté apagado en BD.
- **Edge functions redesplegadas** (`admin-reset-password`, `admin-create-usuario`): las
  versiones desplegadas eran viejas y al restablecer ponían `CambiaEsteTemporal2026!` en
  vez de `emp123`. Verificado E2E contra Supabase.

#### ✨ Encuestas en tiempo real
- Los dashboards (admin/psicóloga) ahora reflejan encuestas nuevas **sin recargar**, en
  tres capas: suscripción Realtime (INSERT instantáneo), refetch al volver a la pestaña
  y polling suave de 60s como fallback (`subscribeEncuestas` + `GlobalContext`).
- **Migración `024`**: publica `encuestas` en `supabase_realtime` + índice único
  `(empleado_id, semana)` — el doble envío de la misma semana ya es imposible a nivel BD
  (la UI ya lo bloqueaba, pero una condición de carrera podía duplicar).

#### 🎨 Fondo animado dark/neón
- Nuevo `styles/dark/background.css`: base abisal `#071613`, orbes aurora aqua/cian con
  deriva lenta, grid blueprint tintado neón y barrido cónico en desktop. Solo
  `transform`/`opacity` (GPU-friendly) y respeta `prefers-reduced-motion`.
- **El tema oscuro es ahora el default** (antes seguía al sistema); el toggle y la
  preferencia guardada se respetan. De paso: `.app-main` no tenía override oscuro y en
  dark el fondo arrancaba en `#F7FBFA` — corregido.

#### 📱 PWA / móvil
- `styles/mobile-polish.css`: touch targets ≥44px, inputs a 16px (evita el auto-zoom de
  iOS), feedback `:active`, `overscroll-behavior: contain`, tipografía compacta.
- Bottom-sheet "Más" con overrides de modo oscuro (era blanco fijo) y el toggle de tema
  con estilo propio (ya no hereda el rojo de "Cerrar sesión").
- `theme-color` y manifest → `#071613` (estética oscura), `viewport-fit=cover` (notch).

#### 🐛 Corregido
- Badge "Semana" del Inicio del empleado invisible en modo claro (usaba el estilo glass
  del header premium oscuro sobre fondo claro de página); ahora pill de marca en claro y
  glass en oscuro.

### 2026-07-02

Auditoría de 4 ejes (código · arquitectura · seguridad · UI/accesibilidad) y corrección
de los hallazgos, excepto la contraseña temporal (se conserva por decisión de negocio).

#### 🔒 Seguridad
- **Escalación de privilegios `rh → admin` cerrada** (migración `023`): un trigger
  `BEFORE UPDATE` sobre `usuarios` impide que cualquier caller que no sea admin cambie
  `role` o `auth_user_id`, incluso llamando a Postgres directo (la policy sola no bastaba).
- **`api/gemini.js` ahora exige JWT de Supabase**: antes el endpoint estaba abierto
  (cualquiera podía quemar la cuota de Gemini y sobreescribir el system prompt). Además
  ignora el `system` enviado por el cliente y lo fija en el servidor.
- **`GestionUsuarios`** ya no llama a `supabase` directo: la creación de usuarios pasa por
  `usuariosService.crearUsuario()` (capa de servicios).

#### 🐛 Corregido
- **Selects de empleado rotos** (`ReconocimientosGestion`, `ExpedienteIntegral`): el `value`
  del `<select>` es string y el `id` number; con `===` estricto dejaban de funcionar tras el
  primer cambio. Ahora comparan con `String()`.
- **AI Engine**: las 5 llamadas a la IA no tenían `try/catch` → el spinner quedaba colgado
  para siempre si fallaba el fetch. Ahora hay `try/catch/finally` + toast de error.
- **Falso éxito** en encuesta y mensaje: se confirmaba "enviado" sin esperar el guardado.
  Ahora las acciones devuelven booleano y solo se confirma en éxito.
- **`GlobalContext`**: un error de red se veía idéntico a "sin datos". Ahora distingue el
  fallo (conserva estado previo + toast) de un resultado vacío real.
- **Login**: distingue error de conexión de credenciales inválidas.

#### ♿ Accesibilidad
- **42 labels** de formulario con `htmlFor` asociado a su control (antes sin asociación).
- **4 modales** con `role="dialog"`, `aria-modal` y `aria-labelledby`; `aria-label` en el
  botón de cerrar.
- `SectionTitle` pasa de `<h3>` a `<h2>` (no se salta el nivel de encabezado).

#### 🎨 Dark mode
- Colores de estado (`.mc-kpi-value`, RiskBar, semáforos de riesgo) migrados a tokens
  `--mc-stat-*` con rama clara/oscura vía `color-mix`, para que reaccionen al tema
  (antes eran hex inline, imposibles de sobreescribir por `[data-theme="dark"]`).

#### ⚡ Rendimiento / orden
- `useMemo` en el análisis de `AIEngine` (antes se recalculaba en cada tecla del chat).
- `AIEngine.jsx` de 923 → 743 líneas: motor de riesgo extraído a `utils/aiRiskEngine.js`
  y el render markdown a `components/common/MarkdownLite.jsx`.

### 2026-06-30

#### ✨ Añadido
- **Gateway de acceso pre-login** (`/`): pantalla de bienvenida glassmorphism antes del login.
- **AI Engine funcional con Gemini**: los tabs Resumen / Alertas / Predicciones generan
  texto real; **Copiloto** es un chat conversacional; análisis IA por expediente con
  scroll y resaltado a la tarjeta del colaborador.
- **Render Markdown** del texto de la IA (encabezados, listas, negrita/cursiva, código).
- **Filtro por semana** en los dashboards (admin y psicóloga) y en el AI Engine, con
  selector navegable a semanas pasadas (las pre-lanzamiento se agrupan en `2026-W00`).
- **Dashboard psicóloga**: distribución de semáforo, participación, tendencia por oficina
  (barras agrupadas) y **sucursales en riesgo** (con modal de colaboradores).
- **Dashboard admin**: widget **sucursales en riesgo** + modal; layout apilado a ancho completo.
- **Layout móvil**: barra inferior de navegación con tabs + hoja "Más" (sidebar oculto en ≤768px).
- **Filtros en Seguimiento** (nombre, puesto, sucursal, semáforo) como en Empleados.
- **`WeekSelect`**: desplegable propio (no nativo) para elegir semana, se renderiza en la
  página y funciona bien en móvil.

#### 🔁 Cambiado
- **Rediseño visual completo (glassmorphism)**: sistema de design tokens unificado
  (paleta teal + glow aqua), sidebar con gradiente de marca, tarjetas de cristal,
  login rediseñado.
- **Semana del sistema dinámica**: antes estaba fija en `2026-W01`; ahora es la semana
  ISO real y la encuesta **se reinicia cada lunes 00:00** (refresco en vivo sin recargar).
  Numeración relativa al lanzamiento (`2026-W01`, `W02`…).
- **Mensajes**: orden cronológico, badge de no leídos correcto, conserva la hora,
  auto-scroll al último, preview del último mensaje en la lista.
- Dashboards por semana: los KPIs (semáforo, foco rojo, casos) reflejan la semana seleccionada.

#### 🐛 Corregido
- **Tendencia del admin** estaba hardcodeada a `2025-W10..W14` (siempre vacía) → ahora usa datos reales.
- **Foco rojo** contaba filas de encuesta en vez de empleados.
- **Badge "N mensajes"** contaba todos los no leídos globales en vez de los dirigidos a la psicóloga.
- **"Leído"** de mensajes ahora **persiste en Firestore** (antes era solo local y reaparecía al recargar).
- Encuestas huérfanas (de empleados inexistentes) se filtran en la tendencia.
- Selector de semana ya no se desborda en vista móvil.

#### 🔒 Seguridad
- **IA migrada a proxy serverless** (`api/gemini.js`): la key de Gemini ya no se expone en el bundle.
- `geminiService.js` (código muerto que referenciaba la key en cliente) eliminado.
- `.env` y `.env.local` fuera del control de versiones.

#### 🔐 Migración a Supabase
La autenticación casera con contraseñas en texto plano se reemplazó por **Supabase Auth**
(hash nativo, sesiones JWT) y las reglas de acceso permisivas por **RLS granular por rol**
en Postgres. Detalle completo en `supabase/migrations/`.
