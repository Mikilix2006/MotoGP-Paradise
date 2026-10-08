# Filtro de lista blanca para volcados de pg_dump --data-only.
# Fuera de los bloques COPY solo deja pasar lo que PostgreSQL 12 entiende
# (descarta p. ej. "SET transaction_timeout" de pg_dump 17+ o "\restrict" de
# versiones recientes). Dentro de COPY copia las filas tal cual hasta "\.".
BEGIN { en_copy = 0; descartadas = 0 }
{
  if (en_copy) {
    print
    if ($0 == "\\.") en_copy = 0
    next
  }
  if ($0 ~ /^COPY public\.[^ ]+ \(.*\) FROM stdin;$/) { en_copy = 1; print; next }
  if ($0 ~ /^$/ || $0 ~ /^--/) { print; next }
  if ($0 ~ /^SET (statement_timeout|lock_timeout|idle_in_transaction_session_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security) = /) { print; next }
  if ($0 ~ /^SELECT pg_catalog\.set_config\('search_path', '', false\);$/) { print; next }
  descartadas++
  print "filtro-volcado: descartada -> " $0 > "/dev/stderr"
}
END { print "filtro-volcado: lineas descartadas fuera de COPY: " descartadas > "/dev/stderr" }
