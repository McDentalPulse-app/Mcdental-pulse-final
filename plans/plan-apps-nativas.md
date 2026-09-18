# Plan — Pulse nativo: Android (Kotlin) y Windows (Compose), con offline

**STATUS: BORRADOR** — pendiente de aprobación. No escribir código hasta que diga APROBADO.
**Fecha:** 2026-09-17
**Origen:** pedido del dueño — «una versión de Pulse para escritorio actualizable (Windows) y una
versión nativa para Android (actualizable), para poder seguir teniendo acceso al sistema aunque no
tengamos internet, y más que nada para hacer un programa mejor hecho y más manejable, porque hoy
día está enorme, y así podemos hacerlo con componentes reutilizables desde el comienzo».

**Grado:** XL. Es un reemplazo de cliente completo sobre un backend que mueve nómina, asistencia y
datos bancarios. Spec aprobada antes de código, y revisión independiente por fase.

---

## 0. Las dos decisiones que ordenan todo el plan

**No es una app, son dos.** Medido sobre `navItems.js`: RH tiene 35 pantallas, psicóloga 34,
admin 26 — pero empleado 20 y doctor 19, y de esas usan cinco al día (fichar, encuesta, mensajes,
historial o comisiones). Hoy viven en el mismo binario porque la web lo permite. En nativo no
tienen por qué.

| Destino | Para quién | Qué lleva |
|---|---|---|
| **Android** | empleado, doctor | Fichar, encuesta, permisos, vacaciones, mensajes, avisos, comisiones |
| **Windows** | RH, psicóloga, admin | Nómina, reportes, expedientes, gestión, inventario, organigrama, encuestas |

Consecuencia práctica: **Windows no necesita reconocimiento facial**. Nadie ficha desde un PC de
escritorio. Eso saca del escritorio la pieza más difícil de portar, y reduce el alcance real del
proyecto mucho más que cualquier decisión de stack.

**El backend NO se reescribe.** Supabase, las 159 migraciones, las RLS, los triggers, las edge
functions y `api/` se quedan enteros. Son años de reglas de negocio, varias validadas a fondo esta
misma semana. Un rewrite del cliente no es un rewrite de la base, y confundir las dos cosas es el
mayor riesgo de este proyecto. Lo único que la base recibe son **columnas nuevas** para el fichaje
offline (§5.3).

---

## 1. Decisiones del dueño (2026-09-17)

| # | Pregunta | Respuesta |
|---|---|---|
| D1 | ¿Envolver lo que hay o reescribir? | **Reescribir desde cero**, bien hecho |
| D2 | ¿Qué significa «sin internet»? | **Consultar lo ya cargado, y además poder fichar** |
| D3 | ¿Play Store? | **Se omite.** APK propio y canal de actualización propio |
| D4 | Android | **Kotlin nativo** |
| D5 | Windows | Kotlin Multiplatform + Compose (propuesto, §3) |
| D6 | Fichaje offline | **Se acepta, y queda marcado para RH** si la hora no cuadra |
| D7 | Linux | **Solo la máquina de desarrollo del dueño.** No es canal de distribución |
| D8 | Entrada con biometría | **Sí, pero solo Clase 3** (huella y facial 3D). Cara Clase 2 **no** — ver §5.4 |

---

## 2. Objetivo y no-objetivos

**Objetivo.** Dos clientes nativos, actualizables solos, sobre el backend actual: uno de empleado
en Android y uno de gestión en Windows. Que la clínica siga operando cuando se cae internet:
consultar lo ya descargado y poder fichar.

**No-objetivos**, explícitos para que nadie los dé por incluidos:

- No se toca el esquema salvo lo del §5.3.
- No se migra a otro proveedor de base ni de autenticación.
- **La PWA sigue viva y mantenida** durante toda la transición. No se apaga lo que usan 100
  personas hasta que haya con qué sustituirlo.
- No se persigue paridad de pantallas: cada app lleva lo que su gente usa, no las 135 entradas.
- No entra la Play Store (D3) ni macOS ni un canal de Linux (D7).

---

