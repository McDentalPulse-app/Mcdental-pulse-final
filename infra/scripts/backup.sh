#!/bin/sh
# Respaldo de la base de Pulse.
#
# ALCANCE: escribe en el MISMO disco del VPS. Eso cubre el error humano
# (alguien borra una tabla, una migracion sale mal) que es lo que mas pasa.
# La copia FUERA del VPS ya existe, pero no se hace desde aqui: la tira la
# maquina de la oficina (ver el bloque del final).
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

# Huella, para que la copia de la oficina pueda verificarse SOLA.
#
# La clave con la que entra la oficina lleva comando forzado: solo puede copiar
# ficheros, no ejecutar sha256sum aqui. Asi que la huella tiene que VIAJAR
# DENTRO de la copia. Se escribe despues del mv, sobre el fichero definitivo.
sha256sum "$OUT" | awk '{print $1}' > "$OUT.sha256"

find "$DIR" -name 'pulse-*.dump' -mtime +$KEEP_DAYS -delete
find "$DIR" -name 'pulse-*.dump.sha256' -mtime +$KEEP_DAYS -delete
find "$DIR" -name '*.tmp' -mtime +1 -delete

# --- COPIA FUERA DEL VPS ---------------------------------------------------
# NO se envia desde aqui, y es a proposito: este servidor esta expuesto a
# internet y la maquina de la oficina no. Si un dia comprometen el VPS, un
# respaldo "de empuje" le regalaria al atacante una credencial hacia la red
# interna de la clinica.
#
# Por eso la oficina TIRA: entra como el usuario `respaldo` con una clave de
# comando forzado (solo rsync de solo lectura sobre este directorio), copia,
# verifica con el .sha256 de arriba, y avisa a /api/respaldo-latido.
# El silencio de esos avisos lo vigila /api/revisar-respaldos.
# --------------------------------------------------------------------------

echo "$(date '+%F %T')  ok  $(basename "$OUT")  $(du -h "$OUT" | cut -f1)"
