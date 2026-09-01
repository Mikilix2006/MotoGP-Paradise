# DATABASE_IMPLEMENTATION_PLAN.md

# MotoGP Stats --- Plan de implementación de la base de datos

## 1. Objetivo

Este documento define el plan técnico para implementar la base de datos
de MotoGP Stats a partir del modelo conceptual aprobado.

La base de datos deberá permitir:

-   importar los datos de los endpoints recopilados;
-   conservar identificadores externos y relaciones entre las fuentes de
    MotoGP;
-   consultar rápidamente temporadas, eventos, circuitos, sesiones,
    pilotos y clasificaciones;
-   conservar información histórica;
-   almacenar respuestas originales para futuras ampliaciones;
-   ejecutar sincronizaciones repetibles e idempotentes;
-   desacoplar el frontend de las APIs externas.

## 2. Decisiones técnicas

### Base de datos

PostgreSQL.

### ORM

Prisma.

### Identificadores

Cada entidad tendrá un identificador interno propio y conservará los
identificadores externos disponibles, por ejemplo:

-   UUID de MotoGP;
-   `legacy_id`;
-   `timing_id`;
-   `riders_api_uuid`;
-   `riders_id`;
-   UUIDs específicos de Results y Broadcast.

Regla: un `legacy_id` no será la clave primaria interna.

## 3. Principios de importación

### 3.1 No copiar endpoints directamente

La base de datos representa entidades del dominio, no respuestas HTTP.

``` text
Results Event ─┐
               ├──> Event normalizado
Broadcast Event┘
```

### 3.2 Upsert

Las sincronizaciones deben poder repetirse sin crear duplicados.

``` text
Existe → actualizar
No existe → crear
```

### 3.3 Datos normalizados + snapshots

Se almacenarán dos niveles:

``` text
API Response
    ├── Snapshot JSONB
    └── Normalización → tablas relacionales
```

## 4. Orden de implementación

### Fase 1 --- Infraestructura

-   PostgreSQL
-   Prisma
-   variables de entorno
-   cliente Prisma
-   migración inicial

### Fase 2 --- Datos maestros

-   Country
-   Season
-   Category
-   Constructor
-   Team
-   Rider
-   Circuit

### Fase 3 --- Eventos

-   Event
-   EventLegacyMapping
-   EventCategory
-   EventScheduleDay
-   EventDocument
-   EventUrl

### Fase 4 --- Circuitos enriquecidos

-   CircuitTrack
-   CircuitDescription
-   CircuitAsset

### Fase 5 --- Sesiones

-   Session

### Fase 6 --- Datos históricos de pilotos

-   RiderSeasonEntry
-   RiderSeasonImage
-   RiderSeasonStatistics

### Fase 7 --- Resultados y clasificaciones

-   SessionResult
-   ChampionshipStanding
-   BmwAwardStanding

### Fase 8 --- Datos en tiempo real

-   LiveTimingSnapshot
-   LiveRiderTiming

## 5. Modelo de datos

### Country

``` text
id
iso
name
region_iso
created_at
updated_at
```

`iso` será único.

### Season

``` text
id
motogp_uuid
year
name
current
created_at
updated_at
```

Restricciones:

``` text
UNIQUE(motogp_uuid)
UNIQUE(year)
```

### Category

``` text
id
motogp_uuid
legacy_id
name
acronym
timing_id
priority
active
created_at
updated_at
```

### Circuit

``` text
id
motogp_uuid
legacy_id
name
place
nation
country_id
latitude
longitude
created_at
updated_at
```

Relación:

``` text
Country 1 ─── N Circuit
```

### CircuitTrack

``` text
id
motogp_uuid
circuit_id
name
length_meters
length_km
length_miles
length_feet
width_meters
longest_straight_meters
left_corners
right_corners
total_corners
first_grid
box_entry
box_exit
created_at
updated_at
```

### CircuitDescription

``` text
id
motogp_uuid
circuit_id
language
business_unit_id
description
created_at
updated_at
```

### CircuitAsset

``` text
id
motogp_uuid
circuit_id
track_id
name
type
path
mime_type
created_at
updated_at
```

## 6. Modelo de eventos

### Event

Representa una edición concreta de un Gran Premio dentro de una
temporada.

``` text
id
results_uuid
broadcast_uuid
toad_api_uuid
season_id
circuit_id
country_id
name
sponsored_name
additional_name
short_name
date_start
date_end
status
sequence
is_test
time_zone
created_at
updated_at
```