## 3. Stack

**Kotlin Multiplatform + Compose Multiplatform**, un solo proyecto con dos destinos.

| Capa | Elección | Por qué |
|---|---|---|
| Lenguaje y UI | Kotlin + Compose Multiplatform | Un idioma para los dos destinos (D4 fija Kotlin) |
| Módulo compartido | KMP: modelos, repositorios, reglas, motor de sync | **El offline se escribe UNA vez** |
| Backend | `supabase-kt` | Postgrest, Auth, Realtime y Storage, multiplataforma |
| Base local | **SQLDelight** | SQL tipado; SQLite real en Android y en JVM |
| Asincronía | Coroutines + Flow | |
| Inyección | Koin | |
| Excel (horarios) | Apache POI, solo en Windows | Mejor que el `exceljs` del navegador; es función de admin |
| Cara (Android) | **ML Kit** de Google | Nativo; sustituye a MediaPipe web. El emparejado sigue en el servidor |

**Lo que se descarta y por qué:** .NET con WinUI 3 daría un Windows más nativo, pero son dos
lenguajes y cero reutilización para un equipo de una persona — y **no corre en Linux**, donde el
dueño desarrolla (D7). Flutter obligaría a tirar Kotlin, que ya está decidido en D4.

**Lo que cuesta esta elección, dicho sin adornos:**

1. El instalador de Windows pesará 60-90 MB: arrastra el runtime de JVM.
2. **Hay dos huecos reales frente a la web.** El editor de texto enriquecido de los avisos (hoy
   TipTap) no tiene equivalente maduro en Compose: o se simplifica a Markdown o se construye. Y
   las gráficas del Pulse Score son más pobres que Recharts (`koalaplot` o Canvas a mano).
3. Compose en escritorio no se ve «Windows nativo». Se parece a sí mismo.

---

## 4. Actualización automática (requisito explícito)

| Destino | Instalador | Canal |
|---|---|---|
| Android | APK firmado en el propio servidor | La app consulta un manifiesto de versión y ofrece instalar. Sin Play Store (D3) |
| Windows | MSIX vía `jpackage` | **App Installer de Windows** apuntando a una URL de la VPS: es el mecanismo propio del sistema, sin herramientas de pago |

**Firma de código:** sin firmar, SmartScreen asusta al usuario en Windows y Android bloquea la
instalación. Como son máquinas que la empresa controla, un certificado propio instalado una vez
por PC resuelve el caso de Windows, y para Android basta firmar el APK con una llave propia
**cuya pérdida impide actualizar a todos los dispositivos** — hay que guardarla como se guarda un
secreto de producción, no en el portátil.

---

## 5. El motor offline, que es el corazón del proyecto

### 5.1 La simplificación que lo hace viable

**El empleado casi solo INSERTA y la gestión casi solo ACTUALIZA.** Un empleado ficha, contesta
una encuesta, pide un permiso, manda un mensaje: todo son filas nuevas. Quien edita filas
existentes es RH, y RH trabaja desde la oficina, con cable.

Eso significa que el caso difícil de la sincronización —dos personas editando la misma fila— **casi
no existe en este dominio**. No se construye un motor de resolución de conflictos genérico. Se
construye una cola de inserciones con reintento, que es mucho menos código y mucho menos sitio
donde equivocarse.

### 5.2 Forma

- **Lectura:** la interfaz lee SIEMPRE de SQLite, nunca de la red. La red solo rellena SQLite. Así
  la app se comporta igual con y sin señal, y no hay dos caminos de lectura que mantener.
- **Escritura:** va a una tabla `outbox` local y se aplica de forma optimista en SQLite. Un worker
  drena la `outbox` cuando hay señal.
- **Qué se replica:** solo lo que la app necesita ver sin red — perfil propio, directorio,
  horarios, avisos, sus propias checadas, permisos y vacaciones. **Nunca** datos bancarios ni
  expedientes ni notas psicológicas: un teléfono perdido no puede llevar eso dentro.
- **Realtime** sigue siendo la vía rápida cuando hay señal, pero nunca la única: si se pierde un
  evento, la próxima sincronización lo recupera.

