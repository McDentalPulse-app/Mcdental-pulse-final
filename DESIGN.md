# DESIGN.md — Sistema visual de McDental Pulse

> **Fuente de verdad del aspecto.** `CLAUDE.md` manda en código y operación; **este archivo manda
> en color, tipografía, espaciado y componentes**. Si cambias algo visual, actualiza esto en el
> mismo PR.

## Regla número uno

**Ningún color hex fuera de `src/index.css`.**

Ni en JSX, ni en `style={{}}`, ni en archivos `.js`. Un color en JavaScript **no puede tener modo
oscuro**: un `style={{ color: "#22c55e" }}` gana por especificidad y ninguna regla CSS lo alcanza.

Ese fue exactamente el motivo de que el modo oscuro estuviera roto: había **139 colores hex** en el
proyecto, **50 de ellos en JS/JSX**, y **tres paletas distintas** para el mismo semáforo
(`index.css` decía que el verde era `#059669`, `pulseScore.js` que `#22c55e` y `config/theme.js`
que `#2F7D5A`).

Si necesitas un color: **usa un token**. Si no existe, **créalo aquí**.

## Cómo funciona el tema

`ThemeContext` pone `data-theme="light" | "dark"` en `<html>`. Los tokens **semánticos** cambian de
valor según ese atributo, así que:

```jsx
<div className="bg-superficie text-texto">   {/* funciona en claro Y en oscuro */}
```

**No hace falta escribir `dark:` casi nunca.** Si te encuentras poniendo `dark:` en todas partes,
es señal de que falta un token semántico. `dark:` es para excepciones, no para la norma.

## Color de marca personalizable por usuario

El color de marca (el teal) **ya no es fijo**: cada usuario elige el suyo — presets o color
propio — y se guarda en su fila (`usuarios.color_acento`, migración `...070`). El tema (claro/
oscuro) y el color son **ortogonales**: `data-theme` decide claro/oscuro, el color solo rota el
tono de la familia de marca.

- **Cómo:** `AccentContext` toma una semilla hex y `src/utils/accentPalette.js` genera toda la
  familia de marca por **rotación de tono** (conserva S y L de cada tono → la curva y el contraste
  AA se mantienen). El resultado se aplica como variables inline sobre `<html>`.
- **Selector:** `src/components/settings/SelectorColor.jsx`, dentro de **Mi perfil** (universal a
  los 4 roles; Config es solo admin/rh/psicóloga).
- **Canales RGB:** los ~156 `rgba()` de glow/aurora/borde del CSS **ya no llevan el teal a pelo**;
  apuntan a `--mc-aqua-rgb`, `--mc-verde-rgb`, `--mc-verde-oscuro-rgb`, `--mc-brand600-rgb`,
  `--mc-brand300-rgb`, `--mc-brand200-rgb` (formato `R G B`, usados como `rgba(var(--x) / α)`).
  Por eso el color cambia **de verdad** en todo (login, fondo, aurora), no solo en los botones.

> **Regresión cero por defecto:** con la semilla teal (`#0E8C7A`) `generarPaleta` reproduce
> EXACTAMENTE los valores de `index.css` (sin drift). La app sin elección se ve igual que siempre.

> ⛔ **`--mc-verde-claro` y `--mc-marca-texto` no sirven como superficie ni como color de texto
> (2026-08-01).** `accentPalette.js` las escribe como **estilo inline sobre `<html>`**, y un
> inline gana a cualquier hoja de estilos: las versiones oscuras que `[data-theme=dark]` sí
> define **nunca se aplican**. `--mc-verde-claro` es además color crudo de la paleta —un pastel
> para fondo claro— así que en oscuro deja un parche casi blanco, y `--mc-marca-texto` se queda
> en un azul oscuro sobre caja oscura (medido: contraste **1.46:1**). Ningún componente puede
> corregirlo desde su propio CSS.
>
> | En lugar de | Usa | Por qué |
> |---|---|---|
> | `--mc-verde-claro` como fondo | `--mc-brand-suave` | Semántico: en claro es ese mismo pastel, en oscuro un tinte del acento sobre el fondo |
> | `--mc-marca-texto` sobre fondo de marca | `--mc-icono-accion` | Existe justo para que el color de marca llegue a los iconos en oscuro (1.46:1 → **4.23:1**) |
>
> La causa de fondo sigue abierta: mientras `accentPalette` fije esas dos en línea, el tema
> oscuro no puede corregirlas en ningún sitio.

