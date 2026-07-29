#!/bin/sh
# Copia el respaldo de Pulse desde la VPS a esta maquina, LO VERIFICA, y avisa.
#
# Corre en la maquina de la OFICINA, no en la VPS. Es a proposito: la VPS esta
# expuesta a internet y esta maquina no. Si un dia comprometen el servidor, un
# respaldo "de empuje" le regalaria al atacante una credencial hacia la red
# interna de la clinica. Tirando desde aqui, la credencial vive de este lado y
# apunta hacia fuera.
#
# NO BASTA CON QUE EL FICHERO LLEGUE. Un respaldo que pesa pero no restaura no
# es un respaldo, y lo peor es que da tranquilidad. Por eso se comprueban tres
# cosas y si falla cualquiera se avisa:
#   1. que haya llegado uno RECIENTE (no el de la semana pasada otra vez)
#   2. que su huella sha256 coincida con la que calculo la VPS  -> llego entero
#   3. que pg_restore -l lo lea                                 -> es restaurable
set -u

BASE_DIR=$(cd "$(dirname "$0")" && pwd)
DESTINO=$BASE_DIR/copias
LOG=$BASE_DIR/tirar.log
CLAVE=$BASE_DIR/clave
SECRETO_F=$BASE_DIR/secreto
CONOCIDOS=$BASE_DIR/servidor_conocido

VPS=respaldo@2.25.150.106
URL_LATIDO=https://mcdentalpulse.duckdns.org/api/respaldo-latido

# Mas larga que la de la VPS (30 dias). Un respaldo externo que caduca a la vez
# que el local no anade profundidad: si un borrado se descubre a los dos meses,
# los dos habrian olvidado lo mismo. Ocupa poco: cada dump ronda los 700 KB.
KEEP_DAYS=90

# 30 horas, no 24: el tiron es diario pero un arranque tarde o un reinicio no
# deben contar como fallo. Mas de dia y cuarto ya no es retraso.
FRESCO_MIN=1800

log() { echo "$(date '+%F %T')  $*" >> "$LOG"; }

latido() {  # ok detalle archivo sha bytes
  [ -f "$SECRETO_F" ] || { log "sin fichero de secreto: no se manda el parte"; return; }
  SECRETO=$(cat "$SECRETO_F")
  curl -sS -m 30 -X POST "$URL_LATIDO" \
    -H "Authorization: Bearer $SECRETO" \
    -H "Content-Type: application/json" \
    -d "{\"ok\":$1,\"detalle\":\"$2\",\"archivo\":\"$3\",\"sha256\":\"$4\",\"bytes\":$5}" \
    >/dev/null 2>>"$LOG" || log "no se pudo avisar a Pulse (sin red?)"
}

# Cualquier fallo avisa ANTES de morir. Un fallo silencioso aqui es exactamente
# el modo en que un respaldo deja de existir sin que nadie se entere.
fallo() { log "FALLO: $1"; latido false "$1" "${2:-}" "" null; exit 1; }

mkdir -p "$DESTINO"

# ── 1. Copiar ───────────────────────────────────────────────────────────────
# La clave del otro lado lleva comando forzado (rrsync de solo lectura), asi
# que esto es lo UNICO que puede hacer aunque se filtre: no da una shell.
rsync -rlt --timeout=120 \
  -e "ssh -i $CLAVE -o BatchMode=yes -o UserKnownHostsFile=$CONOCIDOS -o StrictHostKeyChecking=yes -o ConnectTimeout=20" \
  "$VPS:/" "$DESTINO/" >>"$LOG" 2>&1 \
  || fallo "no se pudo copiar del servidor (rsync)"

# ── 2. Hay algo reciente? ───────────────────────────────────────────────────
if [ -z "$(find "$DESTINO" -name 'pulse-*.dump' -mmin -$FRESCO_MIN 2>/dev/null | head -1)" ]; then
  fallo "no llego ningun respaldo reciente (el servidor dejo de generarlos?)"
fi

ULTIMO=$(ls -1t "$DESTINO"/pulse-*.dump 2>/dev/null | head -1)
[ -n "$ULTIMO" ] || fallo "no hay ningun dump en la copia"
NOMBRE=$(basename "$ULTIMO")

# ── 3. Llego entero? ────────────────────────────────────────────────────────
# La huella la calculo la VPS sobre su propio fichero y viaja como .sha256 al
# lado del dump. Compararla aqui detecta una copia truncada, que es el fallo
# tipico de una red que se corta a mitad y el que peor se nota a simple vista:
# el fichero existe y pesa casi lo mismo.
[ -f "$ULTIMO.sha256" ] || fallo "falta la huella de $NOMBRE" "$NOMBRE"
ESPERADO=$(cat "$ULTIMO.sha256")
REAL=$(sha256sum "$ULTIMO" | awk '{print $1}')
[ "$ESPERADO" = "$REAL" ] || fallo "la huella no coincide: la copia llego incompleta" "$NOMBRE"

# ── 4. Es restaurable? ──────────────────────────────────────────────────────
# La comprobacion que de verdad importa. Las tres anteriores dicen que el
# fichero llego; solo esta dice que SIRVE.
command -v pg_restore >/dev/null 2>&1 \
  || fallo "falta pg_restore: la copia no se puede verificar" "$NOMBRE"
pg_restore -l "$ULTIMO" >/dev/null 2>>"$LOG" \
  || fallo "el dump no es restaurable (archivo corrupto)" "$NOMBRE"

# ── 5. Retencion y parte ────────────────────────────────────────────────────
find "$DESTINO" -name 'pulse-*.dump'        -mtime +$KEEP_DAYS -delete
find "$DESTINO" -name 'pulse-*.dump.sha256' -mtime +$KEEP_DAYS -delete

BYTES=$(stat -c %s "$ULTIMO" 2>/dev/null || echo 0)
CUANTOS=$(ls -1 "$DESTINO"/pulse-*.dump 2>/dev/null | wc -l)
log "ok  $NOMBRE  $BYTES bytes  ($CUANTOS copias guardadas)"
latido true "verificado: huella y pg_restore" "$NOMBRE" "$REAL" "$BYTES"

# El log crece un par de lineas al dia, pero en dos anos son mil: se recorta
# para que siga siendo legible de un vistazo cuando haga falta mirarlo.
if [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
