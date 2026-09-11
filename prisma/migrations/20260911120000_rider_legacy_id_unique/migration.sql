-- DropIndex
DROP INDEX "riders_legacy_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "riders_legacy_id_key" ON "riders"("legacy_id");