## Tokens

### Primitivos — la marca. No cambian con el tema.

| Token | Valor | Uso |
|---|---|---|
| `brand-950` … `brand-200` | `#06201D` → `#8AE9DD` | Escala de marca (gradientes, glass) |
| `brand-500` | `#0E8C7A` | Acción primaria |
| `aqua` | `#14C8B6` | Acento / glow |

### Semánticos — **sí** cambian con el tema

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `fondo` | `#F8F9FB` | `#0A2420` | Fondo de página (neutro, estilo Untitled UI) |
| `superficie` | `#FFFFFF` | `#0F332C` | Tarjetas, modales |
| `superficie-2` | `#F6FAFA` | `#0D2B26` | Cabeceras de tabla, zonas hundidas |
| `superficie-input` | `#FFFFFF` | `#0A2420` | Campos de formulario |
| `borde` | `#EAECF0` | `rgba(255,255,255,.12)` | Bordes y separadores (neutro gray-200) |
| `texto` | `#101828` | `#E6F2F0` | Texto principal (gray-900 casi-negro) |
| `texto-2` | `#475467` | `#9DBDB6` | Labels, subtítulos (gray-600 neutro) |
| `titulo` | `#101828` | `#8AE9DD` | Títulos de página y modal (casi-negro en claro) |

> **Neutro por defecto, marca como acento (2026-07, estilo Untitled UI).** En claro las superficies,
> textos y bordes son **neutros** (grises), no teal-tintados. El teal (`--mc-verde`/`--mc-aqua`)
> queda solo en **acentos**: botones, barras, checkboxes, estados activos, hover. Así el look es
> limpio como Untitled UI sin perder la marca. `accentPalette.js` solo reescribe la familia de
> marca — nunca estos neutros.

> **`texto` y `superficie` eran los que faltaban.** No se redefinían en oscuro, así que el texto
> seguía siendo verde oscuro y las tarjetas seguían siendo blancas. Los 7 archivos de
> `src/styles/dark/` intentaban tapar eso pantalla por pantalla — de ahí los huecos.

### Semáforo — un solo origen de verdad

| Token | Claro | Oscuro |
|---|---|---|
| `verde` / `amarillo` / `rojo` | `#059669` / `#D97706` / `#DC2626` | `#86EFAC` / `#FCD34D` / `#FCA5A5` |
| `verde-bg` + `verde-fg` | `#DCFCE7` + `#166534` | `#14532D` + `#86EFAC` |
| `amarillo-bg` + `amarillo-fg` | `#FEF3C7` + `#92400E` | `#78350F` + `#FCD34D` |
| `rojo-bg` + `rojo-fg` | `#FEE2E2` + `#991B1B` | `#7F1D1D` + `#FCA5A5` |

**El semáforo se pinta por `nivel`, no por color.** `getPulseStatus()` devuelve
`nivel: "verde" | "amarillo" | "rojo" | "sin-datos"` — el componente pasa eso a la clase, y el
color lo decide el CSS, que sí conoce el tema.

### Forma y tipografía

| Token | Valor |
|---|---|
| `rounded-mc` / `-mc-lg` / `-mc-xl` | `12px` / `16px` / `20px` (refinados estilo Untitled UI) |
| `shadow-mc` / `-mc-suave` / `-mc-card` | Elevación **sutil** estilo Untitled UI, teal (ver `index.css`) |
| `font-sans` | **Inter** (estilo Untitled UI) |
| `font-mono` | **Fira Code** |

### Controles de formulario — un solo origen (2026-08-04)

Campo de texto, desplegable, fecha, hora y área de texto **salen todos de estos cuatro tokens**.
Si estás escribiendo `border-radius` o `border` en una regla que estiliza un `input` o un
`select`, casi seguro te has equivocado: referencia el token.

| Token | Valor | Nota |
|---|---|---|
| `--mc-control-radio` | `8px` | El mismo de los botones |
| `--mc-control-borde` | `var(--mc-gris-suave)` | El `borde` neutro de la tabla de arriba |
| `--mc-control-fondo` | `var(--mc-superficie-input)` | El que esta guía ya declaraba para «Campos de formulario» |
| `--mc-control-letra` | `14px` | |

