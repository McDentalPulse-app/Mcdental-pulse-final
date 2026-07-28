#!/bin/sh
# Reconstruye y despliega el API de Pulse (api/*.js + server.js).
#
# Hace falta porque Dockerfile.api hace COPY del codigo: editar los ficheros en
# /opt/pulse/app NO cambia lo que sirve el contenedor hasta que se reconstruye.
#
# Las variables salen de /opt/pulse/api.env, que es el env del SERVIDOR: ahi
# VITE_SUPABASE_URL vale http://pulse-kong:8000 y esta bien, porque quien la usa
# es el propio contenedor dentro de la red de Docker. (Lo que NUNCA debe usar ese
# fichero es el build del frontend: ver build-frontend.sh.)
set -eu

cd /opt/pulse/app

docker tag pulse-api:latest pulse-api:previa 2>/dev/null || true
docker build -f Dockerfile.api -t pulse-api:latest .

docker rm -f pulse-api-server >/dev/null 2>&1 || true
docker run -d --name pulse-api-server --network pulse_default --restart unless-stopped \
  -p 127.0.0.1:3001:3001 --env-file /opt/pulse/api.env pulse-api:latest >/dev/null

# No basta con que el contenedor exista: se espera a que /health conteste.
i=0
while [ $i -lt 90 ]; do
  curl -sf -o /dev/null http://127.0.0.1:3001/health && break
  i=$((i+1)); sleep 0.5
done

if ! curl -sf -o /dev/null http://127.0.0.1:3001/health; then
  echo 'ABORTADO: el API no responde en /health. Volviendo a la imagen anterior.' >&2
  docker rm -f pulse-api-server >/dev/null 2>&1 || true
  docker tag pulse-api:previa pulse-api:latest
  docker run -d --name pulse-api-server --network pulse_default --restart unless-stopped \
    -p 127.0.0.1:3001:3001 --env-file /opt/pulse/api.env pulse-api:latest >/dev/null
  exit 1
fi

echo "api desplegado. Rutas montadas: $(docker logs pulse-api-server 2>&1 | grep -c '^montado:')"
