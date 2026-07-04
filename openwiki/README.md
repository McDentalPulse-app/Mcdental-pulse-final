# McDental Pulse — Documentación

> Plataforma interna de **bienestar organizacional** para McDental. Encuestas semanales
> (Pulse Score), expedientes, RH (permisos/descuentos/reconocimientos), reportes
> confidenciales clínicos y un motor de IA. PWA en español con cuatro roles.

Esta carpeta es la documentación de referencia del repositorio, pensada para que
personas y agentes de código encuentren contexto rápido.

## Índice

| Documento | Contenido |
|---|---|
| [arquitectura.md](./arquitectura.md) | Visión general, flujo de datos, autenticación, roles y layouts |
| [modelo-de-datos.md](./modelo-de-datos.md) | Tablas Postgres, enums, RLS, Storage, migraciones, Edge Functions |
| [estructura-codigo.md](./estructura-codigo.md) | Mapa carpeta a carpeta: services, components, contexts, utils |
| [ia-y-despliegue.md](./ia-y-despliegue.md) | Proxy de Gemini, variables de entorno, scripts, build y deploy |

## Resumen ejecutivo

- **Qué es:** app web PWA de bienestar para una clínica dental. Los empleados responden
  una encuesta semanal; el sistema calcula un **Pulse Score** y alimenta dashboards,
  seguimiento psicológico y gestión de RH.
- **Roles:** `admin`, `rh`, `psicologa`, `empleado`. Cada rol tiene su propio *layout* y
  su rama de rutas (`/admin/*`, `/rh/*`, `/psicologa/*`, `/empleado/*`).
- **Stack:** React 19 + Vite 8 + React Router 7 (PWA) · Supabase (Postgres + Auth +
  Storage, con Row Level Security) · Google Gemini (`gemini-2.5-flash`) vía proxy
  serverless. Despliegue en Vercel.
- **Seguridad:** la protección de datos la da **RLS en Postgres**, no el cliente. La key
  de Gemini vive **solo en el servidor** (`api/gemini.js`), nunca en el bundle.

## Arranque rápido

```bash
npm install
npm run dev      # Vite. Para probar /api/gemini en local: `vercel dev`
npm run build    # build de producción (genera iconos PWA en prebuild)
npm run lint
```

Variables en `.env.local` (copiar de `.env.example`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (cliente) y `GEMINI_API_KEY` (servidor).

## Documentos vivos del repo

Además de esta carpeta, el repositorio mantiene:
- `README.md` — resumen + changelog por sesión.
- `contexto.md` — bitácora de estado del proyecto (decisiones, migración Firebase→Supabase).
