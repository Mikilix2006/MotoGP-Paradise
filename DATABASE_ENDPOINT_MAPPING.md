    REFERENCE DATA
    ──────────────

    Country
    Season
    Category
    Rider
    Team
    Constructor


    VENUES
    ──────

    Circuit
    CircuitTrack
    CircuitDescription
    CircuitAsset


    EVENTS
    ──────

    Event
    EventLegacyMapping
    EventCategory
    EventScheduleDay
    EventDocument
    EventUrl


    COMPETITION
    ───────────

    Session
    SessionResult
    ChampionshipStanding


    RIDER HISTORY
    ─────────────

    RiderSeason
    RiderSeasonStatistics


    DATA INGESTION
    ──────────────

    ApiEndpoint
    ApiSnapshot
    SyncRun
    SyncError

 
                      COUNTRY
                         │
                         │
                      CIRCUIT
                         │
            ┌────────────┼────────────┐
            │            │            │
          TRACK     DESCRIPTION      ASSET
            │
            │
    SEASON ── EVENT ───────── EVENT CATEGORY ───── SESSION
    │       │                     │                 │
    │       │                     │                 │
    │       ├── SCHEDULE          CATEGORY      SESSION RESULT
    │       │
    │       ├── DOCUMENT
    │       │
    │       └── URL
    │
    │
    └──── RIDER SEASON ENTRY
                │
        ┌──────┼───────┐
        │      │       │
        RIDER   TEAM  CONSTRUCTOR
        │
        ├── SEASON IMAGE
        │
        └── SEASON STATISTICS




    MotoGP API
        │
        ▼
    IMPORTERS
        │
        ├── Results Importer
        └── Broadcast Importer
                │
                ▼
        NORMALIZATION LAYER
                │
                ▼
            PostgreSQL
                │
        ┌─────┴─────┐
        ▼           ▼
    Normalized     Raw JSON
        tables       Snapshots
                │
                ▼
        Internal API Next.js
                │
                ▼
            Frontend