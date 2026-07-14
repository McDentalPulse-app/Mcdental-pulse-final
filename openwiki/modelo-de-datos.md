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
| `sucursales` | 34 | Catálogo de clínicas con geocerca (`lat`/`lng`/`radio_m`) |
| `horarios` | 35 | Turno por empleado y día ISO. **Sin fila = descanso** |
| `asistencias` | 36 | Checadas de entrada/salida con foto y ubicación |

### Asistencia (checador, migraciones 34-38)

La regla que sostiene el módulo: **la hora y la distancia las decide el servidor, nunca el
navegador.** Si el cliente pudiera mandar `marcada_en`, bastaría con atrasar el reloj del
teléfono para llegar puntual todos los días.

Por eso `asistencias` **no tiene policy de INSERT para el rol empleado**. Su único camino de
escritura es la RPC `registrar_checada()` (`security definer`), que toma la hora de `now()`,
calcula la distancia a la clínica con haversine en SQL (`distancia_metros()`, sin extensiones
nuevas: solo está `pgcrypto`), serializa con `pg_advisory_xact_lock` y rechaza una checada
repetida del mismo tipo en 90 s. RH sí puede insertar (altas manuales) y actualizar (anular).

Lo que **no** se guarda: si el día fue falta, retardo o justificado. Eso es **derivado** de
checadas + horario + permisos aprobados, y se calcula en `src/utils/asistencia.js`. Así, cuando
RH aprueba el jueves un permiso para el lunes pasado, ese lunes deja de ser falta **solo**, sin
reescribir filas viejas.

- `ubicacion_estado`: `dentro` · `fuera` · `sin_gps` · `sin_geocerca`. Los tres últimos **no
  bloquean la checada**: se registra igual y RH la ve señalada. Un empleado que no puede fichar
  a las 8am porque el GPS no engancha es un problema peor que el que la geocerca resuelve.
- `fecha` se calcula en `America/Monterrey`, no en UTC: una salida a las 19:00 caería en el día
  siguiente en UTC y el reporte diario saldría corrido.
- **Limitación conocida**: los turnos que cruzan la medianoche no están soportados (la salida
  caería en un día natural sin entrada, y la RPC la rechaza). Se asume horario diurno.
- **Grants explícitos**: estas migraciones conceden `select/insert/update` a `authenticated` a
  mano. Los privilegios por defecto de Supabase solo cubren las tablas creadas por
  `supabase_admin`, y las migraciones corren como `postgres`. Sin el grant, la tabla da
  "permission denied" y RLS ni se evalúa. *(Las tablas 04-26 no lo hacen — ver "Deuda conocida".)*

### Comprobación de identidad (migraciones 39-40)

**Lo que el sistema NO hace: verificar que la cara de la foto es la de esa persona.** La
selfie es *evidencia*, no *verificación*. Conviene decirlo en voz alta, porque es fácil
creer lo contrario.

Lo que sí hay, en tres capas, ninguna de las cuales pretende ser infalible:

| Capa | Qué ataca | Dónde vive | ¿Bloquea? |
|---|---|---|---|
| **Hay una cara en la foto** | Checar con una foto del techo, del bolsillo o del cielo | Navegador (MediaPipe, `src/utils/rostro.js`) | **Sí** — es la única que bloquea, porque tiene un arreglo trivial: ponte frente a la cámara |
| **Ventana de salida** (mig. 39) | Fichar entrada y salida seguidas y simular una jornada | RPC | Sí |
| **Dispositivo** (mig. 40) | La contraseña compartida: un compañero checa por ti | RPC + derivado | No, marca |
| **Cotejo facial** (mig. 41) | Que la cara de la foto no sea la de esa persona | Servidor (`api/verificar-rostro.js`) | No, marca |

De la capa de dispositivo salen **dos señales de calidad muy distinta**:

- `asistencias.dispositivo_nuevo` — este empleado nunca había usado este teléfono.
  **Ruidosa**: la gente cambia de móvil y borra datos del navegador. Solo marca.
- **Un mismo teléfono checando a dos empleados el mismo día.** Esta es la buena: es la
  firma exacta de la suplantación y no tiene explicación inocente frecuente. **No se
  guarda**: se deriva al leer (`detectarDispositivosCompartidos`), porque cuando llega la
  segunda checada la primera ya está escrita y marcarla obligaría a reescribirla.

La tabla `dispositivos` **no tiene policy de INSERT**: solo la escribe la RPC. Si el
cliente pudiera insertar, se daría de alta su propio teléfono antes de checar y la señal
valdría cero. Verificado: el intento devuelve *"new row violates row-level security policy"*.

