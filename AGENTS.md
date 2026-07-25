# AGENTS.md

## Documentación del repositorio

Antes de buscar contexto o modificar código, consulta la documentación en **`openwiki/`**.
Es la referencia de arquitectura, modelo de datos y estructura de este proyecto:

- [`openwiki/README.md`](./openwiki/README.md) — resumen ejecutivo y arranque rápido
- [`openwiki/arquitectura.md`](./openwiki/arquitectura.md) — enrutado por rol, auth, contextos, tema
- [`openwiki/modelo-de-datos.md`](./openwiki/modelo-de-datos.md) — tablas Postgres, enums, RLS, Storage, migraciones
- [`openwiki/estructura-codigo.md`](./openwiki/estructura-codigo.md) — mapa de `src/`: services, components, contexts, utils
- [`openwiki/ia-y-despliegue.md`](./openwiki/ia-y-despliegue.md) — proxy de Gemini, variables de entorno, build y deploy

Si tu cambio altera la arquitectura, el esquema de datos o la estructura del código,
**actualiza también el documento correspondiente en `openwiki/`** en el mismo cambio.

> Documentación generada como snapshot manual (no se auto-actualiza). Si el repo tiene una
> key de inferencia configurada, puede refrescarse con `openwiki --update`.
