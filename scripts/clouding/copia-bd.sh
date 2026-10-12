#!/usr/bin/env bash
# Copia de seguridad de la base de datos "motogp" (la ejecuta motogp-backup.service
# cada madrugada, como root; también se puede lanzar a mano: sudo motogp-copia-bd).
# pg_dump se ejecuta como el usuario "postgres" por el socket local: no hay
# contraseñas en ficheros ni en la línea de comandos.
# Resultado: /var/backups/motogp/motogp-AAAAMMDD-HHMMSS.sql.gz (se conservan las 14 últimas).
# Para restaurar una copia en una base VACÍA:
#   gunzip -c FICHERO.sql.gz | sudo -u postgres psql -v ON_ERROR_STOP=1 motogp
set -euo pipefail

DESTINO="/var/backups/motogp"
BASE="motogp"
CONSERVAR=14

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

FICHERO="$DESTINO/motogp-$(date +%Y%m%d-%H%M%S).sql.gz"
TEMPORAL="$FICHERO.parcial"
trap 'rm -f "$TEMPORAL"' EXIT

# --no-owner/--no-privileges: la copia se puede restaurar con otro nombre de rol.
runuser -u postgres -- pg_dump --no-owner --no-privileges "$BASE" | gzip -9 > "$TEMPORAL"

# Comprobaciones: gzip íntegro y contenido no vacío (un volcado vacío pesa ~20 bytes).
gzip -t "$TEMPORAL"
if [ ! -s "$TEMPORAL" ] || [ "$(gzip -dc "$TEMPORAL" | head -c 200 | wc -c)" -lt 100 ]; then
  echo "ERROR: la copia salió vacía; no se conserva." >&2
  exit 1
fi

mv "$TEMPORAL" "$FICHERO"
chmod 600 "$FICHERO"
echo "Copia creada: $FICHERO ($(du -h "$FICHERO" | cut -f1))"

# Rotación: se borran las más antiguas y quedan las $CONSERVAR últimas.
# (Los nombres llevan la fecha, así que el orden alfabético es el cronológico.)
mapfile -t TODAS < <(find "$DESTINO" -maxdepth 1 -type f -name 'motogp-*.sql.gz' | sort)
SOBRAN=$(( ${#TODAS[@]} - CONSERVAR ))
if [ "$SOBRAN" -gt 0 ]; then
  for VIEJA in "${TODAS[@]:0:SOBRAN}"; do
    rm -f -- "$VIEJA"
    echo "Copia antigua borrada: $VIEJA"
  done
fi
