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
    RiderBiography


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
        ├── BIOGRAPHY
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

El esquema tiene 28 modelos. Cada importador (`src/services/importers/`) lo ejecuta un script de `npm run` (ver README, sección 20). `MOTOGP_RESULTS_API_URL` = API de resultados; `MOTOGP_API_URL` = API general.

| Script | API | Endpoint | Rellena |
|---|---|---|---|
| `import:seasons` | resultados | `/seasons` | `Season` |
| `import:events` | resultados | `/events?seasonUuid=` | `Country`, `Circuit`, `Event`, `EventLegacyMapping`, `EventDocument` |
| `import:event-categories` | resultados | `/categories?eventUuid=` | `Category`, `EventCategory` (acepta año; en eventos anteriores a 2002 la «500cc» de esta API no renombra la fila MotoGP, ver [Categoría 500cc](#categoría-500cc)) |
| `import:sessions` | resultados | `/sessions?eventUuid=&categoryUuid=` | `Session` (incluidas las condiciones de pista) |
| `import:event-details` | general | `/events?seasonYear=` | `CircuitTrack`, `CircuitAsset`, `CircuitDescription`, `EventScheduleDay`, `EventUrl`; completa `Circuit`, `Event` (zona horaria, orden y `flagUrl` desde el asset `FLAG`), `Category` y `Session` (emparejando `broadcasts` con las sesiones) |
| `import:session-results` | resultados | `/session/{resultsUuid}/classification?seasonYear=` (+ `&test=true` en tests) | `SessionResult`, `Rider`, `Team`, `Constructor`, `Country` (sin `flagUrl`) |
| `import:riders` | general | `/riders?seasonUuid=` y `/riders/{uuid}` | `RiderSeasonEntry` (de `career[]`), `RiderSeasonImage` (solo URL de `photos.motogp.com`), `RiderBiography` (de `biography.text.<idioma>` de la ficha, HTML tal cual, una fila por idioma con texto); completa `Rider`, `Team`, `Constructor` y `Country.flagUrl` (desde `country.flag` de la ficha). Solo llega a los pilotos que devuelve el listado `/riders` |
| `import:rider-statistics` | general | `/riders/{legacyId}/statistics` | `RiderSeasonStatistics` (el año solo acota los pilotos consultados; de cada uno se guardan todas las temporadas; un constructor no resuelto no pisa el ya guardado) |
| `import:championship-standings` | resultados | `/standings?seasonUuid=&categoryUuid=` | `ChampionshipStanding` (solo `upsert`: no borra pilotos que desaparecen) |
| `import:bmw-award` | resultados | `/standings/bmwaward?seasonUuid=` | `BmwAwardStanding` (solo `upsert`: no borra pilotos que desaparecen; `eventId` se pisa con `null` si el evento no se resuelve) |
| `sync:sessions` / `watch:sessions` | ambas | los de eventos (estado), sesiones, resultados, estadísticas y clasificaciones, acotados al fin de semana en curso | Lo mismo que los scripts anteriores, para los eventos activos (`liveSessionSync.ts`) |

Las banderas no tienen importador propio: `Event.flagUrl` y `Country.flagUrl` las rellenan `import:event-details` e `import:riders` (ver README, sección 20, «Banderas»).

`ApiSnapshot` (respuesta cruda) solo la guardan `eventDetailsImporter` y `championshipStandingImporter`; `SyncRun` lo registran todos los `import:*` y la sincronización en vivo. `LiveTimingSnapshot` y `LiveRiderTiming` no tienen endpoint ni importador todavía.

## Categoría 500cc

Hasta 2001 la clase reina llega de forma distinta según el endpoint. La fila «500cc» de `categories` (`legacyId` -1, `motogpUuid` nulo, `active` false, sin acrónimo, `timing_id` ni prioridad) la siembra la migración `20261014120100_category_500cc`; ningún importador la crea, porque `legacy_id` no es único en el esquema y solo la buscan.

| Endpoint | Cómo llega la clase reina (hasta 2001) | Importador | Fila de `categories` |
|---|---|---|---|
| General, `/riders/{uuid}` → `career[].category` | `legacy_id` -1 | `import:riders` | 500cc, por `legacyId` |
| General, `/riders/{legacyId}/statistics` | `category` = «500cc» | `import:rider-statistics` | 500cc, por nombre normalizado (coincidencia exacta; no choca con «motogp») |
| Resultados, `/categories?eventUuid=` (y de ahí sesiones y clasificaciones) | `name` «500cc» con el **mismo uuid y `legacy_id` 3 que MotoGP** | `import:event-categories`, `import:sessions`, `import:championship-standings` | MotoGP (`legacyId` 3, `motogpUuid` no nulo). `eventCategoryImporter` no la renombra: con «500cc» y `legacy_id` 3 solo actualiza `legacyId` |

Consecuencias: `legacyId` 3 es solo MotoGP; la «clase reina» para las cifras son `legacyId` 3 y -1; y las sesiones y clasificaciones anteriores a 2002 siguen colgando de la fila MotoGP mientras las estadísticas e inscripciones usan la 500cc (ver deudas en [AGENTS.md](AGENTS.md)). Como la fila 500cc no tiene `motogpUuid`, los importadores que recorren categorías por ese uuid la saltan.