Foco: borde `--mc-aqua` + anillo `0 0 0 3px rgba(aqua / .12)`.

> **Por qué existen.** Había **ocho** definiciones distintas de «caja de control» repartidas por
> `App.css`: radios de 8, 9, 10 y 12px, tres variables de borde y cuatro de fondo. Varias
> llevaban un comentario que decía *«mismo estilo que la app»* mientras usaban valores propios —
> el comentario describía la intención, no el resultado. Y `--mc-card-borde` vale lo **mismo**
> que `--mc-gris-suave` en claro pero **distinto** en oscuro, así que parte de la diferencia solo
> se veía con el tema oscuro puesto. Un token que hay que acordarse de copiar no dura.

**Excepciones legítimas**, que no son campos y por eso no siguen esto: `.week-select-trigger`
(pastilla de 999px, es un disparador, no un campo), `.week-select-menu` (superficie flotante) y
`.mc-file-input-wrap` (zona de soltar archivos, borde discontinuo).

### Capas: todo lo que flota va en un portal (2026-08-04)

**Cualquier cosa que se despliegue sobre el contenido —modal, desplegable, calendario, visor de
imagen, menú— se renderiza con `createPortal` a `document.body`.** No es una preferencia: dentro
del árbol la recorta el primer ancestro con `overflow: hidden`, y `App.css` tiene **81 reglas que
recortan**, empezando por `.mc-card`. Su posición se calcula en coordenadas de pantalla
(`position: fixed`) a partir del `getBoundingClientRect()` del disparador.

| Capa | `z-index` | Qué vive ahí |
|---|---|---|
| **Popovers** | **`10100`** | `.mc-select-menu`, `.mc-daterange-pop` — **por encima de TODO** |
| Overlays altos | `9999`–`10010` | Editor y detalle de encuesta, detalle de psicología |
| Bloqueo de notificaciones | `5000` | Modal obligatorio de activación |
| Avisos y diálogos | `1050`–`1200` | Confirmar/preguntar, toasts, detalle de sucursal |
| Modales | `1000` | `.mc-modal-overlay` |
| Barra flotante del teléfono | `200` | `.mobile-tabbar` |
| Cabecera y sus menús | `60`–`120` | `.topnav-menu`, `.week-select-menu` |

**Un popover va por encima de todos los modales, no entre medias.** Primero se puso en `250`
—por encima de la barra del teléfono y por debajo del modal— y eso **rompió cambiar de sucursal
a un empleado**: ese formulario vive dentro de un modal, así que la lista se abría detrás de él.
Medido con `elementFromPoint`: el menú no era clicable. El `<select>` nativo no tenía ese
problema porque su lista la dibuja el sistema operativo, por encima de la página entera; al
sustituirlo hay que reproducir esa garantía a mano.

Y no basta con superar `1000`: hay overlays hasta `10010` y ahí dentro también hay desplegables.
Estar por encima de todo no tapa nada que importe — un popover solo existe mientras su
disparador es alcanzable.

> El banco de pruebas (`npm run verificar`) lo comprueba **contra el overlay más alto que exista
> en el CSS**, no contra un número escrito a mano: si mañana aparece uno más alto, la
> comprobación sigue valiendo.

Además: **el alto disponible descuenta la barra** (se mide con `querySelector(".mobile-tabbar")`,
no se supone), el popover **voltea hacia arriba** si no cabe debajo, y su ancho máximo es lo que
queda hasta el borde derecho para que no se salga.

> **Esto pasó cuatro veces en una semana** antes de escribirse aquí: el detalle de sucursal del
> dashboard (atrapado además por un `transform` de la animación de entrada), las imágenes del
> chat, el desplegable nuevo y el calendario. Siempre el mismo síntoma —algo que sale a medias o
> descolocado— y siempre la misma causa. Si estás escribiendo un popover y no ves un
> `createPortal`, es el quinto.

### Paleta categórica de eventos del calendario

Colores de **identidad de categoría** (como los colores de evento de Google Calendar):
**fijos a propósito**, iguales en claro y oscuro. Viven en `index.css` (no en `App.css`) para
respetar la regla nº1.

