# Modelo de datos — McDental Pulse

Todo el esquema vive en `supabase/migrations/`, numerado secuencialmente
(`00000000000001` … `00000000000026`). La última migración aplicada al cierre de la
documentación es `26_candidatos_bolsa`. Las migraciones 15–17 concentran RLS y Storage.

## Enums de dominio (migración 02)

| Enum | Valores |
|---|---|
| `rol_usuario` | `admin`, `rh`, `psicologa`, `empleado` |
| `estado_solicitud` | `pendiente`, `aprobado`, `rechazado` |
| `estado_descuento` | `pendiente`, `activo`, `pagado`, `cancelado` |
| `estado_reporte` | `nuevo`, `revisado`, `cerrado` |
| `origen_solicitud` | `empleado`, `rh` |
| `tipo_pregunta` | `escala`, `sino`, `opcion`, `abierta` |

## Tablas principales

| Tabla | Migración | Propósito |
|---|---|---|
| `usuarios` | 04 | Perfil 1:1 con `auth.users`. Login, rol, sucursal, flags de password |
| `encuesta_preguntas` | 05 | Banco de preguntas del pulse (por `tipo_pregunta`) |
| `encuestas` | 06 | Respuestas semanales + `pulse_score` calculado |
| `mensajes` | 07 | Comunicación / mensajería |
| `notas_psicologicas` | 08 | Notas de seguimiento de la psicóloga |
| `vacaciones` | 09 | Solicitudes de vacaciones (`estado_solicitud`) |
| `permisos` | 10 | Permisos (`estado_solicitud`, `origen_solicitud`) |
| `descuentos` | 11 | Descuentos a empleados (`estado_descuento`) |
| `archivos_expediente` | 12 | Metadatos de archivos en Storage (bucket `expedientes`) |
| `reportes_confidenciales` | 13 | Reportes clínicos confidenciales (`estado_reporte`) |
| `reconocimientos` | 14 | Reconocimientos a empleados |
| `avatars` | 21 | Fotos de perfil (bucket público `avatars`) |
| `candidatos_bolsa` | 26 | Bolsa de trabajo / candidatos |

### `usuarios` (columnas clave)

```
id                    uuid PK
auth_user_id          uuid  → auth.users(id)  (unique, on delete cascade)
legacy_id             integer unique          -- id viejo de Firestore, solo migración
name, username, synthetic_email               -- username = login; synthetic_email == auth email
role                  rol_usuario default 'empleado'
sucursal, puesto, telefono, email, fecha_ingreso, fecha_cumpleanos, fecha_nacimiento
inactivo              boolean default false
debe_cambiar_password boolean default true    -- fuerza cambio en primer login
password_restablecido_en / _por
created_at, updated_at (trigger set_updated_at)
```

### `encuestas` (núcleo del Pulse Score)

```
id           uuid PK
empleado_id  uuid → usuarios(id) (on delete cascade)
semana       text                 -- clave de semana, ej. "2026-W27"
respuestas   jsonb                -- { "<legacy_id_pregunta>": valor }
pulse_score  numeric(5,2)         -- calculado (ver src/utils/pulseScore.js)
fecha        date default current_date
```

Índices por `empleado_id` y `fecha`. La migración 19 añade lógica de score/semáforo y la
24 habilita **Realtime** sobre `encuestas` (sync en vivo de respuestas).

## Row Level Security

- **Helpers RLS** (migración 15): funciones SQL para consultar el rol del usuario actual.
- **Políticas** (migración 16): casi todas las tablas tienen RLS activo; cada rol ve/edita
  solo lo que le corresponde.
- **Anti escalada** (migración 23): un usuario no puede modificar su propio `role`.

> Consecuencia práctica: el navegador usa la `anon key` pública sin riesgo, porque RLS
> aplica el filtrado por identidad en el servidor.

## Storage (migración 17 + 21/22/25)

| Bucket | Visibilidad | Límite | Uso |
|---|---|---|---|
| `expedientes` | privado | 10 MB | Archivos de expediente; políticas por rol (admin/rh/psicologa) |
| `avatars` | público | 2 MB | Fotos de perfil; insert/update/delete restringido; *self-service* en migración 25 |

## Edge Functions (`supabase/functions/`)

Operaciones privilegiadas que **no** pueden hacerse desde el cliente con la anon key
(requieren `service_role`), aisladas en funciones:

- `admin-create-usuario` — alta de usuario (crea `auth.users` + perfil).
- `admin-reset-password` — restablecer contraseña de un usuario.
- `admin-update-username` — cambiar el `username` (y el email sintético asociado).
- `_shared` — utilidades comunes entre funciones.

## Migración histórica

El proyecto vino de **Firebase/Firestore** y se migró **por completo** a Supabase. La
columna `legacy_id` y el script `scripts/migrate-firestore-to-supabase.mjs` son residuos
de esa migración. No quedan dependencias funcionales de Firebase (`firebase-admin` sigue
en devDependencies solo para el script de migración).
