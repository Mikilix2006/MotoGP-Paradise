-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "condition_air" TEXT,
ADD COLUMN     "condition_ground" TEXT,
ADD COLUMN     "condition_humidity" TEXT,
ADD COLUMN     "condition_track" TEXT,
ADD COLUMN     "condition_weather" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "championship_standings_season_id_category_id_rider_id_key" ON "championship_standings"("season_id", "category_id", "rider_id");