| Token | Uso |
|---|---|
| `--mc-evento-azul/-morado/-rosa/-ambar/-verde/-aqua/-rojo/-gris` | Color de cada evento (chips, bloques, punto). También el punto de presencia "en línea" (`-verde`) |
| `--mc-cal-acento` / `-fuerte` | Morado del calendario de agenda: día de hoy, botón +, línea de "ahora" |
| `--mc-perfil-cover` | Degradado decorativo de la portada del hero de **Mi perfil** |

## Estilos inline: cuándo sí y cuándo no

| | |
|---|---|
| ❌ **Nunca** | Color, fondo, borde, sombra → **rompen el modo oscuro** |
| ✅ **Vale** | Layout dinámico calculado (`width: ${pct}%` en una barra de progreso) |

## Checador y asistencia (2026-07)

Clases en `App.css`, bloque final. **Cero hex**: todos los colores salen de tokens, así que el
modo oscuro funciona solo, sin un archivo de overrides.

| Clase | Qué es |
|---|---|
| `.checador-camara` · `.checador-camara-video` | Marco 3:4 de la cámara en vivo. El vídeo va **espejado** (`scaleX(-1)`) porque la gente espera verse como en un espejo — pero la **foto que se sube no lo va**, que es lo que importa para reconocer a alguien |
| `.checador-boton--entrada` / `--salida` | El botón grande. Verde para entrar, ámbar para salir (`--mc-semaforo-*`) |
| `.checador-pill--ok/--alerta/--aviso` | El resultado de la ubicación, con los tokens de badge |
| `.asistencia-filtros` · `.asistencia-tabla-wrap` | Filtros del panel; la tabla ancha hace scroll **dentro de su caja**, no del cuerpo de la página |
| `.asistencia-dia--falta/--retardo/--presente/…` | Color del estado del día. `--descanso` solo baja la opacidad: un día sin turno no es un error |
| `.horarios-rejilla` · `.horarios-celda--descanso` | Rejilla empleado × día. La celda vacía se atenúa, **no se marca en rojo** |
| `.mc-empty` · `.mc-hint` | Dos utilidades que faltaban en el sistema (texto de "no hay nada" y de ayuda) |
| `.rostro-cotejo` · `.rostro-cotejo-col` · `.rostro-cotejo-label` | Revisión de rostros (`admin/rostros`): foto de perfil vs fotos registradas, lado a lado y grandes, para cotejar identidad de un vistazo. Fondo `superficie-sutil` |
| `.asistencia-revision` | Lista "Todos los empleados" de rostros: filas avatar + datos + pill dentro de la Card (antes era un `<ul>` con viñetas sin estilar) |
| `.campana` · `.campana-boton` · `.campana-badge` · `.campana-panel` · `.campana-item` | Campana de notificaciones global: botón fijo arriba a la derecha (`z-index: 300`) con badge de no-leídos (`rojo-apagado`) y dropdown con la bandeja. Se monta una vez en `App.jsx` para los 4 roles. Cero hex |

## Estado de la migración a Tailwind

Tailwind **v4**, configuración CSS-first (`@theme` en `src/index.css`), sin `tailwind.config.js`.

**El preflight (el reset de Tailwind) está desactivado a propósito** mientras quede CSS antiguo:
`App.css` asume los defaults del navegador y el reset le cambiaría el aspecto a toda la app. Se
activa al terminar:

```css
@import "tailwindcss/preflight.css" layer(base);
```

| Fase | Estado |
|---|---|
| 0 · Tailwind + tokens + este documento | ✅ |
| 1 · Sacar los colores de JavaScript | ⏳ |
| 2 · Shell (`AppLayout`, `Sidebar`) + componentes `mc-*` + `/styleguide` | ⏳ |
| 3 · `AdminDashboard` (la pantalla más difícil) → **punto de decisión** | ⏳ |
| 4+ · Resto de pantallas, borrando `App.css` y `src/styles/dark/` | ⏳ |

## Cuando esté terminado

```bash
grep -rE "#[0-9a-fA-F]{6}" src --include=*.jsx --include=*.js   # -> 0
grep -rE "style=\{\{[^}]*(color|background)" src                 # -> 0
```

Y `src/App.css` y `src/styles/dark/` habrán desaparecido.
