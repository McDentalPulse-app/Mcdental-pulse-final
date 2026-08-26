# Pulse — Sistema de diseño UI (base: Untitled UI React)

> Documento de referencia para Claude Code. Cualquier componente o pantalla nueva debe
> cumplir estas reglas. Si algo no está aquí, se copia el patrón de un componente
> equivalente de Untitled UI, no se inventa.

> **Alcance (importante).** Este documento rige el **Pulse nuevo, el que se vende**. No es un
> plan para modificar el Pulse de McDental, que se queda como está. Donde se lea «migrar»,
> entiéndase «construir». Ver `auditoria-pulse-producto.md` para la decisión de forkear.
>
> **Relación con `DESIGN.md`:** `DESIGN.md` sigue siendo la fuente de verdad visual del Pulse
> **actual** (McDental). Este archivo lo es del producto nuevo. Son dos productos y dos
> documentos; no se sincronizan entre sí.
>
> **Revisado contra el código el 2026-08-08.** Las correcciones de esa revisión están marcadas
> en el texto donde aplica.

---

## 0. Stack objetivo

| Capa | Tecnología | Estado |
|---|---|---|
| Framework | React 19 | Probado en el Pulse actual (`19.2.6`) |
| Build | Vite | Probado (`8.0.12`) |
| Estilos | Tailwind CSS v4 (config vía `@theme` en CSS, **no** `tailwind.config.js`) | Instalado en el Pulse actual pero **casi sin usar** — solo 3% de los `className` |
| Iconos | `@untitledui/icons` | Probado (`0.0.22`) |
| Gráficas | Recharts | Probado (`3.10.1`) |
| Componentes | Untitled UI React (React Aria + Tailwind) | ⬜ llega con el scaffold (§ 1) |
| Accesibilidad | `react-aria-components` | ⬜ **instalar aparte** — no viene con el init |
| Lenguaje | JavaScript + JSX, con `.tsx` permitido para componentes nuevos | ⚠️ ver § 0.1 |
| Backend | Supabase / PostgreSQL con RLS, desplegado en Docker sobre VPS | — |
| Multi-tenant | Una instancia por cliente al inicio; esquema con `empresa_id` desde la primera migración | — |

Regla dura: **cero CSS suelto para layout, color o tipografía**. Todo sale de utilidades
Tailwind que apuntan a tokens. CSS propio solo para animaciones o casos que Tailwind no cubra.

> **Dimensión de esa regla:** el Pulse actual tiene **15,569 líneas de CSS** en 7 archivos, y
> el 97% de sus `className` apuntan ahí, no a utilidades de Tailwind. Todo ese volumen **no se
> porta**: la interfaz del producto nuevo se escribe con utilidades sobre los tokens de Untitled
> UI. No es una limpieza, es reescribir la capa visual — y tiene que estar en el plan con ese
> tamaño.

### 0.1 TypeScript: decisión y límite

El código actual tiene **255 archivos `.js`/`.jsx` y cero TypeScript**. Los componentes de
Untitled UI llegan en `.tsx`.

**Decisión bajo el plazo de 3 meses:** adopción parcial, no migración.

- Los componentes nuevos de UI pueden ser `.tsx` — llegan así del kit y Vite los compila sin
  configuración extra junto a los `.jsx`.
- **El código rescatado del Pulse actual se queda en `.jsx`.** No se tipa «de paso».
- No se activa `strict`, no se pone `tsc` como bloqueante del build.

Migrar los 255 archivos a TypeScript es buena idea para un producto que se vende, pero es un
proyecto aparte: consume semanas y **baja el aprovechamiento del 48%** que estimó la auditoría,
porque el código rescatado dejaría de copiarse tal cual. Se agenda después de la primera venta.

---

## 1. Fase 0 — Preparación (antes de tocar UI)

> **Nota de la revisión del 2026-08-08.** Una versión anterior de esta sección decía que no se
> corriera el scaffold, por miedo a pisar la configuración de Tailwind del Pulse actual. La
> medición lo desmiente: de **2,087 `className` en el JSX, solo 65 (3%)** usan utilidades de
> Tailwind. El 97% del estilo son clases CSS a mano (`avisopush-head`, `mc-form-label`) sobre
> 15,569 líneas de CSS. **No hay base de Tailwind que proteger**, y el producto nuevo arranca
> de un proyecto limpio. El scaffold es el camino correcto.

