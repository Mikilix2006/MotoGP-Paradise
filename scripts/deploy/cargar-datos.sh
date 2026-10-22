#!/usr/bin/env bash
# Carga un volcado de datos (.sql.gz, de volcar-datos.ps1) en el PostgreSQL de destino.
# Requisitos: el esquema ya existe (npx prisma migrate deploy) y las tablas estan vacias.
# Uso:  DATABASE_URL='postgresql://usuario:clave@host:5432/bd?schema=public' \
#         ./cargar-datos.sh motogp-datos.sql.gz
# No necesita superusuario: el volcado va en orden de dependencias y se carga en
# una sola transaccion (si algo falla, no queda nada a medias).
set -euo pipefail
ARCHIVO="${1:?Uso: cargar-datos.sh fichero.sql.gz}"
: "${DATABASE_URL:?Define DATABASE_URL}"
AQUI="$(cd "$(dirname "$0")" && pwd)"

# libpq no admite el parametro ?schema= de Prisma: se elimina la query string.
URL="${DATABASE_URL%%\?*}"
PSQL=(psql "$URL" -v ON_ERROR_STOP=1 -X)

# Integridad del fichero (si hay .sha256 al lado, se comprueba).
if [ -f "$ARCHIVO.sha256" ]; then (cd "$(dirname "$ARCHIVO")" && sha256sum -c "$(basename "$ARCHIVO").sha256"); fi
gzip -t "$ARCHIVO"

# Las tablas de datos deben estar vacias para no duplicar ni chocar con claves unicas.
FILAS=$("${PSQL[@]}" -Atc "select coalesce(sum((xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::int),0) from information_schema.tables t where t.table_schema='public' and t.table_type='BASE TABLE' and t.table_name <> '_prisma_migrations' and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=format('%I.%I', t.table_schema, t.table_name)::regclass::oid and d.deptype='e')")
# (Se excluyen las tablas que pertenecen a extensiones, p. ej. PostGIS: spatial_ref_sys, pagc_*;
#  el hosting las crea en public y no son nuestras.)
# La migracion category_500cc siembra la fila 500cc y el volcado la trae con el mismo id:
# si es lo unico que hay en el destino, se retira para que la carga no choque.
SEMILLA_500CC="b1491d87-f579-429d-b2c0-46c75169888c"
if [ "$FILAS" = "1" ] && [ "$("${PSQL[@]}" -Atc "select count(*) from categories where id='$SEMILLA_500CC'")" = "1" ]; then
  "${PSQL[@]}" -qc "delete from categories where id='$SEMILLA_500CC'"
  FILAS=0
fi
if [ "$FILAS" != "0" ]; then echo "ERROR: el destino ya tiene $FILAS filas; abortado." >&2; exit 1; fi

echo "Cargando $ARCHIVO ..."
gzip -dc "$ARCHIVO" | awk -f "$AQUI/filtro-volcado.awk" | "${PSQL[@]}" -q -o /dev/null --single-transaction -f -

echo "Actualizando estadisticas (ANALYZE)..."
"${PSQL[@]}" -qc "ANALYZE"
echo "Carga terminada."
