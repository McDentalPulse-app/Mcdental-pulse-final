#!/bin/sh
# Reconstruye y despliega el frontend de Pulse.
#
# LA TRAMPA QUE ESTE SCRIPT EVITA (2026-07-27): el frontend se compila con la URL
# metida dentro del bundle, y esa URL la usa el NAVEGADOR. Tomarla de
# /opt/pulse/api.env es un error: ahi VITE_SUPABASE_URL vale http://pulse-kong:8000,
# que es la direccion interna de Docker que usa el servidor. Compilar con ella deja
# la app sin poder iniciar sesion, porque el telefono no puede resolver ese nombre.
#
# La URL del navegador es SIEMPRE la publica. Se fija aqui y no se lee de ningun env.
set -eu

PUBLICA=https://mcdentalpulse.duckdns.org
ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' /opt/pulse/frontend.env | cut -d= -f2-)

cd /opt/pulse/app

# La imagen que sirve ahora pasa a ser el punto de retorno antes de tocar nada.
docker tag pulse-frontend:latest pulse-frontend:previa 2>/dev/null || true

docker build -f Dockerfile.frontend \
  --build-arg VITE_SUPABASE_URL="$PUBLICA" \
  --build-arg VITE_SUPABASE_ANON_KEY="$ANON" \
  -t pulse-frontend:latest .

# Comprobacion antes de publicar: si la URL publica no esta en el bundle, algo salio
# mal y es mejor no desplegar que dejar a la clinica sin poder entrar.
if ! docker run --rm --entrypoint sh pulse-frontend:latest \
     -c "grep -rq '$PUBLICA' /usr/share/nginx/html/assets/index-*.js"; then
  echo 'ABORTADO: el bundle no apunta a la URL publica.' >&2
  docker tag pulse-frontend:previa pulse-frontend:latest
  exit 1
fi

docker rm -f pulse-frontend >/dev/null 2>&1 || true
docker run -d --name pulse-frontend --network pulse_default --restart unless-stopped \
  -p 127.0.0.1:3080:80 pulse-frontend:latest >/dev/null

i=0
while [ $i -lt 60 ]; do
  curl -sf -o /dev/null http://127.0.0.1:3080/ && break
  i=$((i+1)); sleep 0.2
done
echo "desplegado. Para volver atras: docker tag pulse-frontend:previa pulse-frontend:latest && \\"
echo "  docker rm -f pulse-frontend && docker run -d --name pulse-frontend --network pulse_default \\"
echo "  --restart unless-stopped -p 127.0.0.1:3080:80 pulse-frontend:latest"