> **Límite honesto**: el id del dispositivo lo genera el navegador, así que se puede
> borrar o falsear — pero hacerlo sale marcado como dispositivo desconocido, que es justo
> la señal buscada. Esto no es una barrera, es un detector.

### Cotejo facial (migración 41)

Dos modelos de **OpenCV Zoo, Apache-2.0** (la licencia fue el criterio: casi todos los
modelos punteros de este campo —InsightFace y derivados— son *solo para investigación* y
no se pueden usar en una empresa): **YuNet** detecta la cara y sus 5 puntos, **SFace** la
convierte en 128 números. Viven en `api/models/` (38 MB) y corren en la función serverless.

**Corre en el servidor, y eso es la feature entera.** Si el navegador calculara el
parecido, cualquiera mandaría un 99% desde la consola. El cliente solo sube una foto; el
servidor la baja del bucket privado, la coteja y escribe el resultado con la *service role*.
Ni `rostros` ni `asistencias.match_score` tienen policy de escritura para el cliente.

**Hay que ALINEAR la cara, no basta con recortarla.** Medido con retratos reales: metiendo
la foto entera al modelo, la misma persona daba **0.198** de parecido y dos personas
distintas **0.44** — invertido, peor que aleatorio. Con la cara detectada, rotada y
escalada a la plantilla canónica: misma persona **0.675**, distintas **0.18-0.24**. El
umbral (0.363, el que publica OpenCV) **no está ajustado con la plantilla real**: hacerlo
es parte de poner esto en producción.

**El enrolado lo hace RH, en persona.** Es la regla que sostiene todo: si el empleado
pudiera enrolarse solo, el compañero que le robó la contraseña enrolaría *su propia cara*
en la cuenta ajena y a partir de ahí checaría por él con un 99% de parecido — verificado y
bendecido por el sistema. Verificado contra Postgres: ni siquiera RH puede insertar en
`rostros` desde el navegador.

**`consentimiento_en` es NOT NULL.** Sin consentimiento no hay fila, y sin fila no hay
cotejo. Una cara cotejada es dato personal **sensible**, no un archivo más.

**Tres estados, no dos**: `rostro_verificado` es `true` (coincide), `false` (NO coincide —
lo más grave que dice el sistema) o `null` (no se pudo comprobar: sin enrolar, sin foto, sin
cara reconocible). Confundir `false` con `null` convertiría "no lo sabemos" en "es un
fraude".

> **Lo que sigue sin cubrirse**: la *foto de una foto* (enseñarle a la cámara la cara de un
> compañero en otra pantalla). Detectar eso —*liveness*— es un problema serio que no se
> resuelve con código propio.

### `permisos` (ampliado en la migración 38)

`causa` (catálogo cerrado: enfermedad · cita_medica · asunto_personal · luto · tramite_oficial ·
otro) y `fecha_fin` (rango; `null` = un solo día). Sin `fecha_fin`, una incapacidad de tres días
solo justificaría el primero y los otros dos saldrían como faltas.

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
| `asistencias` | privado | 1 MB | Selfies del checador (migración 37). Path `<usuario_id>/<timestamp>.jpg`; inmutables (sin update/delete); se leen con signed URL de 5 min |

> `asistencias` es **privado** a propósito: la cara de alguien, con hora y coordenada al lado,
> no puede colgar de una URL pública permanente. Sigue el modelo de `expedientes`, no el de
> `avatars`.

## Deuda conocida: las migraciones no son autocontenidas (grants)

Descubierto al levantar una instancia local desde cero (julio 2026). **Las migraciones 04-26 no
conceden ningún privilegio a `authenticated`.** En producción la app funciona porque los grants
llegaron por otra vía (la configuración inicial del proyecto en Supabase Cloud), pero no están
en el repo.

Consecuencia: **si la base se reconstruye desde las migraciones** (recuperación ante desastre,
un entorno de staging, un `supabase db reset` en local), toda la app responde *"permission denied
for table …"* y RLS ni siquiera llega a evaluarse. Los privilegios por defecto de Supabase solo
cubren las tablas creadas por el rol `supabase_admin`; las migraciones corren como `postgres`,
cuyo default es solo `Dxtm` (truncate/references/trigger), sin `select` ni `insert`.

Las migraciones 34-38 sí traen sus grants explícitos. Arreglar las viejas es una migración de
una línea por tabla (`grant select, insert, update on public.<tabla> to authenticated;`) — no se
ha hecho aquí para no mezclarlo con el checador, pero conviene hacerlo pronto: hoy la única copia
funcional del esquema de permisos vive en el proyecto de producción, no en el repositorio.

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
