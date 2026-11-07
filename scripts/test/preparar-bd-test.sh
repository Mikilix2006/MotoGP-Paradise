#!/usr/bin/env bash
# Crea (o recrea) la base motogp_test a partir del volcado motogp-datos.sql.gz,
# para Playwright y las comprobaciones de endpoints en local.
# Toma usuario, clave y host de DATABASE_URL en .env y solo cambia el nombre de
# la base: la de desarrollo no se toca. Uso (Git Bash, raíz del repositorio):
#   bash scripts/test/preparar-bd-test.sh [motogp-datos.sql.gz]
# Si psql no está en el PATH: PG_BIN="/c/Program Files/PostgreSQL/18/bin".
set -euo pipefail
cd "$(dirname "$0")/../.."
VOLCADO="${1:-motogp-datos.sql.gz}"
BD_TEST="motogp_test"
[ -n "${PG_BIN:-}" ] && export PATH="$PG_BIN:$PATH"

URL_DEV="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$URL_DEV" ] || { echo "ERROR: no hay DATABASE_URL en .env" >&2; exit 1; }
BASE="${URL_DEV%%\?*}"            # sin ?schema=
SERVIDOR="${BASE%/*}"             # postgresql://usuario:clave@host:puerto
URL_TEST="$SERVIDOR/$BD_TEST"

# Salvaguarda: solo se borra una base que se llame exactamente motogp_test.
[ "${URL_TEST##*/}" = "$BD_TEST" ] || { echo "ERROR: destino inesperado" >&2; exit 1; }

echo "Recreando $BD_TEST ..."
psql "$SERVIDOR/postgres" -v ON_ERROR_STOP=1 -X -q \
  -c "DROP DATABASE IF EXISTS $BD_TEST WITH (FORCE)" \
  -c "CREATE DATABASE $BD_TEST"

echo "Aplicando migraciones ..."
DATABASE_URL="$URL_TEST" npx prisma migrate deploy

DATABASE_URL="$URL_TEST" bash scripts/deploy/cargar-datos.sh "$VOLCADO"

echo "Listo. Para los tests: DATABASE_URL_TEST='$SERVIDOR/$BD_TEST' (no lo guardes en git)."