1. Proyecto **Vite nuevo y vacío**. El Pulse actual no es la base: de él se portan archivos de
   lógica, no la estructura (§ 1.1).
2. Ejecutar el scaffold de Untitled UI:
   ```bash
   npx untitledui@latest init --vite
   ```
   Durante el init pregunta el **brand color**. Ver § 3.
3. Verificar que existan y estén importados:
   - `styles/theme.css` → bloque `@theme` con todos los tokens
   - `styles/globals.css` → importa Tailwind, `theme.css`, los plugins y define
     `@custom-variant dark (&:where(.dark-mode, .dark-mode *))`
4. Instalar `react-aria-components` (no viene con el init) y verificar `tailwind-merge`.
5. Crear `utils/cx.ts` (wrapper de `tailwind-merge` con los `text-display-*` extendidos)
   y `utils/is-react-component.ts`. Untitled UI los usa en todos sus componentes.
6. Cargar **Inter** como fuente variable y exponerla en `--font-inter`.
7. A partir de aquí, componentes uno por uno:
   ```bash
   npx untitledui@latest add [component]
   ```

### 1.1 Qué se trae del Pulse actual

Solo **lógica, sin estilos**. Estos archivos no tienen una línea de CSS y se portan tal cual:

- `utils/asistencia.js` — emparejado de checadas, retardos, día natural, zonas horarias
- `utils/rostro.js`, `api/_rostro.js`, `api/_pose.js` — reconocimiento y anti-spoofing
- `utils/geo.js` — geocercas
- Los servicios de datos, **reescribiendo la capa de consulta** (el modelo `fetchAll` de traer
  tablas completas no se porta; ver la auditoría § 2.3)

**No se trae:** ni un archivo `.css`, ni un `className` del Pulse viejo, ni la conmutación de
tema por `[data-theme="dark"]` (el producto nuevo usa `.dark-mode`, la de Untitled UI).
Importar CSS viejo «para ir rápido» es cómo se termina con dos sistemas visuales en la misma
pantalla.

---

## 2. Tipografía

Una sola familia: **Inter** (`--font-body` y `--font-display`). Mono: `--font-mono`.

Dos escalas — no mezclarlas:

**Escala UI** (todo lo que es interfaz): `text-xs` (12px) · `text-sm` (14px) ·
`text-md` (16px) · `text-lg` (18px) · `text-xl` (20px)

**Escala Display** (títulos de página, hero, landing, números grandes):
`text-display-xs` (24px) · `sm` (30px) · `md` (36px) · `lg` (48px) · `xl` (60px) ·
`2xl` (72px). De `md` hacia arriba llevan letter-spacing negativo ya incluido en el token.

Pesos: 400 cuerpo, 500 labels y botones, 600 títulos y celdas destacadas de tabla.
**700 casi nunca.** El peso semibold es el techo del sistema.

Convenciones rápidas:
- Título de página → `text-display-xs font-semibold text-primary`
- Subtítulo / descripción → `text-md text-tertiary`
- Label de campo → `text-sm font-medium text-secondary`
- Texto de ayuda / hint → `text-sm text-tertiary`
- Header de tabla → `text-xs font-semibold text-quaternary`

---

## 3. Color

**Nunca escribas un hex ni un `bg-purple-600` en un componente.** Solo tokens semánticos.
Así el modo oscuro y el rebranding funcionan gratis.

Tokens principales (se remapean automáticamente bajo `.dark-mode`):

| Rol | Tokens |
|---|---|
| Fondos | `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-quaternary`, `bg-primary_hover`, `bg-active`, `bg-overlay` |
| Fondos de marca | `bg-brand-primary`, `bg-brand-secondary`, `bg-brand-solid`, `bg-brand-solid_hover` |
| Texto | `text-primary`, `text-secondary`, `text-tertiary`, `text-quaternary`, `text-placeholder`, `text-white` |
| Bordes | `border-primary`, `border-secondary`, `border-tertiary`, `border-brand`, `border-error` |
| Iconos (foreground) | `fg-primary`, `fg-secondary`, `fg-tertiary`, `fg-quaternary`, `fg-brand-primary` |
| Semánticos | `*-error-*`, `*-warning-*`, `*-success-*` en las mismas variantes |
| Badges y gráficas | `utility-{color}-{50..700}` (blue, green, red, orange, indigo, pink, purple…) |