Relaciones:

``` text
Season  1 ─── N Event
Circuit 1 ─── N Event
Country 1 ─── N Event
```

### EventLegacyMapping

``` text
id
event_id
category_legacy_id
event_legacy_id
```

### EventCategory

``` text
id
event_id
category_id
num_laps
sprint_num_laps
distance_meters
distance_km
red_flag_laps
sprint_red_flag_laps
sequence
created_at
updated_at
```

### EventScheduleDay

``` text
id
event_id
date_start
name
day
month
day_suffix
gp_day
created_at
updated_at
```

### EventDocument

``` text
id
event_id
type
url
menu_position
created_at
updated_at
```

### EventUrl

``` text
id
event_id
language
type
url
created_at
updated_at
```

## 7. Sesiones

### Session

``` text
id
results_uuid
broadcast_uuid
event_id
category_id
shortname
name
type
kind
status
date_start
date_end
num_laps
progressive
gp_day
timing_id
has_timing
has_live
has_report
has_results
has_on_demand
is_live
is_live_timing
created_at
updated_at
```

Índice prioritario:

``` text
(event_id, category_id, type, date_start)
```

## 8. Pilotos y estructura histórica

### Rider

``` text
id
motogp_uuid
legacy_id
riders_api_uuid
riders_id
first_name
last_name
full_name
birth_date
birth_city
country_id
start_year
legend
created_at
updated_at
```

### Team

``` text
id
motogp_uuid
legacy_id
name
type
color
text_color
background_picture
picture
created_at
updated_at
```

### Constructor

``` text
id
motogp_uuid
legacy_id
name
created_at
updated_at
```

### RiderSeasonEntry

``` text
id
motogp_uuid
rider_id
season_id
category_id
team_id
constructor_id
number
sponsored_team
in_grid
current
short_nickname
type
created_at
updated_at
```

Restricción:

``` text
UNIQUE(rider_id, season_id, category_id)
```

### RiderSeasonImage

``` text
id
rider_season_entry_id
type
main_url
secondary_url
created_at
updated_at
```

### RiderSeasonStatistics

``` text
id
rider_id
season_id
category_id
constructor_id
starts
wins
second_places
third_places
podiums
poles
points
championship_position
created_at
updated_at
```

## 9. Resultados

### SessionResult

``` text
id
session_id
rider_id
team_id
constructor_id
position
position_text
points
laps_completed
time
gap
status
fastest_lap
average_speed
top_speed
grid_position
created_at
updated_at
```

Restricción:

``` text
UNIQUE(session_id, rider_id)
```

### ChampionshipStanding

``` text
id
season_id
category_id
event_id
rider_id
team_id
constructor_id
position
points
snapshot_at
created_at
```

### BmwAwardStanding

``` text
id
season_id
event_id
rider_id
team_id
constructor_id
position
points
fetched_at
created_at
```

## 10. Datos en tiempo real

### LiveTimingSnapshot

``` text
id
session_id
fetched_at
payload JSONB
payload_hash
```

### LiveRiderTiming

``` text
id
snapshot_id
rider_id
position
lap
lap_time
gap_first
gap_previous
last_lap_time
last_lap
on_pit
status
```

## 11. Infraestructura de sincronización

### ApiSnapshot

``` text
id
source
endpoint
request_parameters
entity_type
entity_external_id
fetched_at
payload JSONB
payload_hash
```

Fuentes previstas:

``` text
RESULTS
BROADCAST
TIMING
```

### SyncRun

``` text
id
source
endpoint
started_at
finished_at
status
records_processed
records_created
records_updated
error_message
created_at
```

Estados:

``` text
RUNNING
SUCCESS
FAILED
PARTIAL
```

## 12. Arquitectura del código

``` text
src/
├── lib/
│   ├── prisma.ts
│   └── config.ts
├── services/
│   ├── motogp/
│   │   ├── resultsClient.ts
│   │   ├── broadcastClient.ts
│   │   └── timingClient.ts
│   ├── importers/
│   ├── normalizers/
│   └── queries/
└── app/
    └── api/
```

Flujo:

``` text
API Client
    ↓
Raw Response
    ↓
Normalizer
    ↓
Importer
    ↓
Prisma / PostgreSQL
```

## 13. Estrategia de sincronización inicial

Orden recomendado:

``` text
1. Seasons
2. Events
3. Categories
4. Circuits
5. Event enrichment
6. Sessions
7. Riders
8. Teams and Constructors
9. Statistics
10. Standings and Results
```

