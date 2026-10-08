-- Comprobaciones de solo lectura tras la carga: psql "$URL_SIN_SCHEMA" -f comprobaciones.sql
select version();
show server_encoding;
-- 1) Migraciones aplicadas (deben ser 6, todas con finished_at y sin rolled_back_at)
select migration_name, finished_at is not null as ok, rolled_back_at from _prisma_migrations order by 1;
-- 2) Recuento por tabla (comparar con el origen)
select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int as filas
from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1;
-- 3) Integridad referencial: todas las FK validadas (debe devolver 0 filas)
select conrelid::regclass, conname from pg_constraint where contype='f' and not convalidated;
-- 4) Sin secuencias (los id son UUID generados por Prisma): debe devolver 0
select count(*) as secuencias from pg_class where relkind='S' and relnamespace='public'::regnamespace;
-- 5) Datos clave coherentes con la app
select (select count(*) from riders) riders, (select count(*) from riders where legacy_id is null) sin_legacy,
       (select max(year) from seasons) ultima_temporada, (select count(*) from events where flag_url is not null) eventos_con_bandera;
-- 6) Estadisticas al dia (last_analyze no nulo tras ANALYZE)
select relname, n_live_tup, last_analyze from pg_stat_user_tables order by n_live_tup desc limit 5;