### Color de marca

Untitled UI trae por defecto una escala violeta (`brand-600 = rgb(127 86 217)`).
Requisitos de la escala propia: `brand-600` es el color de botón primario y debe dar contraste
≥ 4.5:1 con blanco; `brand-500` es el focus ring.

> **Corregido 2026-08-08 — no está pendiente, ya existe.** El Pulse actual tiene una escala de
> marca teal completa en `src/index.css`, de `--color-brand-200` a `--color-brand-950`, con
> `--color-brand-600: #107463` y un acento `--color-aqua: #14C8B6`.
>
> Lo que hay que decidir no es «cuál es la escala» sino **si el producto nuevo hereda el teal de
> McDental o estrena identidad propia**. Argumento para estrenarla: el teal es el color de un
> cliente, y el producto se vende a otros. Argumento para heredarla: está validada, funciona en
> ambos temas y es gratis.
>
> Faltan los peldaños `brand-50` y `brand-100`, que Untitled UI sí usa (fondos suaves de badges
> y estados hover). Hay que generarlos con la función del § 9, no a ojo.

---

## 4. Forma, espacio y elevación

- **Radios**: `rounded-md` (6px) en inputs y badges pequeños, `rounded-lg` (8px) en botones
  e inputs grandes, `rounded-xl`/`rounded-2xl` (12/16px) en cards y modales,
  `rounded-full` en avatares, pills y toggles.
- **Espaciado**: múltiplos de 4. Gaps internos de card 16/24, padding de card 20/24,
  separación entre secciones 24/32.
- **Contenedor**: `max-w-container` (1280px).
- **Sombras**: `shadow-xs` es el default de casi todo (botones, cards, inputs).
  `shadow-lg` para dropdowns y popovers, `shadow-xl` para modales.
  Los botones sólidos usan además `shadow-xs-skeuomorphic` (el borde interior sutil
  que le da el acabado característico de Untitled UI).
- **Bordes**: 1px, siempre `border-secondary` salvo que el estado pida otra cosa.
- **Focus**: anillo de 2px con `ring-brand` + offset 2px. Nunca quitar el outline.

---

## 5. Cambio de dirección visual respecto al Pulse actual

El Pulse actual tira a *dark glassmorphism*. Untitled UI es lo contrario: superficies planas,
opacas, luminosas, jerarquía por borde de 1px y sombra mínima.

**No se lleva al producto nuevo:**
- `backdrop-filter: blur()` y fondos semitransparentes en cards, sidebar y modales
- Gradientes decorativos y bordes con gradiente
- Glows, sombras de color, `box-shadow` saturados

**Se conserva:** el soporte light/dark, que ya funciona. Cambia el mecanismo: de
`[data-theme="dark"]` a la clase `.dark-mode` de Untitled UI, que remapea los ~200 tokens.
Ver la advertencia del § 1.3 — hay que elegir uno y no mezclarlos.

> **Medido el 2026-08-08:** el glass es más chico de lo que sugiere el párrafo de arriba —
> **13 usos de `backdrop-filter` y 43 gradientes** en todo el código. Quitarlo es media tarde.
> Lo caro de verdad son las **15,569 líneas de CSS** que hay que reemplazar por utilidades
> (§ 0). Al planear, el número que importa es ese, no el glass.

Como es producto nuevo, no hay «estado intermedio» que negociar: cada pantalla nace con este
sistema. La regla que sí aplica es no importar CSS del Pulse viejo «para ir rápido» — el
lenguaje visual entra completo o no entra.

---

## 6. Mapa de componentes por pantalla

Antes de escribir cualquier componente, buscar el equivalente en
`untitledui.com/react/components` e instalarlo con
`npx untitledui@latest add [component]`. Solo se escribe código propio cuando no existe.

### Si el componente es PRO

Untitled UI libera gratis los componentes base; los avanzados y los *page examples*
son de pago. Cuando la pantalla necesite uno PRO, **se construye a mano**, no se compra
ni se busca una copia por ahí.

Reglas para construirlo:

1. **No copiar el código PRO.** Ni de la demo, ni del DOM inspeccionado, ni de un repo
   que lo haya republicado. Se implementa desde cero.
2. **Sí replicar el lenguaje visual**, que es lo que buscamos: los mismos tokens, los
   mismos radios, el mismo `shadow-xs`, la misma jerarquía tipográfica. El componente
   propio tiene que ser indistinguible en estilo de los que sí vinieron del kit.
