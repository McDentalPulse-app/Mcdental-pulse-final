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

# --- COMPROBACIONES VISUALES ------------------------------------------------
# Se miden los ficheros de la IMAGEN recien construida, no un build del anfitrion: aqui no
# estan todas las dependencias (un `npm run build` falla por recharts). Lo que hay que medir
# es exactamente lo que se va a servir.
#
# Va DESPUES de construir y ANTES de cambiar el contenedor: si falla, el que esta sirviendo
# sigue en pie y no se toca nada.
#
# POR QUE ESTE BLOQUE VIVE AQUI (2026-09-10): habia DOS build-frontend.sh. Este, en el repo,
# solo comprobaba la URL; el de /opt/pulse/ ademas corria el banco visual. Quien desplegara
# desde el repo se saltaba las comprobaciones enteras sin enterarse — y asi salio a produccion
# el fallo de los parrafos de ayuda partidos en columnas. Ahora la implementacion es UNA y
# esta versionada; /opt/pulse/build-frontend.sh solo reenvia aqui.
#
# Escape para un arreglo urgente:  VERIFICAR=0 sh infra/scripts/build-frontend.sh
if [ "${VERIFICAR:-1}" = "1" ]; then
  TMPV=$(mktemp -d)
  CID=$(docker create pulse-frontend:latest)
  docker cp "$CID:/usr/share/nginx/html/assets" "$TMPV/assets" >/dev/null
  docker rm -f "$CID" >/dev/null
  # Ruta relativa al `cd /opt/pulse/app` de arriba: el script mide SU propio arbol.
  if ! node scripts/verificar-visual.mjs "$TMPV/assets"; then
    rm -rf "$TMPV"
    echo "ABORTADO: las comprobaciones visuales fallaron. NO se ha tocado el contenedor." >&2
    echo "Si hace falta desplegar igual: VERIFICAR=0 sh infra/scripts/build-frontend.sh" >&2
    exit 1
  fi
  rm -rf "$TMPV"
else
  echo "AVISO: comprobaciones visuales SALTADAS (VERIFICAR=0)."
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
