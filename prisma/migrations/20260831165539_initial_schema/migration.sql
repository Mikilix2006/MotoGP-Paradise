-- CreateEnum
CREATE TYPE "ApiSource" AS ENUM ('RESULTS', 'BROADCAST', 'TIMING');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "iso" VARCHAR(8) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "region_iso" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "year" INTEGER NOT NULL,
    "name" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "legacy_id" INTEGER,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    "timing_id" TEXT,
    "priority" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuits" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "legacy_id" INTEGER,
    "name" TEXT NOT NULL,
    "place" TEXT,
    "nation" TEXT,
    "country_id" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_tracks" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "circuit_id" TEXT NOT NULL,
    "name" TEXT,
    "length_meters" INTEGER,
    "length_km" DECIMAL(8,3),
    "length_miles" DECIMAL(8,3),
    "length_feet" INTEGER,
    "width_meters" DECIMAL(6,2),
    "longest_straight_meters" INTEGER,
    "left_corners" INTEGER,
    "right_corners" INTEGER,
    "total_corners" INTEGER,
    "first_grid" TEXT,
    "box_entry" TEXT,
    "box_exit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuit_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_descriptions" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "circuit_id" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "business_unit_id" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuit_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_assets" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "circuit_id" TEXT NOT NULL,
    "track_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuit_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "results_uuid" UUID,
    "broadcast_uuid" UUID,
    "toad_api_uuid" UUID,
    "season_id" TEXT NOT NULL,
    "circuit_id" TEXT,
    "country_id" TEXT,
    "name" TEXT NOT NULL,
    "sponsored_name" TEXT,
    "additional_name" TEXT,
    "short_name" VARCHAR(20),
    "date_start" DATE,
    "date_end" DATE,
    "status" TEXT,
    "sequence" INTEGER,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "time_zone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_legacy_mappings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category_legacy_id" INTEGER NOT NULL,
    "event_legacy_id" INTEGER NOT NULL,

    CONSTRAINT "event_legacy_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "num_laps" INTEGER,
    "sprint_num_laps" INTEGER,
    "distance_meters" INTEGER,
    "distance_km" DECIMAL(10,3),
    "red_flag_laps" INTEGER,
    "sprint_red_flag_laps" INTEGER,
    "sequence" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_schedule_days" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "date_start" TIMESTAMP(3),
    "name" TEXT,
    "day" INTEGER,
    "month" INTEGER,
    "day_suffix" TEXT,
    "gp_day" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_documents" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "menu_position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_urls" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "language" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "results_uuid" UUID,
    "broadcast_uuid" UUID,
    "event_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "shortname" TEXT,
    "name" TEXT,
    "type" TEXT,
    "kind" TEXT,
    "status" TEXT,
    "date_start" TIMESTAMP(3),
    "date_end" TIMESTAMP(3),
    "num_laps" INTEGER,
    "progressive" BOOLEAN,
    "gp_day" TEXT,
    "timing_id" TEXT,
    "has_timing" BOOLEAN,
    "has_live" BOOLEAN,
    "has_report" BOOLEAN,
    "has_results" BOOLEAN,
    "has_on_demand" BOOLEAN,
    "is_live" BOOLEAN,
    "is_live_timing" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "legacy_id" INTEGER,
    "riders_api_uuid" UUID,
    "riders_id" UUID,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "birth_date" DATE,
    "birth_city" TEXT,
    "country_id" TEXT,
    "start_year" INTEGER,
    "legend" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "legacy_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "color" TEXT,
    "text_color" TEXT,
    "background_picture" TEXT,
    "picture" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constructors" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "legacy_id" INTEGER,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_season_entries" (
    "id" TEXT NOT NULL,
    "motogp_uuid" UUID,
    "rider_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "team_id" TEXT,
    "constructor_id" TEXT,
    "number" INTEGER,
    "sponsored_team" TEXT,
    "in_grid" BOOLEAN,
    "current" BOOLEAN DEFAULT false,
    "short_nickname" TEXT,
    "type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_season_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_season_images" (
    "id" TEXT NOT NULL,
    "rider_season_entry_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "main_url" TEXT,
    "secondary_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_season_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_season_statistics" (
    "id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "constructor_id" TEXT,
    "event_id" TEXT,
    "starts" INTEGER,
    "wins" INTEGER,
    "second_places" INTEGER,
    "third_places" INTEGER,
    "podiums" INTEGER,
    "poles" INTEGER,
    "points" INTEGER,
    "championship_position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_season_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_results" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "team_id" TEXT,
    "constructor_id" TEXT,
    "position" INTEGER,
    "position_text" TEXT,
    "points" DECIMAL(10,3),
    "laps_completed" INTEGER,
    "time" TEXT,
    "gap" TEXT,
    "status" TEXT,
    "fastest_lap" TEXT,
    "average_speed" DECIMAL(10,3),
    "top_speed" DECIMAL(10,3),
    "grid_position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "championship_standings" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "event_id" TEXT,
    "rider_id" TEXT NOT NULL,
    "team_id" TEXT,
    "constructor_id" TEXT,
    "position" INTEGER,
    "points" DECIMAL(10,3),
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "championship_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bmw_award_standings" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "event_id" TEXT,
    "rider_id" TEXT NOT NULL,
    "team_id" TEXT,
    "constructor_id" TEXT,
    "position" INTEGER,
    "points" DECIMAL(10,3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bmw_award_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_timing_snapshots" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT,

    CONSTRAINT "live_timing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_rider_timings" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "rider_id" TEXT,
    "position" INTEGER,
    "lap" INTEGER,
    "lap_time" TEXT,
    "gap_first" TEXT,
    "gap_previous" TEXT,
    "last_lap_time" TEXT,
    "last_lap" INTEGER,
    "on_pit" BOOLEAN,
    "status" TEXT,

    CONSTRAINT "live_rider_timings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_snapshots" (
    "id" TEXT NOT NULL,
    "source" "ApiSource" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_parameters" JSONB,
    "entity_type" TEXT,
    "entity_external_id" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT,

    CONSTRAINT "api_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "source" "ApiSource" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_key" ON "countries"("iso");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_motogp_uuid_key" ON "seasons"("motogp_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_year_key" ON "seasons"("year");

-- CreateIndex
CREATE INDEX "seasons_current_idx" ON "seasons"("current");

-- CreateIndex
CREATE UNIQUE INDEX "categories_motogp_uuid_key" ON "categories"("motogp_uuid");

-- CreateIndex
CREATE INDEX "categories_legacy_id_idx" ON "categories"("legacy_id");

-- CreateIndex
CREATE INDEX "categories_timing_id_idx" ON "categories"("timing_id");

-- CreateIndex
CREATE UNIQUE INDEX "circuits_motogp_uuid_key" ON "circuits"("motogp_uuid");

-- CreateIndex
CREATE INDEX "circuits_legacy_id_idx" ON "circuits"("legacy_id");

-- CreateIndex
CREATE INDEX "circuits_country_id_idx" ON "circuits"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_tracks_motogp_uuid_key" ON "circuit_tracks"("motogp_uuid");

-- CreateIndex
CREATE INDEX "circuit_tracks_circuit_id_idx" ON "circuit_tracks"("circuit_id");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_descriptions_circuit_id_language_business_unit_id_key" ON "circuit_descriptions"("circuit_id", "language", "business_unit_id");

-- CreateIndex
CREATE INDEX "circuit_assets_circuit_id_idx" ON "circuit_assets"("circuit_id");

-- CreateIndex
CREATE INDEX "circuit_assets_track_id_idx" ON "circuit_assets"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_results_uuid_key" ON "events"("results_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "events_broadcast_uuid_key" ON "events"("broadcast_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "events_toad_api_uuid_key" ON "events"("toad_api_uuid");

-- CreateIndex
CREATE INDEX "events_season_id_idx" ON "events"("season_id");

-- CreateIndex
CREATE INDEX "events_circuit_id_idx" ON "events"("circuit_id");

-- CreateIndex
CREATE INDEX "events_country_id_idx" ON "events"("country_id");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_date_start_idx" ON "events"("date_start");

-- CreateIndex
CREATE UNIQUE INDEX "event_legacy_mappings_event_id_category_legacy_id_key" ON "event_legacy_mappings"("event_id", "category_legacy_id");

-- CreateIndex
CREATE INDEX "event_categories_category_id_idx" ON "event_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_event_id_category_id_key" ON "event_categories"("event_id", "category_id");

-- CreateIndex
CREATE INDEX "event_schedule_days_event_id_idx" ON "event_schedule_days"("event_id");

-- CreateIndex
CREATE INDEX "event_schedule_days_date_start_idx" ON "event_schedule_days"("date_start");

-- CreateIndex
CREATE UNIQUE INDEX "event_documents_event_id_type_key" ON "event_documents"("event_id", "type");

-- CreateIndex
CREATE INDEX "event_urls_event_id_idx" ON "event_urls"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_results_uuid_key" ON "sessions"("results_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_broadcast_uuid_key" ON "sessions"("broadcast_uuid");

-- CreateIndex
CREATE INDEX "sessions_event_id_idx" ON "sessions"("event_id");

-- CreateIndex
CREATE INDEX "sessions_category_id_idx" ON "sessions"("category_id");

-- CreateIndex
CREATE INDEX "sessions_date_start_idx" ON "sessions"("date_start");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_timing_id_idx" ON "sessions"("timing_id");

-- CreateIndex
CREATE INDEX "sessions_event_id_category_id_type_date_start_idx" ON "sessions"("event_id", "category_id", "type", "date_start");

-- CreateIndex
CREATE UNIQUE INDEX "riders_motogp_uuid_key" ON "riders"("motogp_uuid");

-- CreateIndex
CREATE INDEX "riders_legacy_id_idx" ON "riders"("legacy_id");

-- CreateIndex
CREATE INDEX "riders_riders_api_uuid_idx" ON "riders"("riders_api_uuid");

-- CreateIndex
CREATE INDEX "riders_riders_id_idx" ON "riders"("riders_id");

-- CreateIndex
CREATE INDEX "riders_country_id_idx" ON "riders"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_motogp_uuid_key" ON "teams"("motogp_uuid");

-- CreateIndex
CREATE INDEX "teams_legacy_id_idx" ON "teams"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "constructors_motogp_uuid_key" ON "constructors"("motogp_uuid");

-- CreateIndex
CREATE INDEX "constructors_legacy_id_idx" ON "constructors"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "rider_season_entries_motogp_uuid_key" ON "rider_season_entries"("motogp_uuid");

-- CreateIndex
CREATE INDEX "rider_season_entries_season_id_category_id_idx" ON "rider_season_entries"("season_id", "category_id");

-- CreateIndex
CREATE INDEX "rider_season_entries_team_id_idx" ON "rider_season_entries"("team_id");

-- CreateIndex
CREATE INDEX "rider_season_entries_constructor_id_idx" ON "rider_season_entries"("constructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "rider_season_entries_rider_id_season_id_category_id_key" ON "rider_season_entries"("rider_id", "season_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "rider_season_images_rider_season_entry_id_type_key" ON "rider_season_images"("rider_season_entry_id", "type");

-- CreateIndex
CREATE INDEX "rider_season_statistics_season_id_category_id_idx" ON "rider_season_statistics"("season_id", "category_id");

-- CreateIndex
CREATE INDEX "rider_season_statistics_event_id_idx" ON "rider_season_statistics"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "rider_season_statistics_rider_id_season_id_category_id_key" ON "rider_season_statistics"("rider_id", "season_id", "category_id");

-- CreateIndex
CREATE INDEX "session_results_rider_id_idx" ON "session_results"("rider_id");

-- CreateIndex
CREATE INDEX "session_results_team_id_idx" ON "session_results"("team_id");

-- CreateIndex
CREATE INDEX "session_results_constructor_id_idx" ON "session_results"("constructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_results_session_id_rider_id_key" ON "session_results"("session_id", "rider_id");

-- CreateIndex
CREATE INDEX "championship_standings_season_id_category_id_event_id_idx" ON "championship_standings"("season_id", "category_id", "event_id");

-- CreateIndex
CREATE INDEX "championship_standings_rider_id_idx" ON "championship_standings"("rider_id");

-- CreateIndex
CREATE INDEX "bmw_award_standings_season_id_event_id_idx" ON "bmw_award_standings"("season_id", "event_id");

-- CreateIndex
CREATE INDEX "bmw_award_standings_rider_id_idx" ON "bmw_award_standings"("rider_id");

-- CreateIndex
CREATE INDEX "live_timing_snapshots_session_id_fetched_at_idx" ON "live_timing_snapshots"("session_id", "fetched_at");

-- CreateIndex
CREATE INDEX "live_rider_timings_snapshot_id_idx" ON "live_rider_timings"("snapshot_id");

-- CreateIndex
CREATE INDEX "live_rider_timings_rider_id_idx" ON "live_rider_timings"("rider_id");

-- CreateIndex
CREATE INDEX "api_snapshots_source_endpoint_entity_external_id_idx" ON "api_snapshots"("source", "endpoint", "entity_external_id");

-- CreateIndex
CREATE INDEX "api_snapshots_fetched_at_idx" ON "api_snapshots"("fetched_at");

-- CreateIndex
CREATE INDEX "sync_runs_source_endpoint_idx" ON "sync_runs"("source", "endpoint");

-- CreateIndex
CREATE INDEX "sync_runs_status_idx" ON "sync_runs"("status");

-- AddForeignKey
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_tracks" ADD CONSTRAINT "circuit_tracks_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_descriptions" ADD CONSTRAINT "circuit_descriptions_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_assets" ADD CONSTRAINT "circuit_assets_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_assets" ADD CONSTRAINT "circuit_assets_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "circuit_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_legacy_mappings" ADD CONSTRAINT "event_legacy_mappings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedule_days" ADD CONSTRAINT "event_schedule_days_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_documents" ADD CONSTRAINT "event_documents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_urls" ADD CONSTRAINT "event_urls_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_entries" ADD CONSTRAINT "rider_season_entries_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_entries" ADD CONSTRAINT "rider_season_entries_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_entries" ADD CONSTRAINT "rider_season_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_entries" ADD CONSTRAINT "rider_season_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_entries" ADD CONSTRAINT "rider_season_entries_constructor_id_fkey" FOREIGN KEY ("constructor_id") REFERENCES "constructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_images" ADD CONSTRAINT "rider_season_images_rider_season_entry_id_fkey" FOREIGN KEY ("rider_season_entry_id") REFERENCES "rider_season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_statistics" ADD CONSTRAINT "rider_season_statistics_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_statistics" ADD CONSTRAINT "rider_season_statistics_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_statistics" ADD CONSTRAINT "rider_season_statistics_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_statistics" ADD CONSTRAINT "rider_season_statistics_constructor_id_fkey" FOREIGN KEY ("constructor_id") REFERENCES "constructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_season_statistics" ADD CONSTRAINT "rider_season_statistics_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_constructor_id_fkey" FOREIGN KEY ("constructor_id") REFERENCES "constructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_constructor_id_fkey" FOREIGN KEY ("constructor_id") REFERENCES "constructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmw_award_standings" ADD CONSTRAINT "bmw_award_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmw_award_standings" ADD CONSTRAINT "bmw_award_standings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmw_award_standings" ADD CONSTRAINT "bmw_award_standings_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmw_award_standings" ADD CONSTRAINT "bmw_award_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bmw_award_standings" ADD CONSTRAINT "bmw_award_standings_constructor_id_fkey" FOREIGN KEY ("constructor_id") REFERENCES "constructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_timing_snapshots" ADD CONSTRAINT "live_timing_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rider_timings" ADD CONSTRAINT "live_rider_timings_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "live_timing_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rider_timings" ADD CONSTRAINT "live_rider_timings_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