3. **La accesibilidad no se improvisa.** Usar React Aria directamente
   (`react-aria-components` — **hay que instalarlo, no es dependencia todavía**;
   corregido 2026-08-08): `useComboBox`, `Table`, `DatePicker`, etc. traen teclado, foco y
   ARIA resueltos. Escribir el comportamiento a mano es donde se rompen estas cosas.
4. **Apoyarse en librerías headless** donde tenga sentido: Recharts para gráficas
   (es lo que usa el propio kit), `cmdk` para command menu, `sonner` para toasts.
   Se les aplica nuestro theming encima.
5. Cada componente hecho a mano vive en `components/custom/` con un comentario arriba
   diciendo qué equivalente PRO reemplaza, para poder cambiarlo si algún día se compra
   la licencia.

Los que con más probabilidad habrá que construir: tablas con selección y ordenamiento,
date range picker, command menu (⌘K), file uploader con drag & drop, y las gráficas
del dashboard.

| Zona de Pulse | Componentes Untitled UI |
|---|---|
| Shell / navegación | `sidebar-navigation`, `application-header-navigation`, `breadcrumbs`, `avatar`, `dropdown` |
| Dashboard | `metrics`, `line-bar-charts`, `pie-charts`, `progress-circles`, `activity-feed`, `card-header` |
| Listados (empleados, turnos, etc.) | `table`, `filters`, `pagination`, `badge`, `avatar`, `empty-state` |
| Formularios | `input`, `select`, `multi-select`, `checkbox`, `radio-group`, `toggle`, `date-picker`, `file-uploader`, `slider` |
| Feedback | `alert`, `notification` (toast), `modal`, `slideout-menu`, `tooltip`, `loading-indicator` |
| Navegación interna | `horizontal-tabs`, `vertical-tabs`, `progress-steps`, `section-header`, `page-header` |
| Auth | `log-in-header`, `sign-up-header`, `forgot-password-header` |
| Landing / ventas | `header-navigation`, `header-section`, `features-section`, `pricing-section`, `testimonial-section`, `faq-section`, `cta-section`, `footer` |
| **Checador y rostro** | **Ninguno. Ver § 6.1** |

### 6.1 El checador: la pantalla que Untitled UI no cubre

*(Añadido 2026-08-08 — faltaba por completo en el mapa.)*

La pantalla más usada del producto y la que contiene el activo más valioso (~1,500 líneas de
`opencv-js` + `mediapipe` para reconocimiento y anti-spoofing) **no tiene equivalente en ningún
kit de UI**: es cámara en vivo, canvas, overlays de guía, estados de calibración y geocerca.

Por eso necesita tratamiento aparte:

- **Vive en `components/checador/`**, no en `components/custom/`. No reemplaza un componente PRO;
  es dominio propio.
- **Del sistema toma solo lo de afuera**: tokens de color, tipografía, radios, sombras, botones,
  badges de estado y toasts. El área de cámara es un lienzo, no un componente Tailwind.
- **Es la única pantalla donde se permite CSS propio** más allá de animaciones: el encuadre de
  la cámara, las guías de rostro y las transiciones de estado no se expresan bien con utilidades.
  El permiso es para el lienzo, no para el resto de la pantalla.
- **Estados que sí son del sistema** y hay que resolver con componentes estándar: sin permiso de
  cámara, fuera de geocerca, rostro no aprobado, módulo en gracia, sin conexión. Son los que más
  soporte generan y los que más se olvidan.
- **Se porta del Pulse actual, no se rediseña.** La lógica de captura está calibrada con caras
  reales; lo que cambia es el envoltorio visual. Tocar la calibración por motivos estéticos es
  la forma más cara de romper el producto.

Presupuestar esta pantalla aparte del resto de la UI. No entra en «una tabla genérica bien hecha».

### Jerarquía de botones
Un solo botón `primary` (`bg-brand-solid`) por vista o por modal. Todo lo demás:
`secondary` (borde + `bg-primary`), `tertiary` (solo texto), `link-color`.
Acciones destructivas: variante `destructive` en el mismo nivel jerárquico.

---

## 7. Orden de construcción sugerido

1. **Fundaciones** — Tailwind v4, `theme.css`, Inter, `cx.ts`, `.dark-mode` funcionando
   con un toggle. Verificable con una página de prueba que muestre la escala de tipos
   y los tokens de color en ambos modos.