### 5.3 El fichaje offline es un problema de CONFIANZA, no de guardado

Hoy la hora la pone el servidor. Offline, la hora la **afirma** el dispositivo, y la hora de un
teléfono se cambia en dos toques. Esto alimenta la nómina.

Decisión del dueño (D6): **se acepta el fichaje y queda marcado para RH.** El diseño:

- El dispositivo manda: la hora que afirma, **el tiempo transcurrido desde su última conversación
  con el servidor** (que no depende del reloj y es mucho más difícil de falsear), y la ubicación.
- El servidor guarda las dos horas —la afirmada y la de recepción— y calcula el desfase.
- Si el desfase no se explica por una ventana offline plausible, la checada entra **marcada**, no
  rechazada. Nadie se queda sin fichar; nadie cobra una hora inventada sin que se vea.
- RH ve la marca en su panel y decide.

**Esto exige una migración nueva** sobre `asistencias`: `origen_offline`, `hora_dispositivo`,
`desfase_segundos` y el motivo de la marca. Es lo único que el backend recibe, y va con su propia
revisión adversarial por tocar asistencia.

**La geocerca se mantiene y se evalúa en el servidor al recibir**, con la ubicación que el
dispositivo grabó en su momento. No se confía en que el dispositivo diga «yo estaba dentro».

### 5.4 Entrada con biometría (D8)

**Pulse no registra ni guarda la huella de nadie.** Android no deja a ninguna app leer datos
biométricos: la persona da de alta su huella en los ajustes del teléfono y la app solo pregunta
«¿eres tú?» y recibe un sí o un no. Para una empresa que maneja nómina y datos bancarios eso es
un alivio legal, no una limitación, y conviene poder decirlo en voz alta.

**Solo biometría Clase 3, y no es una preferencia estética.** Medido sobre el dispositivo de
pruebas (`dumpsys biometric`, Samsung SM-S928B):

```
modality 2 (huella)  strength 15   -> BIOMETRIC_STRONG  (Clase 3)
modality 8 (cara)    strength 255  -> BIOMETRIC_WEAK    (Clase 2)
```

Un biométrico Clase 2 **no puede desbloquear una llave del Keystore**: Android no lo permite con
`CryptoObject`. Con cara solo cabría una puerta blanda —la app pregunta y se fía de la respuesta—
sin que el credencial quede atado a nada. **En una app de fichaje eso es justo el agujero que el
sistema existe para cerrar**: el facial de Samsung es 2D y una foto lo engaña, así que valdría
para fichar por un compañero. El facial 3D de otros equipos sí es Clase 3 y entra sin problema:
la regla es la CLASE, no la parte del cuerpo.

**Qué se guarda.** Nunca la contraseña. Se entra una vez con usuario y contraseña, y el *token de
sesión* queda cifrado con una llave del Keystore que solo abre la biometría.

**`setInvalidatedByBiometricEnrollment(true)`**, que es la parte que nadie recuerda y la que más
protege aquí: si alguien da de alta una huella NUEVA en el teléfono, la llave se invalida y hay
que volver a entrar con contraseña. Sin eso, meter tu dedo en el móvil desbloqueado de un
compañero te regalaría su sesión — y con ella su fichaje.

**No confundir con el checador.** El reconocimiento facial del fichaje es del SERVIDOR, es un
control antifraude de la empresa y sigue existiendo igual. Esto otro es el teléfono verificando a
su dueño, en local. Son dos cosas distintas que comparten la palabra «cara».

---

## 6. Fases

**F0 — Rebanada vertical (lo primero, y no se salta).** Proyecto KMP, autenticación real contra
el Supabase de producción, SQLite local, sincronización de UNA entidad y UNA pantalla que funcione
sin red. Sirve para descubrir lo que este plan no sabe todavía, antes de construir veinte
pantallas encima.

