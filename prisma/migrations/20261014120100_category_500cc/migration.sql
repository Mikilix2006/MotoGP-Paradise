-- Categoría 500cc propia (datos, sin cambio de esquema).
-- La API general la da con legacy_id -1; la de resultados la mezcla con MotoGP
-- (mismo uuid y legacy_id 3), por eso motogp_uuid queda NULL: no hay uuid de
-- resultados propio y no debe colisionar con la fila de MotoGP.
-- Idempotente: NOT EXISTS sobre legacy_id (no es único en el esquema).
-- Histórica como 125cc/250cc/350cc: sin acrónimo, timing_id ni prioridad.
INSERT INTO "categories" ("id", "motogp_uuid", "legacy_id", "name", "acronym", "timing_id", "priority", "active", "created_at", "updated_at")
SELECT 'b1491d87-f579-429d-b2c0-46c75169888c', NULL, -1, '500cc', NULL, NULL, NULL, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "legacy_id" = -1);