2. **Shell** — sidebar + header + breadcrumbs. Define el marco de todo lo demás.
3. **Primitivos** — botones, inputs, selects, badges, avatares, modales, toasts.
   Se construyen todos juntos, antes de la primera pantalla real.
4. **Checador** (§ 6.1) — se adelanta a propósito. Es la pantalla más usada, la más
   arriesgada y la que no depende de tablas ni gráficas. Si algo va a salir mal, que salga
   mal en la semana 4 y no en la 11.
5. **Pantallas por rol** — una por una, empezando por la más usada de cada rol.
   Cada pantalla se cierra en light y dark antes de pasar a la siguiente.
6. **Tablas y gráficas** — suelen ser lo más caro; hacerlas cuando los primitivos ya
   estén estables.
7. **Landing y pricing** — se hace con los `marketing` sections de Untitled UI y la escala
   display. Ver § 12: bajo el plazo actual esto se pospone.
8. **Pasada de consistencia** — buscar hex hardcodeados, `font-bold`, radios inventados
   y CSS importado del Pulse viejo.

> Los roles ya no son cuatro fijos: el producto nuevo define roles por cliente (ver la
> auditoría, § 5.2). «Pantallas por rol» significa **por conjunto de permisos**, no por los
> cuatro roles de McDental.

---

## 8. Definition of done (por pantalla)

- [ ] Cero hex, cero `rgb()`, cero colores de la paleta base de Tailwind (`purple-600`…)
- [ ] Cero `style={{}}` para color, tipografía o espaciado
- [ ] Light y dark revisados
- [ ] Responsive hasta 320px (`breakpoint-xxs`)
- [ ] Focus visible con teclado en todo control interactivo
- [ ] Estados vacío, carga y error resueltos (no una pantalla en blanco)
- [ ] Iconos solo de `@untitledui/icons`, tamaño 16/20/24, color vía `fg-*`

---

## 9. Theming por cliente (white-label)

Cada cliente puede tener su propio color de marca sin tocar un solo componente.
Esto solo funciona si la regla de "cero hex en componentes" se respeta al 100%.

### Cadena de indirección

```
bg-brand-solid → var(--color-bg-brand-solid) → var(--color-brand-600) → hex
```

Los componentes solo conocen el primer eslabón. Sobreescribiendo `--color-brand-600`
en runtime cambia el producto entero: botones, focus rings, links, badges, gráficas,
estado activo del sidebar.

> **Crítico:** mantener el bloque como `@theme`. Si se cambia a `@theme inline`,
> Tailwind v4 resuelve los valores en compilación y el theming en runtime deja de existir.

### Generar la rampa desde un solo color

El cliente da un hex, no once. La escala `brand-50 … brand-950` se deriva **una vez al
guardar** y se persiste en Postgres — no se recalcula en cada render.

> **Corrección de seguridad (2026-08-08). Son dos tablas, no una.**
>
> | Tabla | Contenido | Quién escribe |
> |---|---|---|
> | `empresa_branding` | Color de marca, logo, vocabulario (§ 10) | **Admin del cliente** |
> | `empresa_modulos` | Qué módulos pagó, vigencias, límites | **Solo Admin+ (proveedor)** |
>
> La tentación de juntarlas en una sola «configuración de empresa» es fuerte y es un agujero:
> si el admin del cliente puede escribir la fila que también guarda sus módulos contratados,
> **puede encenderse lo que no pagó**. El branding es suyo; la licencia no.
>
> Regla de RLS: sobre `empresa_modulos` el cliente tiene `SELECT` y nada más. El `UPDATE` es
> exclusivo del plano proveedor. Ver `auditoria-pulse-producto.md` § 5.

```ts
import { formatHex, oklch, converter } from 'culori';

const toOklch = converter('oklch');
const STEPS = {
  50: 0.97, 100: 0.94, 200: 0.89, 300: 0.82, 400: 0.72,
  500: 0.64, 600: 0.56, 700: 0.48, 800: 0.40, 900: 0.33, 950: 0.25,
};

export function buildBrandScale(baseHex: string) {
  const base = toOklch(baseHex);
  return Object.fromEntries(
    Object.entries(STEPS).map(([step, l]) => [
      step,
      formatHex(oklch({
        l,
        c: base.c * (l > 0.9 || l < 0.3 ? 0.35 : 1),
        h: base.h,
      })),
    ])
  );
}
```

