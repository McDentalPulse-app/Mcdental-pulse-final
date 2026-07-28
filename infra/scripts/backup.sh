#!/bin/sh
# Respaldo de la base de Pulse.
#
# ALCANCE: escribe en el MISMO disco del VPS. Eso cubre el error humano
# (alguien borra una tabla, una migracion sale mal) que es lo que mas pasa.
# NO cubre perder el disco ni el servidor. Falta la copia fuera del VPS —
# cuando haya destino, se agrega el envio donde dice COPIA FUERA DEL VPS.
#
# Desde el corte del 2026-07-28 esta base es la UNICA copia de la verdad de
# Pulse: ya no hay un Supabase Cloud detras del que rescatar nada. Por eso la
# retencion es mayor que la de dentra (30 dias) — un dato mal borrado puede
# tardar semanas en notarse, y el historial de checadas no se puede reconstruir.
#
# Formato custom (-Fc): ya viene comprimido y permite restaurar tablas sueltas.
#
# El dump y su verificacion corren DENTRO del contenedor: en el host no hay
# pg_restore, y el formato custom necesita un archivo seekable (no sirve
# leerlo por una tuberia).
set -eu

DIR=/opt/pulse/backups
KEEP_DAYS=30
STAMP=$(date +%Y%m%d-%H%M)
OUT="$DIR/pulse-$STAMP.dump"
TMP=/tmp/pulse-backup.dump

mkdir -p "$DIR"

docker exec pulse-db sh -c "
  set -e
  pg_dump -U postgres -d postgres -Fc -f $TMP
  pg_restore -l $TMP > /dev/null   # revienta si el archivo salio corrupto
"

docker cp "pulse-db:$TMP" "$OUT.tmp"
docker exec pulse-db rm -f "$TMP"

# Renombrar hasta el final: si algo falla antes, no queda un archivo truncado
# con cara de respaldo bueno.
mv "$OUT.tmp" "$OUT"

find "$DIR" -name 'pulse-*.dump' -mtime +$KEEP_DAYS -delete
find "$DIR" -name '*.tmp' -mtime +1 -delete

# --- COPIA FUERA DEL VPS (pendiente de destino) ---------------------------
# Aqui va el envio al almacenamiento externo. Mientras este vacio, este
# respaldo NO protege contra perder el servidor.
# --------------------------------------------------------------------------

echo "$(date '+%F %T')  ok  $(basename "$OUT")  $(du -h "$OUT" | cut -f1)"
