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
| `fondo` | `#EEF5F4` | `#0A2420` | Fondo de página |
| `superficie` | `#FFFFFF` | `#0F332C` | Tarjetas, modales |
| `superficie-2` | `#F6FAFA` | `#0D2B26` | Cabeceras de tabla, zonas hundidas |
| `superficie-input` | `#FFFFFF` | `#0A2420` | Campos de formulario |
| `borde` | `#DCEAE7` | `rgba(255,255,255,.12)` | Bordes y separadores |
| `texto` | `#123430` | `#E6F2F0` | Texto principal |
| `texto-2` | `#5B7C78` | `#9DBDB6` | Labels, subtítulos |
| `titulo` | `#0A3B36` | `#8AE9DD` | Títulos de página y modal |

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
| `rounded-mc` / `-mc-lg` / `-mc-xl` | `16px` / `20px` / `28px` |
| `shadow-mc` / `-mc-suave` / `-mc-card` | Elevación suave, teal (ver `index.css`) |
| `font-sans` | **Fira Sans** |
| `font-mono` | **Fira Code** |

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