> **HECHA EN ANDROID (2026-09-17).** Repo en `~/Projects/pulse-app`. Login real, sesión guardada
> tras huella Clase 3, perfil leyéndose de SQLite. Verificado en un SM-S928B y contra los logs de
> `pulse-auth`. Falta la mitad de Windows, que es F4.
>
> **Lo que F0 descubrió y el plan no sabía** — que es exactamente para lo que existe esta fase:
> 1. **material3 1.4.0 estable NO trae Expressive.** Las APIs existen pero están `internal` y
>    faltan los componentes. Hay que ir a 1.5.0-alpha.
> 2. **AGP 9 rompe dos cosas de golpe**: el plugin `kotlin.android` sobra, y `com.android.library`
>    es incompatible con KMP (hay que usar `com.android.kotlin.multiplatform.library`).
> 3. **Supabase ROTA el refresh token en cada uso.** Obligó a cambiar de AES a una pareja RSA:
>    la pública cifra sin pedir huella, la privada descifra pidiéndola. Con AES, volver a guardar
>    el token rotado habría exigido una segunda huella en el mismo arranque.
> 4. **`refreshSession()` no instala la sesión**, solo la devuelve. Hace falta `importSession`.
> 5. **La RLS no garantiza una sola fila para todos los roles.** Para admin/RH/psicóloga,
>    `usuarios_select_privilegiados` devuelve la plantilla entera: hay que filtrar por
>    `auth_user_id` o `decodeSingle` revienta. Habría funcionado para empleados y fallado justo
>    para quien administra.

**F1 — Android, la app del empleado, en línea.** Fichar (ML Kit + geocerca), encuesta, permisos,
vacaciones, mensajes, avisos. Sin offline todavía.

**F2 — Offline de lectura.** Replicación y arranque sin red.

**F3 — Fichaje offline.** La migración del §5.3, la cola, la marca y su vista en el panel de RH.

**F4 — Windows, la app de gestión.** Reutiliza el módulo compartido de F0-F3.

**F5 — Convivencia y retirada.** Las tres cosas conviven un tiempo; la PWA no se apaga hasta que
su sustituta esté probada con gente de verdad.

Cada fase termina con revisión independiente, como el resto del repo.

---

## 7. Riesgos

| # | Riesgo | Qué se hace |
|---|---|---|
| R1 | **El rewrite se come el mantenimiento** y la PWA se pudre mientras tanto | La PWA es lo que usan 100 personas hoy. Sigue mantenida. Si hay que elegir, gana la PWA |
| R2 | Se da por hecho que «rewrite» incluye la base | Está escrito en §0: la base **no** se toca |
| R3 | Editor de avisos y gráficas sin equivalente maduro | Decidir en F4 si se simplifica a Markdown. No se descubre al final |
| R4 | Fichaje offline falsificable | §5.3: tiempo transcurrido, no reloj; marca en vez de rechazo |
| R5 | Datos sensibles en un teléfono perdido | §5.2: no se replican datos bancarios, expedientes ni notas |
| R6 | Pérdida de la llave de firma del APK | Deja de poder actualizarse a todos los dispositivos. Se custodia como un secreto de producción |
| R7 | Un solo desarrollador, dos clientes y una PWA viva | Es el riesgo mayor y no tiene solución técnica. Lo mitiga el orden de fases y que Windows reutilice lo de Android |

---

## 8. Lo que quiero consultarte antes de empezar

**§8.1 — ¿Qué entra en la v1 de cada app?** 20 pantallas de empleado y 35 de gestión es mucho. Yo
propongo que la v1 de Android lleve solo lo de uso diario —fichar, encuesta, mensajes, permisos— y
que el resto llegue después. Pero eso significa que durante un tiempo la gente usará la app nativa
**y** la PWA según lo que necesiten. ¿Lo aceptas, o prefieres que la v1 de Android no salga hasta
tener las 20?

**§8.2 — ¿Windows sustituye a la PWA para RH, o convive?** RH trabaja desde la oficina y con cable.
Para ellos el offline no aporta casi nada, así que el escritorio se justifica por comodidad y por
el import de Excel, no por el offline. Conviene saber si es un «quiero» o un «necesito», porque de
eso depende que F4 vaya antes o después de completar Android.
