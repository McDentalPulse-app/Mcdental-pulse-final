# Infraestructura de la VPS

Copia versionada de lo que hace funcionar a Pulse **fuera** del código de la aplicación.
Estos ficheros viven en su sitio real en la máquina; aquí están para que, si se pierde
la VPS, no haya que reconstruirlos de memoria.

**No se despliegan desde aquí.** Editar este directorio no cambia nada en la máquina:
hay que copiarlos a su ruta real y recargar el servicio correspondiente.

| Aquí | Ruta real en la VPS |
|---|---|
| `jitsi/docker-compose.yml` | `/opt/jitsi/docker-compose.yml` |
| `jitsi/turnserver.conf` | `/opt/jitsi/config/coturn/turnserver.conf` |
| `jitsi/env.ejemplo` | `/opt/jitsi/.env` |
| `nginx/pulse.conf` | `/etc/nginx/sites-available/pulse.conf` |
| `nginx/meet.conf` | `/etc/nginx/sites-available/meet.conf` |
| `nginx/websocket-upgrade.conf` | `/etc/nginx/conf.d/websocket-upgrade.conf` |
| `nginx/jitsi-web-timeouts.conf` | `/opt/jitsi/config/web/nginx-custom/timeouts.conf` |
| `scripts/*.sh` | `/opt/pulse/*.sh` |
| `cron/*` | `/etc/cron.d/*` |
| `respaldo-oficina/*` | **no van en la VPS**: en la máquina de la oficina, en `~/pulse-respaldo/` |

## El respaldo externo tira, no empuja

`respaldo-oficina/` es lo único de este directorio que **no** corre aquí. Es deliberado:

> La VPS está expuesta a internet; la máquina de la oficina no. Si un día comprometen la
> VPS, un respaldo "de empuje" le regalaría al atacante una credencial con acceso a la red
> interna de la clínica. Tirando desde la oficina, la credencial vive de aquel lado y
> apunta hacia fuera: una VPS comprometida no alcanza nada.

De ahí también que la oficina **no ejecute nada que venga por la red**: el script vive en
esa máquina y no se actualiza solo desde aquí. Si lo hiciera, el atacante que controlara
la VPS tendría ejecución de código dentro de la oficina, que es justo lo que se evita.

Piezas, y qué falla si falta cada una:

| Pieza | Dónde | Sin ella |
|---|---|---|
| `backup.sh` genera el dump **y su `.sha256`** | VPS, 08:43 UTC | la oficina no puede verificar que la copia llegó entera |
| usuario `respaldo` + `authorized_keys` con comando forzado | VPS | la clave de la oficina daría una shell |
| `tirar-respaldo.sh` copia, verifica y avisa | oficina, 03:20 local | no hay copia fuera del servidor |
| `api/respaldo-latido.js` recibe el parte | VPS | un respaldo roto se descubre el día que hace falta |
| `api/revisar-respaldos.js` vigila el silencio | VPS, 15:23 UTC | la oficina se apaga en vacaciones y nadie se entera |

La línea que autoriza la clave en `/home/respaldo/.ssh/authorized_keys` es:

```
command="/usr/bin/rrsync -ro /opt/pulse/backups",restrict ssh-ed25519 AAAA… respaldo-pulse-oficina
```

`-ro` la deja en solo lectura y `restrict` le quita pty, túneles y agente. Comprobado: con
esa clave no se obtiene shell, no se leen los `.env`, no se escribe y no se sale del
directorio con `..`.

**La verificación es de tres capas y cada una caza algo distinto:**

1. **Que haya llegado algo reciente** — detecta que la VPS dejó de generar respaldos.
2. **`sha256`** — detecta una copia truncada, el fallo típico de una red que se corta. Es
   la única capa que ve la corrupción **dentro de los datos**.
3. **`pg_restore -l`** — detecta un archivo estructuralmente inválido. Ojo: solo lee la
   tabla de contenidos de la cabecera, así que **no** se entera de un byte cambiado en
   mitad de los datos. Por eso la capa 2 no sobra.

## Lo que NO está aquí, a propósito

**Los secretos.** Aparecen como `__NO_SE_VERSIONA__`. Los valores reales viven solo en la
máquina:

- `/opt/jitsi/.env` — `JWT_APP_SECRET` (firma los tokens de entrada a las salas),
  `TURN_CREDENTIALS` y las contraseñas de jicofo y el JVB.
- `/opt/jitsi/config/coturn/turnserver.conf` — `static-auth-secret`, que **tiene que ser
  el mismo** que `TURN_CREDENTIALS`. Si dejan de coincidir, TURN deja de autenticar y las
  llamadas fallan solo en las redes que lo necesitan — un fallo difícil de ver.
- `/opt/pulse/api.env` — claves de Supabase, VAPID, Gemini, MCTIC, `CRON_SECRET` y
  `JITSI_APP_SECRET`, que **también** tiene que coincidir con `JWT_APP_SECRET` del `.env`
  de Jitsi.
- `~/pulse-respaldo/secreto` en la oficina — copia de `CRON_SECRET`, para poder avisar.
- `~/pulse-respaldo/clave` en la oficina — la privada **nunca sale de esa máquina**.

Para reconstruirlos: generar con `openssl rand -hex 32` y respetar esas dos parejas.

## Certificados

`meet.mcdentalpulse.duckdns.org` usa Let's Encrypt vía certbot, renovado por
`/etc/cron.d/certbot`. coturn monta `/etc/letsencrypt` **entero** y no solo `live/`:
los ficheros de `live/` son enlaces relativos a `../../archive/` y montando solo `live/`
quedan rotos dentro del contenedor.

## Trampas que ya costaron una tarde

- **El frontend se construye con `build-frontend.sh`**, nunca con `docker build` a mano:
  la URL del bundle es la pública, jamás la de `api.env` (que es la interna de Docker).
- **La señalización de Jitsi atraviesa DOS nginx** (el del host y el de dentro de
  `jitsi-web`). Los timeouts hay que ponerlos en los dos.
- **`turnserver.conf` bloquea los rangos privados.** Sin esas líneas, el TURN se puede
  usar para alcanzar Postgres o Kong desde fuera.
- **Las horas de los cron no se eligen igual.** Las de mantenimiento van de madrugada para
  no competir por I/O; la de `revisar-respaldos` va a las **09:23 de Tampico** a propósito,
  porque una alarma de madrugada la ve alguien al mediodía y para entonces se ha perdido
  otro día sin respaldo.