Persistir el resultado hace el theming auditable: si un cliente reclama que su color se
ve raro, se revisa el documento, no un algoritmo en producción.

### Inyección sin flash

Las variables se escriben en el `<head>` **antes del primer paint**, nunca en un
`useEffect` — si no, la app carga con el color por defecto y salta al del cliente.

```html
<style id="tenant-theme">
  :root {
    --color-brand-50:  #f6f4ff;
    /* … */
    --color-brand-600: #5b46d9;
    --color-brand-950: #1c1240;
  }
</style>
```

Con una instancia por cliente (el modelo de arranque), la paleta se resuelve del lado del
servidor y se escribe en el HTML servido — no hace falta resolver tenant por subdominio.
Cuando llegue el modelo compartido de varios clientes por instancia, se resuelve el tenant
en un script bloqueante mínimo antes del bundle de React. La estructura de tokens no cambia
entre los dos escenarios; solo cambia de dónde sale el hex.

### Guardas obligatorias

**Contraste.** `brand-600` es el fondo del botón primario con texto blanco encima.
Al guardar, calcular luminancia: si no llega a 4.5:1 contra blanco, oscurecer
`brand-600` o cambiar `--color-text-primary_on-brand` a `--color-neutral-900`.
Untitled UI tiene ese token separado justo para este caso.

**Solo la marca es configurable.** Neutrales, error, warning y success quedan fijos.
Dejar al cliente pintar los grises o el rojo de error rompe el producto y convierte
el soporte en problema nuestro.

**Presets primero.** Ofrecer 6–8 paletas curadas y validadas, más un campo "custom"
con validación de contraste. La mayoría elige preset y eso cubre la mayor parte
de los casos raros.

---

## 10. Vocabulario configurable

Cada cliente nombra las cosas a su manera: lo que McDental llama **sucursal**, otro cliente
lo llama planta, tienda, plantel o sede. Lo mismo con empleado / colaborador / trabajador.

Regla: **cero texto de dominio literal en los componentes.** Todo término que nombre una
entidad del negocio sale de una capa de terminología, no de un string en el JSX.

```tsx
// mal
<h1>Sucursales</h1>
<Button>Agregar empleado</Button>

// bien
<h1>{t.sucursal.plural}</h1>
<Button>Agregar {t.empleado.singular.toLowerCase()}</Button>
```

Cada término necesita al menos: singular, plural y género gramatical — el género es
obligatorio en español, porque "la sucursal" y "el plantel" cambian artículos y adjetivos
en cualquier frase que los use. Sin eso terminas con "Nueva plantel".

Los valores por defecto viven en el producto; el cliente los sobreescribe en su
configuración. Aplica también a mensajes de error, estados vacíos y textos de confirmación,
que es donde más se cuela el vocabulario duro.

Esto no es i18n. Es una capa aparte, más chica, y no sustituye traducir el producto
a otro idioma si algún día hace falta.

---

## 11. Navegación y estados de módulo

Los módulos son paquetes de permisos, no interruptores de menú. Consecuencia directa
para la UI: **el sidebar, las tabs y las acciones se construyen desde los permisos
efectivos del usuario**, nunca desde una lista de rutas en el código.

```tsx
// mal
{user.rol === 'rh' && <NavItem to="/comisiones" />}

// bien
{puede('ver_comisiones') && <NavItem to="/comisiones" />}
```

Un módulo apagado no deja hueco, ni ítem gris, ni "actualiza tu plan" dentro del producto:
simplemente no existe para ese cliente. La venta se hace fuera de la aplicación.

### Estados que sí necesitan tratamiento visual

| Estado | Qué ve el usuario |
|---|---|
| Módulo activo | Normal |
| Módulo en gracia (vencido, solo lectura) | Banner persistente arriba del módulo (`alert` variante warning), controles de escritura deshabilitados, botón de exportar visible |
| Límite del plan alcanzado (empleados, sucursales, almacenamiento) | El botón de crear queda deshabilitado con tooltip que dice el límite, no un error después de enviar el formulario |
| Módulo nunca contratado | Invisible. No aparece en navegación ni en búsquedas |

El estado de gracia es el que más se olvida y el que más soporte genera. Definir su
componente una vez y reusarlo en los siete módulos.