Dependencias:

``` text
Season
   ↓
Event
   ↓
EventCategory
   ↓
Session
   ↓
SessionResult
```

## 14. Idempotencia

Todos los importadores deberán:

-   buscar por identificador externo;
-   actualizar cuando exista el registro;
-   crear cuando no exista;
-   utilizar restricciones únicas;
-   evitar duplicados en relaciones.

## 15. Transacciones

Cuando una importación afecte a varias entidades relacionadas se
utilizarán transacciones.

Ejemplo:

``` text
Event
 ├── Circuit
 ├── EventCategory
 └── Sessions
```

Las importaciones masivas deberán dividirse en lotes razonables.

## 16. Índices prioritarios

``` text
Season.year
Season.current

Event.results_uuid
Event.broadcast_uuid
Event.season_id
Event.circuit_id
Event.status
Event.date_start

Session.results_uuid
Session.event_id
Session.category_id
Session.date_start
Session.status

Rider.motogp_uuid
Rider.legacy_id

RiderSeasonEntry(rider_id, season_id, category_id)

SessionResult(session_id, rider_id)

ChampionshipStanding(season_id, category_id, event_id)
```

## 17. Consultas que debe soportar

### Próximo GP

``` text
Season actual
   ↓
Evento CURRENT
   ↓
Fallback NOT-STARTED
   ↓
Circuito + sesiones MotoGP
```

### Cuenta atrás

``` text
Session.date_start de la carrera principal
```

### Información del circuito

``` text
Event → Circuit → CircuitTrack
```

### Sprint

``` text
Session de MotoGP
identificada como Sprint
```

### Clasificación

``` text
ChampionshipStanding
```

### Perfil histórico

``` text
Rider
   ↓
RiderSeasonEntry
   ↓
RiderSeasonStatistics
```

## 18. Variables de entorno

``` env
DATABASE_URL=
MOTOGP_RESULTS_API_URL=
MOTOGP_BROADCAST_API_URL=
MOTOGP_TIMING_API_URL=
```

## 19. Scripts previstos

``` text
scripts/
├── import-seasons.ts
├── import-events.ts
├── import-season.ts
├── import-circuits.ts
├── import-sessions.ts
├── import-riders.ts
├── import-statistics.ts
└── sync-current-season.ts
```

## 20. Plan de ejecución

### Sprint 1 --- Base

-   [ ] Crear PostgreSQL
-   [ ] Instalar Prisma
-   [ ] Crear `schema.prisma`
-   [ ] Crear primera migración
-   [ ] Crear cliente Prisma

### Sprint 2 --- Datos maestros

-   [ ] Country
-   [ ] Season
-   [ ] Category
-   [ ] Circuit
-   [ ] Rider
-   [ ] Team
-   [ ] Constructor

### Sprint 3 --- Eventos

-   [ ] Event
-   [ ] EventCategory
-   [ ] EventScheduleDay
-   [ ] EventDocument
-   [ ] EventLegacyMapping

### Sprint 4 --- Enriquecimiento

-   [ ] CircuitTrack
-   [ ] CircuitAsset
-   [ ] CircuitDescription
-   [ ] EventUrl

### Sprint 5 --- Competición

-   [ ] Session
-   [ ] SessionResult
-   [ ] ChampionshipStanding
-   [ ] BmwAwardStanding

### Sprint 6 --- Historial

-   [ ] RiderSeasonEntry
-   [ ] RiderSeasonImage
-   [ ] RiderSeasonStatistics

### Sprint 7 --- Sincronización

-   [ ] ApiSnapshot
-   [ ] SyncRun
-   [ ] Importers
-   [ ] Normalizers
-   [ ] Scripts

### Sprint 8 --- Migración de la aplicación

-   [ ] `/api/next-gp` desde base de datos
-   [ ] `/api/riders/standings` desde base de datos
-   [ ] páginas de pilotos desde base de datos
-   [ ] páginas de eventos desde base de datos

## 21. Resultado final esperado

``` text
MotoGP APIs
    │
    ▼
Synchronization jobs
    │
    ├── Raw snapshots
    │
    └── Normalized PostgreSQL
                │
                ▼
          Internal services
                │
                ▼
           Next.js API
                │
                ▼
             Frontend
```

La aplicación dejará progresivamente de depender de una cadena de
llamadas externas en cada carga de página. La API externa pasará a
alimentar un sistema de sincronización, mientras que el frontend
consultará una base de datos propia.
