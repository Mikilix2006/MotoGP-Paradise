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
    BmwAwardStanding


    RIDER HISTORY
    ─────────────

    RiderSeasonEntry
    RiderSeasonImage
    RiderSeasonStatistics


    DATA INGESTION
    ──────────────

    ApiSnapshot
    SyncRun


    LIVE TIMING (sin importador todavía)
    ───────────

    LiveTimingSnapshot
    LiveRiderTiming

 
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


# Endpoint → tablas

El esquema tiene 27 modelos. Cada importador (`src/services/importers/`) lo ejecuta un script de `npm run` (ver README, sección 20). `MOTOGP_RESULTS_API_URL` = API de resultados; `MOTOGP_API_URL` = API general.

| Script | API | Endpoint | Rellena |
|---|---|---|---|
| `import:seasons` | resultados | `/seasons` | `Season` |
| `import:events` | resultados | `/events?seasonUuid=` | `Country`, `Circuit`, `Event`, `EventLegacyMapping`, `EventDocument` |
| `import:event-categories` | resultados | `/categories?eventUuid=` | `Category`, `EventCategory` |
| `import:sessions` | resultados | `/sessions?eventUuid=&categoryUuid=` | `Session` (incluidas las condiciones de pista) |
| `import:event-details` | general | `/events?seasonYear=` | `CircuitTrack`, `CircuitAsset`, `CircuitDescription`, `EventScheduleDay`, `EventUrl`; completa `Circuit`, `Event` (zona horaria, orden y `flagUrl` desde el asset `FLAG`), `Category` y `Session` (emparejando `broadcasts` con las sesiones) |
| `import:session-results` | resultados | `/session/{resultsUuid}/classification?seasonYear=` (+ `&test=true` en tests) | `SessionResult`, `Rider`, `Team`, `Constructor` |
| `import:riders` | general | `/riders?seasonUuid=` y `/riders/{uuid}` | `RiderSeasonEntry`, `RiderSeasonImage`; completa `Rider`, `Team` y `Country.flagUrl` (desde `country.flag` de la ficha) |
| `import:rider-statistics` | general | `/riders/{legacyId}/statistics` | `RiderSeasonStatistics` |
| `import:championship-standings` | resultados | `/standings?seasonUuid=&categoryUuid=` | `ChampionshipStanding` |
| `import:bmw-award` | resultados | `/standings/bmwaward?seasonUuid=` | `BmwAwardStanding` |
| `sync:sessions` / `watch:sessions` | ambas | los de sesiones, resultados, estadísticas y clasificaciones, acotados al fin de semana en curso | Lo mismo que los scripts anteriores, para los eventos activos (`liveSessionSync.ts`) |

`ApiSnapshot` (respuesta cruda) solo la guardan `eventDetailsImporter` y `championshipStandingImporter`; `SyncRun` lo registran todos los `import:*` y la sincronización en vivo. `LiveTimingSnapshot` y `LiveRiderTiming` no tienen endpoint ni importador todavía.