---

## 12. Alcance realista: los 3 meses

**El plazo de 3 meses lo puso el jefe de proyecto. Es firme.** Esta sección estaba escrita
como si abaratar la UI lo resolviera. No lo resuelve, y conviene que el número esté a la vista
antes de arrancar (revisado 2026-08-08).

### 12.1 La aritmética

3 meses ≈ **13 semanas**. La auditoría estimó **31–43 semanas-persona** para el producto
completo, y la UI es alrededor de un cuarto de eso.

| Equipo | Capacidad en 13 semanas | ¿Cabe en 31–43? |
|---|---|---|
| 2 personas | 26 semanas-persona | **No.** Faltan 5–17, y regalar la UI entera no las cubre |
| 3 personas | 39 semanas-persona | **Sí**, en la parte alta del rango |
| 4 personas | 52 semanas-persona | Sí, con holgura |

La conclusión incómoda: **con dos personas, el plazo no se salva recortando diseño.** Solo se
salva recortando **cuántos módulos salen en la primera venta.**

### 12.2 Las dos formas de que 3 meses funcionen

**Opción A — tres personas, producto completo.** Se cumple el alcance de la auditoría. Es la
opción a proponer si hay presupuesto.

**Opción B — dos personas, primera venta acotada.** Sale: núcleo (empleados, asistencia,
horarios, sucursales, vacaciones y permisos, avisos) + **checador** + **dos o tres módulos**,
elegidos por lo que pida el primer cliente. El resto del catálogo se construye después,
vendiendo. Los cimientos (§ 0.1, permisos como datos, licencias en base de datos, paginación)
**no se recortan en ninguna de las dos opciones** — recortarlos es lo que obliga a reescribir.

Esta decisión es del jefe de proyecto, no del equipo de diseño, y hay que tomarla **antes** de
la semana 1: cambia qué se construye primero.

### 12.3 Decisiones de UI que ahorran tiempo en cualquiera de las dos opciones

**Se hace:**
- Fundaciones completas (tokens, tipografía, dark mode). No es opcional: es lo que evita la
  segunda reescritura. Con el scaffold de Untitled UI (§ 1) esto es cuestión de días, no de
  semanas — pero **no es un descuento al plazo**: lo que sí cuesta es reescribir la capa visual
  entera, porque del Pulse actual no se porta ni una línea de CSS.
- Solo componentes gratuitos de Untitled UI. Si una pantalla necesita un PRO, primero se busca
  rediseñarla con lo que hay.
- Una sola tabla genérica, bien hecha, con paginación de servidor, reusada en todos los
  listados. No una tabla por pantalla.
- Vocabulario y navegación por permisos desde el inicio — son baratos ahora, caros después.
- El checador se porta, no se rediseña (§ 6.1).

**Se pospone sin culpa:**
- Paletas por cliente en la interfaz de Admin+. Con una instancia por cliente basta con cambiar
  el hex a mano en el despliegue. La estructura ya está; falta solo la pantalla.
- Landing y páginas de marketing. Se vende con demo y presentación, no con sitio web, hasta
  después del primer cliente.
- Gráficas elaboradas. Recharts con la paleta `utility-*` y punto.
- Command menu (⌘K), date range picker propio, uploader con drag & drop. Todos son PRO, todos
  tienen alternativa simple.
- La migración a TypeScript (§ 0.1).

**Lo que no se recorta nunca:** foco visible con teclado, responsive hasta 320px, y los estados
de vacío/carga/error. Recortar eso no ahorra tiempo, lo mueve a soporte.

---

## 13. Nota de licencia

Los componentes base de Untitled UI React son gratuitos y usables en proyectos
comerciales; los componentes y page examples PRO requieren licencia de pago
(PRO SOLO para un solo desarrollador). La licencia **prohíbe** usar Untitled UI para
construir un producto competidor (un UI kit, librería o template). Vender Pulse como
SaaS no cae ahí, pero conviene leer el License Agreement antes de publicar.

Sobre los componentes que construimos a mano (§6): replicar un lenguaje visual —
espaciados, radios, jerarquía tipográfica — no es lo mismo que copiar código, y es lo
que hacemos. Lo que no se hace es tomar el código PRO de ninguna fuente. Si en algún
momento se compra la licencia PRO, los componentes de `components/custom/` se pueden
sustituir uno por uno sin tocar las pantallas.
