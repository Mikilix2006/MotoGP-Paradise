/*
  Warnings:

  - A unique constraint covering the columns `[season_id,rider_id]` on the table `bmw_award_standings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "bmw_award_standings_season_id_rider_id_key" ON "bmw_award_standings"("season_id", "rider_id");
