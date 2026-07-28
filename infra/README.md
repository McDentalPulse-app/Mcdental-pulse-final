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
| `nginx/meet.conf` | `/etc/nginx/sites-available/meet.conf` |
| `nginx/websocket-upgrade.conf` | `/etc/nginx/conf.d/websocket-upgrade.conf` |
| `nginx/jitsi-web-timeouts.conf` | `/opt/jitsi/config/web/nginx-custom/timeouts.conf` |
| `scripts/*.sh` | `/opt/pulse/*.sh` |

## Lo que NO está aquí, a propósito

**Los secretos.** En `env.ejemplo` y en `turnserver.conf` aparecen como
`__NO_SE_VERSIONA__`. Los valores reales viven solo en la máquina:

- `/opt/jitsi/.env` — `JWT_APP_SECRET` (firma los tokens de entrada a las salas),
  `TURN_CREDENTIALS` y las contraseñas de jicofo y el JVB.
- `/opt/jitsi/config/coturn/turnserver.conf` — `static-auth-secret`, que **tiene que ser
  el mismo** que `TURN_CREDENTIALS`. Si dejan de coincidir, TURN deja de autenticar y las
  llamadas fallan solo en las redes que lo necesitan — un fallo difícil de ver.
- `/opt/pulse/api.env` — claves de Supabase, VAPID, Gemini, MCTIC y `JITSI_APP_SECRET`,
  que **también** tiene que coincidir con `JWT_APP_SECRET` del `.env` de Jitsi.

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
