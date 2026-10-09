# MotoGP Stats

Aplicación de estadísticas de MotoGP construida con **Next.js, TypeScript, PostgreSQL y Prisma**.

El objetivo del proyecto es construir una aplicación que pueda consultar estadísticas de MotoGP de forma rápida e independiente de las APIs externas durante la navegación normal. Para conseguirlo, los datos procedentes de la API de MotoGP se importan, normalizan y almacenan en una base de datos PostgreSQL.

---

# 1. Objetivo del proyecto

MotoGP Stats reúne información histórica y actual sobre:

- temporadas;
- Grandes Premios y eventos;
- circuitos;
- categorías;
- sesiones;
- pilotos;
- equipos;
- constructores;
- resultados de sesiones;
- clasificaciones del campeonato;
- clasificación BMW Award;
- estadísticas históricas de pilotos;
- datos de Live Timing.

La arquitectura está diseñada para separar claramente:

```text
API de MotoGP
      │
      ▼
Importadores / Servicios
      │
      ▼
PostgreSQL + Prisma
      │
      ▼
API Routes de Next.js
      │
      ▼
Componentes React
```

La aplicación no debe depender de consultar continuamente la API externa para cada renderizado. La API externa se utiliza principalmente para **sincronizar e importar datos**, mientras que la aplicación consulta posteriormente la base de datos propia.

---

# Índice

- [1. Objetivo del proyecto](#1-objetivo-del-proyecto)
- [2. Stack tecnológico](#2-stack-tecnológico)
- [3. Arquitectura general](#3-arquitectura-general)
- [Inicio rápido](#inicio-rápido)
- [4. Configuración de entorno](#4-configuración-de-entorno)
- [5. Base de datos y Prisma](#5-base-de-datos-y-prisma)
- [6. Modelo de datos](#6-modelo-de-datos)
- [7. Eventos](#7-eventos)
- [8. Información de circuitos](#8-información-de-circuitos)
- [9. Sesiones](#9-sesiones)
- [10. Resultados de sesión](#10-resultados-de-sesión)
- [11. Estadísticas históricas de pilotos](#11-estadísticas-históricas-de-pilotos)
- [12. Entradas de pilotos por temporada](#12-entradas-de-pilotos-por-temporada)
- [13. Clasificación BMW Award](#13-clasificación-bmw-award)
- [14. Clasificaciones del campeonato](#14-clasificaciones-del-campeonato)
- [15. Live Timing](#15-live-timing)
- [16. Snapshots de API](#16-snapshots-de-api)
- [17. Registro de sincronizaciones](#17-registro-de-sincronizaciones)
- [18. Identificadores externos](#18-identificadores-externos)
- [19. Importaciones realizadas y flujo recomendado](#19-importaciones-realizadas-y-flujo-recomendado)
- [20. Scripts de importación](#20-scripts-de-importación)
- [21. Reglas para los importadores](#21-reglas-para-los-importadores)
- [22. Manejo de datos incompletos](#22-manejo-de-datos-incompletos)
- [23. Consultas utilizadas por la interfaz](#23-consultas-utilizadas-por-la-interfaz)
- [24. Datos del circuito en la interfaz](#24-datos-del-circuito-en-la-interfaz)
- [24.1. Páginas disponibles en la aplicación](#241-páginas-disponibles-en-la-aplicación)
- [25. API interna de la aplicación](#25-api-interna-de-la-aplicación)
- [26. Estructura recomendada del proyecto](#26-estructura-recomendada-del-proyecto)
- [27. Despliegue](#27-despliegue)
- [28. Sincronización futura](#28-sincronización-futura)
- [29. Posibles automatizaciones futuras](#29-posibles-automatizaciones-futuras)
- [30. Principios que debe respetar cualquier IA o desarrollador](#30-principios-que-debe-respetar-cualquier-ia-o-desarrollador)
- [31. Estado conceptual del proyecto](#31-estado-conceptual-del-proyecto)
- [32. Referencia rápida para continuar el desarrollo](#32-referencia-rápida-para-continuar-el-desarrollo)
- [33. Documentación complementaria](#33-documentación-complementaria)

---

# 2. Stack tecnológico

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Lucide React

## Backend

- Next.js Route Handlers
- TypeScript
- Servicios de importación

## Base de datos

- PostgreSQL
- Prisma ORM

## Ejecución de importadores

- Node.js
- `tsx`

---

# 3. Arquitectura general

El proyecto utiliza tres capas principales:

## 3.1 Fuente externa

La información procede de los endpoints de MotoGP.

Las dos variables principales son:

```env
MOTOGP_API_URL="https://api.motogp.pulselive.com/motogp/v1"
MOTOGP_RESULTS_API_URL="https://api.motogp.pulselive.com/motogp/v1/results"
```

Es importante mantener esta diferencia:

```text
MOTOGP_API_URL
https://api.motogp.pulselive.com/motogp/v1
```

y:

```text
MOTOGP_RESULTS_API_URL
https://api.motogp.pulselive.com/motogp/v1/results
```

Los endpoints generales se construyen desde la primera URL y los endpoints de resultados desde la segunda.

---

## 3.2 Capa de importación

Los importadores:

1. consultan la API;
2. validan o transforman la respuesta;
3. resuelven las relaciones;
4. crean o actualizan registros mediante `upsert`;
5. almacenan los datos normalizados;
6. permiten ejecutar importaciones repetidas sin duplicados.

Principio fundamental:

```text
Existe → actualizar
No existe → crear
```

Los importadores deben ser **idempotentes**.

---

## 3.3 Base de datos

La base de datos no es una copia literal de cada endpoint.

Las respuestas externas se transforman a entidades normalizadas.

Ejemplo:

```text
API Event
    │
    ├── Season
    ├── Country
    ├── Circuit
    ├── Event
    ├── EventCategory
    └── EventLegacyMapping
```

De esta manera, una misma entidad puede relacionarse con información procedente de diferentes endpoints.

---

# Inicio rápido

## Requisitos previos

- Node.js 20 o superior;
- PostgreSQL 14 o superior accesible (local, contenedor Docker o servicio gestionado);
- npm.

## Pasos

**1. Instalar dependencias**

```bash
npm install
```

**2. Configurar variables de entorno**

Copiar la plantilla y completar `DATABASE_URL` con la conexión a tu PostgreSQL:

```bash
cp .env.example .env
```

**3. Preparar la base de datos**

```bash
npx prisma generate
npx prisma migrate dev
```

**4. Levantar la aplicación**

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`, pero la base de datos estará vacía hasta ejecutar los importadores.

**5. Importar datos**

Los importadores deben ejecutarse en este orden, ya que cada uno depende de datos creados por el anterior (ver [sección 19](#19-importaciones-realizadas-y-flujo-recomendado) para el detalle de por qué):

```bash
npm run import:seasons
npm run import:events
npm run import:event-categories
npm run import:sessions
npm run import:event-details
npm run import:session-results
npm run import:riders
npm run import:rider-statistics
npm run import:championship-standings
npm run import:bmw-award
```

Todos los importadores excepto `import:seasons` e `import:event-categories` admiten acotar la importación a una sola temporada (sin año recorren todo el histórico, lo que puede tardar horas), lo que es muy recomendable para una primera prueba:

```bash
npm run import:event-details -- 2024
npm run import:riders -- 2024
npm run import:championship-standings -- 2024
```

El orden importa: `import:event-details` debe ejecutarse **después** de `import:sessions`, ya que completa las sesiones existentes en lugar de crearlas de nuevo.

Durante la temporada, en lugar de repetir el pipeline a mano, existe la sincronización en vivo (ver [Fase 10](#fase-10--sincronización-en-vivo)):

```bash
npm run sync:sessions     # una pasada: importa lo que haya terminado y sale
npm run watch:sessions    # proceso continuo que vigila el calendario
```

> Nota: el proyecto no cuenta actualmente con una suite de tests automatizados (no existe `npm test`) y ESLint no está instalado ni configurado, así que `npm run lint` no funciona. Las comprobaciones disponibles son `npx tsc --noEmit -p tsconfig.json` (el proyecto está en modo `strict`) y `npx prisma validate` si se ha tocado el esquema.

---

# 4. Configuración de entorno

Copiar la plantilla `.env.example` a `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

MOTOGP_API_URL="https://api.motogp.pulselive.com/motogp/v1"

MOTOGP_RESULTS_API_URL="https://api.motogp.pulselive.com/motogp/v1/results"
```

No se debe subir el archivo `.env` a un repositorio público.

---

# 5. Base de datos y Prisma

La base de datos utiliza PostgreSQL y Prisma.

Comandos habituales:

```bash
npx prisma validate
```

Valida el esquema.

```bash
npx prisma generate
```

Genera Prisma Client.

```bash
npx prisma migrate dev
```

Crea y ejecuta migraciones durante desarrollo.

```bash
npx prisma studio
```

Abre Prisma Studio para inspeccionar visualmente los datos.

```bash
npx prisma migrate deploy
```

Aplica las migraciones pendientes sin interactividad (es lo que ejecuta `npm run start:web` antes de arrancar en producción; ver [DEPLOY.md](DEPLOY.md)). `prisma migrate dev` es interactivo y no funciona en entornos no interactivos.

El esquema contiene **27 modelos** y el historial de `prisma/migrations/` es:

| Migración | Cambio |
|---|---|
| `20260831165539_initial_schema` | Esquema inicial |
| `20260831211713_add_bmw_award_unique_constraint` | Restricción única `(seasonId, riderId)` en `BmwAwardStanding` |
| `20260902005742_add_session_conditions_and_standing_unique` | Campos de condiciones de pista en `Session` y restricción única `(seasonId, categoryId, riderId)` en `ChampionshipStanding` |
| `20260911120000_rider_legacy_id_unique` | `Rider.legacyId` pasa a ser único (antes hay que ejecutar `npm run fix:duplicate-riders`) |
| `20261006120000_event_flag_url` | `Event.flagUrl` (columna `flag_url`, opcional) |
| `20261007120000_country_flag_url` | `Country.flagUrl` (columna `flag_url`, opcional) |

---

# 6. Modelo de datos

El esquema Prisma contiene las siguientes entidades principales.

## 6.1 Datos maestros

### Country

Representa países.

Campos principales:

```text
id
iso
name
regionIso
flagUrl
```

`iso` es único.

`flagUrl` es opcional: la URL de la bandera del país tal como la publica la API general (SVG alojado en `photos.motogp.com`). Solo la rellena `import:riders`, a partir de `country.flag` de la ficha del piloto en la API general, así que los países que no son nacionalidad de ningún piloto importado la tienen vacía. Es independiente de `Event.flagUrl`.

---

### Season

Representa una temporada.

Campos principales:

```text
id
motogpUuid
year
name
current
```

La temporada conserva el UUID externo de MotoGP y utiliza `year` como valor único.

Relaciones principales:

```text
Season
 ├── Events
 ├── RiderSeasonEntries
 ├── RiderSeasonStatistics
 ├── ChampionshipStandings
 └── BmwAwardStandings
```

---

### Category

Representa categorías como:

- MotoGP™
- Moto2™
- Moto3™

Campos principales:

```text
motogpUuid
legacyId
name
acronym
timingId
priority
active
```

---

### Rider

Representa pilotos.

Los pilotos conservan los diferentes identificadores disponibles desde las APIs, incluyendo identificadores UUID y `legacy_id`. `legacyId` es **único** y es la clave de identidad del piloto (el único identificador estable en las dos APIs); todos los importadores resuelven pilotos a través de `src/services/importers/riderResolver.ts` (`findRider` / `upsertRider`) y `npm run fix:duplicate-riders` fusiona los duplicados históricos. El país del piloto (`countryId`) enlaza con `Country`, de donde la interfaz toma la bandera.

Un piloto puede tener información relacionada con:

- temporadas;
- resultados;
- estadísticas;
- clasificaciones;
- BMW Award;
- Live Timing.

---

### Team

Representa equipos.

Campos principales:

```text
motogpUuid
legacyId
name
type
color
textColor
backgroundPicture
picture
```

---

### Constructor

Representa constructores o fabricantes.

Ejemplos:

- Ducati
- Honda
- Yamaha
- Aprilia
- KTM

Campos principales:

```text
motogpUuid
legacyId
name
```

---

### Circuit

Representa circuitos.

Campos principales:

```text
motogpUuid
legacyId
name
place
nation
countryId
latitude
longitude
```

Un circuito puede tener:

```text
Circuit
 ├── CircuitTrack
 ├── CircuitDescription
 ├── CircuitAsset
 └── Events
```

---

# 7. Eventos

## Event

Representa un Gran Premio, evento o test.

Conserva distintos UUIDs externos:

```text
resultsUuid
broadcastUuid
toadApiUuid
```

También almacena:

```text
seasonId
circuitId
countryId

name
sponsoredName
additionalName
shortName

dateStart
dateEnd

status
sequence
isTest
timeZone
flagUrl
```

`timeZone` es la zona horaria IANA del circuito (la API la entrega en mayúsculas, p. ej. `ASIA/TOKYO`; `Intl` la acepta tal cual). `flagUrl` es opcional: la URL de la bandera oficial del Gran Premio (asset `FLAG` de `/events?seasonYear=` en la API general, p. ej. `https://photos.motogp.com/countries/flags/iso2/jpn.svg`), que rellena `import:event-details`; los eventos sin asset `FLAG` (p. ej. actos que no son un GP) la dejan vacía.

Relaciones:

```text
Event
 ├── Season
 ├── Circuit
 ├── Country
 ├── EventLegacyMapping
 ├── EventCategory
 ├── EventScheduleDay
 ├── EventDocument
 ├── EventUrl
 ├── Session
 ├── RiderSeasonStatistics
 ├── ChampionshipStanding
 └── BmwAwardStanding
```

---

## EventLegacyMapping

Permite almacenar la relación entre un evento interno y sus identificadores legacy específicos por categoría.

```text
eventId
categoryLegacyId
eventLegacyId
```

---

## EventCategory

Relaciona un evento con una categoría.

Campos principales:

```text
eventId
categoryId

numLaps
sprintNumLaps

distanceMeters
distanceKm

redFlagLaps
sprintRedFlagLaps

sequence
```

Este modelo es especialmente importante para datos como:

- número de vueltas;
- número de vueltas de Sprint;
- distancia;
- configuración específica de cada categoría.

---

# 8. Información de circuitos

## CircuitTrack

Almacena características físicas del circuito.

Entre otros datos:

```text
lengthMeters
lengthKm
lengthMiles
lengthFeet

widthMeters
longestStraightMeters

leftCorners
rightCorners
totalCorners

firstGrid
```

Estos datos alimentan información visual de la aplicación, como:

- longitud en kilómetros;
- número de curvas;
- otras estadísticas del trazado.

---

## CircuitDescription

Almacena descripciones del circuito en diferentes contextos o idiomas cuando estén disponibles.

---

## CircuitAsset

Almacena recursos asociados a circuitos, incluyendo imágenes y SVG.

Un ejemplo de asset procedente de MotoGP puede tener una estructura equivalente a:

```json
{
  "name": "ara2-info.svg",
  "type": "INFO",
  "path": "https://..."
}
```

Los assets permiten mostrar información gráfica del circuito en la interfaz.

---

# 9. Sesiones

## Session

Representa sesiones individuales dentro de un evento.

Ejemplos:

- Practice
- FP
- Qualifying
- Q1
- Q2
- Sprint
- Race
- Warm Up
- Test

Una sesión puede estar relacionada con:

```text
Event
Category
SessionResult
```

Los UUIDs de Results son especialmente importantes para consultar clasificaciones.

También guarda las condiciones de pista que publica la API de resultados:

```text
conditionTrack
conditionAir
conditionHumidity
conditionGround
conditionWeather
```

### Hora de las sesiones

`Session.dateStart` y `dateEnd` guardan el **reloj de pared local del circuito** etiquetado como UTC (una hora guardada como `14:00:00Z` significa «las 14:00 en el circuito», no las 14:00 UTC). Ese reloj **incluye el horario de verano local** (contrastado con el campo `events[].broadcasts[].date_start` de la API general, que trae offset, en varios Grandes Premios de 2026: p. ej. España en abril aparece como 14:00 CEST). Para obtener el instante absoluto hay que convertirlo con la zona del circuito (`Event.timeZone`):

```text
wallClockToInstant(date, timeZone)   // src/utils/date.ts, usa Intl y respeta el horario de verano
```

La usa el calendario (`/api/calendar`); `liveSessionSync.ts` tiene su propia función `wallClockToInstant` equivalente para calcular cuándo termina cada sesión.

Hay dos cautelas conocidas:

- `getMadridTimestamp()` (`src/utils/date.ts`), que usan la cuenta atrás y la tarjeta Sprint de la portada, sigue interpretando ese reloj como hora de Madrid, por lo que para los GP fuera de Europa salen desfasadas (deuda conocida, ver `AGENTS.md`).
- Para eventos aún no celebrados, la API de resultados publica a veces un calendario provisional con las sesiones desplazadas varios días (en 2026: QAT, POR y VAL). Cuando alguna sesión de MotoGP cae fuera de `[Event.dateStart, Event.dateEnd]`, el repositorio del calendario (`findProvisionalCorrector`) toma el día de `EventScheduleDay` (por `gpDay`) y la hora de la propia sesión.

---

# 10. Resultados de sesión

Los resultados se obtienen desde rutas como:

```text
/results/session/{resultsUuid}/classification?seasonYear={seasonYear}
```

Para eventos de tipo test se debe utilizar:

```text
/results/session/{resultsUuid}/classification?seasonYear={seasonYear}&test=true
```

Esto es importante porque consultar una sesión de test sin el parámetro adecuado puede devolver:

```json
{
  "error_type": "event_is_test",
  "message": "Event with session ... is a test."
}
```

---

## SessionResult

Representa la clasificación de un piloto en una sesión.

La respuesta externa puede incluir:

```text
position
rider
team
constructor

best_lap
total_laps
top_speed

gap.first
gap.prev

status
```

La importación debe resolver las relaciones con:

```text
Rider
Team
Constructor
Session
```

También se deben conservar los valores específicos de la clasificación.

---

# 11. Estadísticas históricas de pilotos

Endpoint:

```text
/riders/{legacyUuid}/statistics
```

Ejemplo:

```text
/riders/7444/statistics
```

Cada respuesta puede contener estadísticas de diferentes temporadas y categorías:

```json
{
  "season": "2026",
  "category": "MotoGP™",
  "rider": "Marc Marquez",
  "constructor": "Ducati",
  "starts": 11,
  "first_position": 4,
  "second_position": 0,
  "third_position": 0,
  "podiums": 4,
  "poles": 3,
  "points": 237,
  "position": 2
}
```

Estas respuestas se almacenan en `RiderSeasonStatistics`.

La relación lógica principal es:

```text
Rider
  +
Season
  +
Category
  +
Constructor
```

Los campos estadísticos incluyen:

```text
starts
wins                  (first_position de la API)
secondPlaces          (second_position)
thirdPlaces           (third_position)
podiums
poles
points
championshipPosition  (position)
eventId               (opcional)
```

La combinación `(riderId, seasonId, categoryId)` es única.

---

# 12. Entradas de pilotos por temporada

## RiderSeasonEntry

Representa la participación de un piloto en una temporada y categoría.

Relaciones:

```text
Rider
Season
Category
Team
Constructor
```

Permite almacenar información como:

```text
number
sponsoredTeam
inGrid
current
shortNickname
type
```

La combinación:

```text
riderId
seasonId
categoryId
```

debe identificar una participación concreta del piloto.

---

## RiderSeasonImage

Permite almacenar imágenes relacionadas con la participación de un piloto en una temporada.

---

# 13. Clasificación BMW Award

Endpoint:

```text
/results/standings/bmwaward?seasonUuid={seasonUuid}
```

La respuesta contiene:

```text
classification
 ├── position
 ├── rider
 ├── team
 ├── constructor
 ├── points
 └── event
```

Los datos se almacenan en:

```text
BmwAwardStanding
```

Relaciones:

```text
Season
Event
Rider
Team
Constructor
```

Campos principales:

```text
position
points
fetchedAt
```

La combinación `(seasonId, riderId)` es única.

Este endpoint también puede utilizarse como fuente complementaria para identificar pilotos, equipos y constructores presentes en una temporada.

---

# 14. Clasificaciones del campeonato

## ChampionshipStanding

Representa las clasificaciones generales del campeonato.

Está relacionado con:

```text
Season
Event
Category
Rider
Team
Constructor
```

Permite mantener una fotografía de la clasificación correspondiente al punto del campeonato en que se realizó la importación (`snapshotAt`). La combinación `(seasonId, categoryId, riderId)` es única, así que cada importación actualiza la fila del piloto en lugar de añadir otra.

---

# 15. Live Timing

El esquema también contempla:

## LiveTimingSnapshot

Almacena snapshots de información en directo.

## LiveRiderTiming

Almacena información individual de pilotos dentro de un snapshot.

La arquitectura está preparada para:

```text
Snapshot
   │
   ├── timestamp
   ├── sesión/evento
   └── múltiples pilotos
```

Esto permite conservar datos de Live Timing sin mezclar cada actualización con resultados históricos oficiales.

Estas dos tablas existen en el esquema pero **no tienen importador todavía** y están vacías.

---

# 16. Snapshots de API

## ApiSnapshot

Permite almacenar respuestas originales o metadatos asociados a importaciones.

La idea general es:

```text
API Response
    │
    ├── Snapshot JSON
    │
    └── Normalización
           │
           └── Tablas relacionales
```

Esto permite ampliar importadores en el futuro sin perder completamente la información original de una respuesta.

---

# 17. Registro de sincronizaciones

## SyncRun

Registra ejecuciones de procesos de sincronización.

Puede utilizarse para conocer:

- qué importador se ejecutó;
- cuándo comenzó;
- cuándo terminó;
- si falló;
- información adicional sobre la ejecución.

Es importante para una futura sincronización automática y para detectar errores.

---

# 18. Identificadores externos

Uno de los principios más importantes del proyecto es conservar los diferentes identificadores externos.

Ejemplos:

```text
MotoGP UUID
legacy_id
timing_id
riders_id
riders_api_uuid
resultsUuid
broadcastUuid
toadApiUuid
```

No se debe asumir que todos los endpoints utilizan el mismo identificador.

Ejemplo conceptual:

```text
Rider
 ├── internal id
 ├── motogp UUID
 ├── legacy_id
 ├── riders_id
 └── riders_api_uuid
```

Regla fundamental:

> Los identificadores externos sirven para sincronizar datos. Las relaciones internas de la base de datos utilizan las claves internas del modelo.

---

# 19. Importaciones realizadas y flujo recomendado

El proyecto se ha estructurado para importar progresivamente la información.

El orden recomendado es:

## Fase 1 — Temporadas

Importar:

```text
Season
```

Primero se necesitan las temporadas porque muchos endpoints dependen del año o UUID de temporada.

---

## Fase 2 — Eventos

Importar:

```text
Country
Circuit
Event
EventLegacyMapping
```

Los eventos conectan gran parte del resto del modelo.

---

## Fase 3 — Categorías y datos del evento

Importar:

```text
Category
EventCategory
```

Incluye datos como:

- vueltas;
- vueltas Sprint;
- distancias;
- información específica por categoría.

---

## Fase 4 — Sesiones

Importar:

```text
Session
```

Las sesiones deben existir antes de importar clasificaciones.

---

## Fase 5 — Detalles del evento y circuitos

```bash
npm run import:event-details
```

Fuente: `MOTOGP_API_URL` `/events?seasonYear={year}`.

Importar:

```text
CircuitTrack
CircuitDescription
CircuitAsset
EventScheduleDay
EventUrl
```

Además completa datos que la API de resultados no proporciona:

- coordenadas del circuito;
- zona horaria y orden del evento;
- bandera oficial del Gran Premio (`Event.flagUrl`, asset `FLAG` de `/events`);
- acrónimo, prioridad y `timing_id` de las categorías;
- nombre, tipo, vueltas, día de GP y flags de cada sesión.

Se ejecuta después de las sesiones porque las completa en lugar de duplicarlas. La correspondencia entre ambas APIs se resuelve así:

```text
Event.toadApiUuid  ==  id del evento en /events
Category.legacyId  ==  category.timing_id
```

Las sesiones no se emparejan solo por hora, porque `/results/sessions` devuelve la hora local del circuito etiquetada como `+00:00` mientras que `/events` devuelve la hora con su offset real (ver [Hora de las sesiones](#hora-de-las-sesiones)). El emparejamiento (`matchBroadcastsToSessions`) se hace en 4 pasadas: UUID de broadcast, hora exacta, tipo base con orden cronológico dentro del tipo y, por último, orden cronológico (solo si quedan exactamente las mismas sesiones que broadcasts).

Las pasadas por UUID y por hora exacta comprueban además que el tipo de sesión sea compatible (`areTypesCompatible`; `PR`, `P` y `FP` se consideran equivalentes). Evita cruces como el de Catar 2026, donde el calendario provisional de la API de resultados hacía coincidir la hora de una práctica con la de una carrera. Si un `broadcastUuid` quedó guardado por error en otra sesión, se libera antes de reasignarlo (es único). El criterio de salud es que reimportar cree 0 sesiones nuevas.

---

## Fase 6 — Pilotos y resultados

Importar:

```text
Rider
Team
Constructor
SessionResult
```

El endpoint de clasificación de sesión puede aportar datos necesarios para crear o actualizar estas entidades.

---

## Fase 7 — Pilotos y entradas por temporada

```bash
npm run import:riders
```

Fuentes: `/riders?seasonUuid={uuid}` y `/riders/{uuid}`.

Importar:

```text
RiderSeasonEntry
RiderSeasonImage
```

También completa datos del piloto (nombre, apellidos, fecha y ciudad de nacimiento, año de debut, leyenda), del equipo (tipo, colores e imágenes) y del país del piloto (`Country.flagUrl`, a partir de `country.flag` de la ficha `/riders/{uuid}`).

Importante: el `current_career_step` del listado por temporada corresponde **siempre** a la temporada actual, no a la consultada. El historial real está en el `career[]` de la ficha individual, que es lo que se importa.

---

## Fase 8 — Estadísticas de pilotos

Importar:

```text
RiderSeasonStatistics
```

---

## Fase 9 — Clasificaciones

```bash
npm run import:championship-standings
npm run import:bmw-award
```

Importar:

```text
ChampionshipStanding
BmwAwardStanding
```

Las categorías se recorren a partir de las asociadas a los eventos de cada temporada, porque el UUID de categoría de la API de resultados no es el mismo en todas las temporadas.

---

## Fase 10 — Sincronización en vivo

```bash
npm run sync:sessions     # una pasada y termina (cron / Programador de tareas)
npm run watch:sessions    # proceso continuo
```

Es la vía normal durante la temporada: mantiene la base de datos al día durante un fin de semana de carreras sin recorrer el histórico. Lógica en `src/services/importers/liveSessionSync.ts` (`syncLiveSessions`); punto de entrada `scripts/watch-sessions.ts` (`--once` equivale a `sync:sessions`). Cada ciclo:

1. refresca el estado de los eventos de la temporada (`NOT-STARTED` → `CURRENT` → `FINISHED`) con una llamada;
2. localiza los eventos activos (su fin de semana cubre ahora, con un día de margen a cada lado);
3. refresca sus sesiones desde la API de resultados, que es quien las marca como `FINISHED`;
4. importa la clasificación de las sesiones terminadas que aún no la tienen (y reimporta las terminadas hace poco por si hay sanciones);
5. si ha entrado el resultado de una carrera o sprint, encadena las estadísticas de piloto, la clasificación del campeonato y el BMW Award de la temporada.

Es idempotente. Entre sesiones duerme hasta el fin previsto de la siguiente (calculado con la zona horaria del evento); mientras la API no publica una clasificación pregunta cada dos minutos. Solo registra en `SyncRun` (`/live-sync/sessions` o `/live-sync/post-race`) cuando importa algo.

En desarrollo local en Windows corre como tarea programada (`scripts/register-watcher-task.ps1` la registra o, con `-Unregister`, la elimina; el lanzador es `scripts/watch-sessions.ps1`); en producción es el servicio *worker* de Railway (ver [DEPLOY.md](DEPLOY.md)).

La web no usa el estado del evento para elegir el GP a mostrar (MotoGP lo mantiene en `CURRENT` hasta bastante después de la carrera): ver la sección 23.

---

# 20. Scripts de importación

Los scripts se ejecutan mediante `tsx`.

Ejemplo de patrón:

```bash
npm run import:seasons
```

Scripts disponibles, en orden de ejecución:

| Script | Importador | Rellena |
|---|---|---|
| `import:seasons` | `seasonImporter` | `Season` |
| `import:events` | `eventImporter` | `Country`, `Circuit`, `Event`, `EventLegacyMapping`, `EventDocument` |
| `import:event-categories` | `eventCategoryImporter` | `Category`, `EventCategory` |
| `import:sessions` | `sessionImporter` | `Session` (incluidas condiciones de pista) |
| `import:event-details` | `eventDetailsImporter` | `CircuitTrack`, `CircuitAsset`, `CircuitDescription`, `EventScheduleDay`, `EventUrl` y completa `Circuit`, `Event` (incluida `flagUrl`), `Category` y `Session` |
| `import:session-results` | `sessionResultImporter` | `Rider`, `Team`, `Constructor`, `SessionResult` |
| `import:riders` | `riderImporter` | `RiderSeasonEntry`, `RiderSeasonImage` y completa `Rider`, `Team` y `Country.flagUrl` |
| `import:rider-statistics` | `riderStatisticsImporter` | `RiderSeasonStatistics` |
| `import:championship-standings` | `championshipStandingImporter` | `ChampionshipStanding` |
| `import:bmw-award` | `bmwAwardImporter` | `BmwAwardStanding` |

Scripts adicionales, fuera de la cadena anterior:

| Script | Qué hace |
|---|---|
| `sync:sessions` | Una pasada de la sincronización en vivo (`liveSessionSync`, ver [Fase 10](#fase-10--sincronización-en-vivo)) |
| `watch:sessions` | La misma sincronización en proceso continuo (es lo que ejecuta el *worker* de Railway) |
| `fix:duplicate-riders` | Mantenimiento: fusiona las filas duplicadas de `riders` por `legacyId` (`scripts/merge-duplicate-riders.ts`). Idempotente; no registra `SyncRun` |
| `start:web` | `prisma migrate deploy` + `next start` (arranque del servicio web en producción) |
| `package:dinahosting` | Empaqueta la app para el hosting de Dinahosting en `dist/dinahosting/` (`scripts/package-dinahosting.mjs`); ver [DEPLOY_DINAHOSTING.md](DEPLOY_DINAHOSTING.md) |

Todos los `import:*` registran su ejecución en `SyncRun` mediante `trackSyncRun`, y hoy solo `eventDetailsImporter` y `championshipStandingImporter` guardan la respuesta original en `ApiSnapshot` (mediante `saveApiSnapshot`). Todos aceptan el año de temporada como primer argumento (`npm run import:riders -- 2026`) salvo `import:seasons` e `import:event-categories`.

La lógica de importación debe vivir preferiblemente en:

```text
src/services/importers/
```

mientras que los scripts deben actuar como puntos de entrada.

Arquitectura recomendada:

```text
scripts/
    import-seasons.ts
        │
        ▼
src/services/importers/
    seasonImporter.ts
        │
        ▼
Prisma Client
        │
        ▼
PostgreSQL
```

---

# 21. Reglas para los importadores

Cada importador debe:

1. obtener los datos externos;
2. validar que los campos necesarios existen;
3. tolerar campos opcionales;
4. resolver relaciones;
5. utilizar `upsert` cuando sea posible;
6. evitar crear duplicados;
7. mostrar progreso;
8. continuar o informar correctamente de errores;
9. cerrar correctamente Prisma al terminar.

Ejemplo conceptual:

```typescript
await prisma.entity.upsert({
  where: {
    externalUuid: value,
  },
  create: {
    // datos nuevos
  },
  update: {
    // actualización
  },
});
```

---

# 22. Manejo de datos incompletos

Las respuestas históricas de MotoGP no siempre contienen todos los campos.

Por ejemplo, puede ocurrir que un país antiguo tenga:

```text
iso = "YU"
name = null
```

Pero el modelo `Country` requiere un `name`.

Los importadores deben protegerse contra estos casos proporcionando una estrategia consistente, por ejemplo:

```text
name disponible → utilizarlo
name no disponible → conservar nombre existente
si no existe → utilizar un fallback controlado
```

Nunca se debe enviar `null` a un campo obligatorio de Prisma.

---

# 23. Consultas utilizadas por la interfaz

Toda la interfaz lee de PostgreSQL a través de los repositorios de `src/services/db/` (`nextGrandPrixRepository.ts`, `riderStandingsRepository.ts`, `favoritesRepository.ts`, `seasonRepository.ts`); la API externa solo la usan los importadores (`src/services/motogp/`).

La temporada actual es la fila de `Season` con `current = true`.

La selección del próximo Gran Premio (`findCurrentOrNextEventId`, compartida por la portada, los favoritos y el calendario) es:

```text
1. Primer evento de la temporada (por fecha, sin contar tests)
   cuya carrera de MotoGP aún no está FINISHED.
2. Si no hay ninguno (fin de temporada o sesiones sin importar):
   primer evento con estado CURRENT y, si no, con NOT-STARTED.
```

No se usa solo el estado del evento porque MotoGP lo mantiene en `CURRENT` hasta bastante después de la carrera del domingo. Así, durante el fin de semana se muestra el GP en curso y, en cuanto termina la carrera, pasa a ser el siguiente.

---

# 24. Datos del circuito en la interfaz

Para las tarjetas del próximo Gran Premio se utilizan datos como:

```text
totalCorners
lengthKm
laps
```

La procedencia lógica es:

```text
CircuitTrack
    ├── totalCorners
    └── lengthKm

EventCategory
    └── numLaps
```

Para Sprint:

```text
EventScheduleDay / Session
    ├── fecha
    └── hora

EventCategory
    └── sprintNumLaps
```

También pueden utilizarse assets del circuito:

```text
CircuitAsset
    └── INFO SVG
```

---

# 24.1 Páginas disponibles en la aplicación

La aplicación cuenta con las siguientes páginas principales. Todas leen de PostgreSQL a través de las rutas de la [sección 25](#25-api-interna-de-la-aplicación); los componentes son componentes cliente (`"use client"`) que hacen `fetch` a esas rutas.

## Inicio (`/`)

Página principal (`src/app/page.tsx`) con el estado de la temporada actual.

- `NextGrandPrix.tsx` — próximo GP o GP en curso: badge `ROUND N` (o el `short_name` si no hay round), nombre, circuito y lugar, datos del circuito y cuenta atrás. API: `/api/next-gp`
- `ChampionshipStats.tsx` — cifras del campeonato y tarjeta de la Sprint del próximo GP. API: `/api/riders/standings` y `/api/next-gp`
- `RiderStandings.tsx` — clasificación de pilotos de MotoGP, con la bandera del país de cada piloto (`country.flag_url`). API: `/api/riders/standings`
- `GrandPrixFavorites.tsx` — favoritos del próximo GP (índice calculado en `src/services/stats/favoritesModel.ts`). API: `/api/next-gp/favorites`
- `Countdown.tsx` — cuenta atrás usada por `NextGrandPrix`. Tanto ella como la tarjeta Sprint usan `getMadridTimestamp` (ver [Hora de las sesiones](#hora-de-las-sesiones) para la limitación fuera de Europa)

---

## Calendario (`/calendario`)

Página con el calendario completo de la temporada actual (`src/app/calendario/page.tsx`, que monta `CalendarView`).

- Componente: `src/components/CalendarView.tsx`
- API: `/api/calendar`
- Repositorio: `nextGrandPrixRepository.ts`, función `getSeasonEvents()`

Qué muestra:

- una card destacada con el próximo GP (el evento con `is_next_gp`), seguida de la lista de todos los GP de la temporada en orden cronológico;
- en cada card: badge `ROUND N`, bandera del GP (`flag_url`), nombre, circuito y lugar, fechas y una pill de estado (Finalizado, En curso, Próximamente);
- cada card se despliega (con animación) y muestra la tabla de horarios de MotoGP, Moto2 y Moto3, con una columna por día;
- un conmutador **TU HORA** / **HORA LOCAL** (estado compartido por todas las cards de la página, no persistido): «tu hora» convierte los instantes a la zona del navegador y «hora local» a la `time_zone` del circuito.

`CountryFlag.tsx` es el componente compartido de bandera (tamaños `md` y `sm`): las SVG de `photos.motogp.com` usan todas un lienzo de 162×116 con franjas transparentes, así que mide la zona realmente pintada con un `canvas` y recorta tipo *cover*; si no hay URL o la imagen falla, muestra el código ISO. Lo usan `CalendarView` y `RiderStandings`.

---

## Navegación (`Header.tsx`)

Cabecera común a las dos páginas. Es un componente cliente: marca como activo el enlace de la ruta actual (`usePathname`, `aria-current="page"`), el logo enlaza a `/` y en móvil el menú se abre como desplegable. Los enlaces Pilotos, Equipos y Circuitos apuntan a `#` (aún sin página); el selector de año y el icono de búsqueda son decorativos.

---

## Funcionalidades futuras

Las siguientes páginas están planificadas pero no implementadas:

- `/pilotos` - Listado de pilotos con estadísticas
- `/equipos` - Listado de equipos
- `/circuitos` - Información de circuitos

---

# 25. API interna de la aplicación

El frontend consulta únicamente rutas internas de Next.js (`src/app/api/`), que leen de PostgreSQL mediante los repositorios de `src/services/db/`. Todas responden `{ "data": ... }` en éxito y `{ "error": "mensaje en español" }` con el status adecuado en caso contrario, y usan nombres en `snake_case`. Sus tipos están en `src/types/` (`grandPrix.ts`, `rider.ts`, `favorites.ts`).

## Endpoints disponibles

### `/api/next-gp`

Gran Premio actual o próximo (selección descrita en la [sección 23](#23-consultas-utilizadas-por-la-interfaz)). Caché de 60 s. 404 si no hay ninguno y 500 si falla la consulta.

**Respuesta (`data`):**
```json
{
  "id": "...",
  "country": { "iso": "ES", "name": "Spain", "region_iso": "..." },
  "circuit": {
    "id": "...", "name": "...", "legacy_id": 0, "place": "...", "nation": "...", "events_id": null,
    "track": {
      "eventUuid": "...", "lengthKm": 4.4, "totalCorners": 14, "laps": 25,
      "infoImageUrl": "https://...", "sprintDate": "2026-...Z", "sprintLaps": 13
    }
  },
  "sponsored_name": "...",
  "additional_name": "...",
  "name": "...",
  "short_name": "...",
  "flag_url": "https://photos.motogp.com/countries/flags/iso2/...svg",
  "date_start": "2026-10-02",
  "date_end": "2026-10-04",
  "legacy_id": [{ "categoryId": 3, "eventId": 1 }],
  "status": "NOT-STARTED",
  "round": 18,
  "nextMotoGPRace": "2026-...Z",
  "race": { "seasonUuid": "...", "eventUuid": "...", "categoryUuid": "...", "sessionUuid": "..." }
}
```

- `round`: posición cronológica del evento entre los eventos no test de la temporada (`null` si es un test o no tiene fecha). Ya no se deriva de `legacy_id`.
- `flag_url`: `Event.flagUrl`; `null` si no se ha importado.
- `nextMotoGPRace` y `track.sprintDate` son el reloj de pared local del circuito etiquetado como UTC (ver [Hora de las sesiones](#hora-de-las-sesiones)), no instantes absolutos.

---

### `/api/calendar`

Todos los Grandes Premios de la temporada actual (sin tests), ordenados por fecha. Caché de 60 s. 500 si falla la consulta.

**Respuesta (`data`):** array en el que cada elemento tiene todos los campos de `/api/next-gp` (incluidos `round` y `flag_url`) más:

```json
{
  "time_zone": "ASIA/TOKYO",
  "is_next_gp": false,
  "sessions": [
    {
      "id": "...",
      "shortname": "RAC",
      "name": "Grand Prix",
      "type": "RAC",
      "status": "NOT-STARTED",
      "date_start": "2026-09-27T05:00:00.000Z",
      "weekday": 0,
      "category": "MotoGP",
      "category_legacy_id": 3
    }
  ]
}
```

- `time_zone`: zona IANA del circuito, en mayúsculas tal como la importa `import:event-details` (`null` si no hay).
- `is_next_gp`: `true` solo en un evento, con la misma definición que la portada (`findCurrentOrNextEventId`).
- `sessions`: sesiones de Moto3, Moto2 y MotoGP (`category_legacy_id` 1, 2 y 3; `category` es `"Moto3"`, `"Moto2"` o `"MotoGP"`), ordenadas por instante. Se omiten MotoE y las categorías históricas.
- `sessions[].date_start`: **instante absoluto** ISO (UTC) ya convertido con `wallClockToInstant` y `time_zone`; `null` si falta la zona o la fecha.
- `sessions[].weekday`: día de la semana **local del circuito** (0 = domingo … 6 = sábado), para agrupar por días sin depender de la zona del usuario.
- Para eventos con calendario provisional en la API de resultados, el día de cada sesión se corrige con `EventScheduleDay` (`findProvisionalCorrector`, ver [Hora de las sesiones](#hora-de-las-sesiones)). Los duplicados «fantasma» de carreras reiniciadas se descartan.
- Se omiten los eventos sin circuito, sin país o sin carrera de MotoGP con fecha.

---

### `/api/riders/standings`

Clasificación de pilotos de MotoGP de la temporada actual, ordenada por puntos. Caché de 60 s.

**Respuesta (`data`):** array de pilotos con `id`, `full_name`, `country` (`iso`, `name`, `flag_url`), `legacy_id`, `riders_id`, `number`, `team` (`id`, `name`, `legacy_id`) y `statistics` (`constructor`, `starts`, `first_position`, `second_position`, `third_position`, `podiums`, `poles`, `points`, `position`). `country.flag_url` es `Country.flagUrl` (`null` si no se ha importado).

---

### `/api/next-gp/favorites`

Favoritos del próximo GP, calculados a partir de los resultados importados (`favoritesRepository.ts` y `src/services/stats/favoritesModel.ts`). Caché de 300 s. 404 si no hay datos suficientes.

**Respuesta (`data`):** `event` (`id`, `name`, `short_name`, `date_start`, `circuit`), `model.weights` (`circuit`, `form`, `bike`, `reliability`, `trend`) y `favorites[]`, cada uno con `rank`, `rider`, `score`, `win_probability`, `breakdown` (`circuit`, `form`, `bike`, `reliability`, `trend`) y `circuit_history`.

---

El flujo es:

```text
React Component
      │
      ▼
/api/next-gp, /api/calendar, /api/riders/standings, /api/next-gp/favorites
      │
      ▼
src/services/db/*Repository.ts
      │
      ▼
Prisma
      │
      ▼
PostgreSQL
```

Esto evita que cada navegador consulte directamente la API externa de MotoGP.

---

# 26. Estructura recomendada del proyecto

La estructura actual es (puede evolucionar):

```text
motogp-stats/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── scripts/                       Puntos de entrada (import-*.ts, merge-duplicate-riders.ts,
│   │                              watch-sessions.ts) y utilidades de Windows (*.ps1)
│   ├── package-dinahosting.mjs    Empaquetador para Dinahosting (npm run package:dinahosting)
│   ├── dinahosting/               app.js (entrada de Passenger), sync-cron.ts (cron) y htaccess.seguridad
│   ├── deploy/                    volcar-datos.ps1, cargar-datos.sh, filtro-volcado.awk, comprobaciones.sql
│   └── ...
│
├── src/
│   ├── app/
│   │   ├── page.tsx               Inicio (/)
│   │   ├── calendario/page.tsx    Calendario (/calendario)
│   │   └── api/
│   │       ├── next-gp/           route.ts y favorites/route.ts
│   │       ├── calendar/
│   │       └── riders/standings/
│   │
│   ├── components/                NextGrandPrix, ChampionshipStats, RiderStandings,
│   │                              GrandPrixFavorites, CalendarView, Countdown,
│   │                              CountryFlag, Header, StatCard
│   │
│   ├── lib/
│   │   └── prisma.ts
│   │
│   ├── services/
│   │   ├── db/                    Repositorios de lectura que usan las rutas /api
│   │   ├── importers/             Lógica de importación y sincronización en vivo
│   │   ├── motogp/                Clientes de las dos APIs externas (solo los usan los importadores)
│   │   └── stats/                 Modelos estadísticos puros (favoritesModel.ts)
│   │
│   ├── types/                     Formas de respuesta compartidas (grandPrix, rider, favorites)
│   └── utils/
│       └── date.ts                getMadridTimestamp y wallClockToInstant
│
├── .claude/agents/                Agentes (ver AGENTS.md)
├── .env.example
├── .env.production.example        Plantilla de variables de producción (Dinahosting, sin secretos)
├── package.json
├── README.md, AGENTS.md, DEPLOY.md, DEPLOY_DINAHOSTING.md
└── DATABASE_IMPLEMENTATION_PLAN.md, DATABASE_ENDPOINT_MAPPING.md
```

Debe mantenerse la separación entre:

```text
UI
API interna
Servicios
Importadores
Base de datos
```

---

# 27. Despliegue

El despliegue de producción está en Railway con dos servicios sobre la misma base de datos: **web** (`npm run start:web`) y **worker** (`npm run watch:sessions`). El procedimiento completo está en [DEPLOY.md](DEPLOY.md). Para el hosting de Dinahosting, ver [DEPLOY_DINAHOSTING.md](DEPLOY_DINAHOSTING.md).

Para desplegar la aplicación se deben considerar dos componentes separados:

## Aplicación Next.js

La aplicación necesita su proceso de build y ejecución.

En producción normalmente se genera:

```text
.next/
```

Pero `.next/dev` no es una base de datos y no contiene los datos persistentes.

---

## Base de datos PostgreSQL

La base de datos es un servicio independiente.

No basta con subir los archivos de la aplicación.

En producción se necesita:

```text
Servidor / Hosting
    │
    ├── Next.js
    │
    └── PostgreSQL
```

La variable:

```env
DATABASE_URL
```

debe apuntar a la base de datos de producción.

Opciones habituales:

```text
Servidor PostgreSQL propio
Servicio gestionado de PostgreSQL
Contenedor Docker
```

La aplicación y la base de datos pueden estar en la misma máquina o en servicios separados.

---

# 28. Sincronización futura

Una vez completadas las importaciones iniciales, el sistema debería evolucionar hacia sincronizaciones incrementales.

Ejemplo:

```text
Importación histórica completa
        │
        ▼
Base de datos inicial
        │
        ▼
Sincronizaciones periódicas
        │
        ├── temporada actual
        ├── eventos actuales
        ├── sesiones nuevas
        ├── resultados nuevos
        └── clasificaciones actualizadas
```

No es recomendable volver a importar toda la historia continuamente.

La parte de la temporada en curso (eventos actuales, sesiones nuevas, resultados nuevos y clasificaciones actualizadas) ya está implementada en la [Fase 10](#fase-10--sincronización-en-vivo). Lo que sigue pendiente es la sincronización de Live Timing y la reimportación selectiva de temporadas anteriores.

---

# 29. Posibles automatizaciones futuras

Ya existe la sincronización antes y después de sesiones, la actualización de clasificaciones y del próximo GP, y el almacenamiento de snapshots (`ApiSnapshot`); ver la [Fase 10](#fase-10--sincronización-en-vivo). Queda por añadir:

- sincronización diaria;
- Live Timing periódico;
- reimportación selectiva de temporadas;
- detección de cambios mediante `updatedAt` o `fetchedAt`.

---

# 30. Principios que debe respetar cualquier IA o desarrollador

Al trabajar en este proyecto:

1. **No cambiar el esquema de datos arbitrariamente.**
2. **Conservar los identificadores externos de MotoGP.**
3. **No asumir que todos los endpoints usan el mismo UUID.**
4. **Utilizar relaciones internas de PostgreSQL/Prisma.**
5. **Utilizar importaciones idempotentes.**
6. **No duplicar entidades al reimportar.**
7. **Tratar los campos históricos como potencialmente incompletos.**
8. **Distinguir correctamente entre eventos normales y tests.**
9. **Consultar la base de datos desde la interfaz siempre que los datos ya estén importados.**
10. **Mantener separadas las capas de UI, API, servicios e importadores.**
11. **Usar `MOTOGP_API_URL` para endpoints bajo `/v1`.**
12. **Usar `MOTOGP_RESULTS_API_URL` para endpoints bajo `/v1/results`.**
13. **Antes de modificar un importador, comprobar los modelos y relaciones de `schema.prisma`.**
14. **Antes de borrar o recrear datos, considerar que la base de datos contiene información histórica.**

---

# 31. Estado conceptual del proyecto

La arquitectura objetivo es:

```text
MotoGP API
    │
    ▼
Importadores TypeScript
    │
    ▼
Prisma
    │
    ▼
PostgreSQL
    │
    ├── Datos históricos
    ├── Datos actuales
    ├── Resultados
    ├── Clasificaciones
    └── Estadísticas
    │
    ▼
API interna de Next.js
    │
    ▼
React + Next.js
```

La finalidad final es disponer de una aplicación de estadísticas de MotoGP con una base de datos histórica propia, capaz de responder consultas complejas sin depender constantemente de las respuestas en tiempo real de los endpoints externos.

---

# 32. Referencia rápida para continuar el desarrollo

## Si necesitas añadir un endpoint nuevo

1. estudiar la respuesta;
2. identificar las entidades;
3. comprobar si ya existen modelos compatibles;
4. añadir campos o modelos solo si son necesarios;
5. crear el importador;
6. utilizar `upsert`;
7. probar con una temporada pequeña;
8. revisar Prisma Studio;
9. ejecutar una importación histórica;
10. crear consultas internas para la UI.

## Si necesitas modificar la interfaz

1. comprobar qué datos ya existen en PostgreSQL;
2. crear o modificar la ruta API interna;
3. consultar Prisma;
4. transformar los datos en la respuesta necesaria;
5. actualizar el componente React.

## Si un importador falla

Comprobar:

```text
- UUID externo correcto
- endpoint correcto
- seasonYear correcto
- evento test o no test
- campos obligatorios
- relaciones existentes
- Prisma schema
- Prisma Client generado
- DATABASE_URL
```

---

# 33. Documentación complementaria

El proyecto también cuenta con documentos adicionales:

```text
AGENTS.md
DEPLOY.md
DEPLOY_DINAHOSTING.md
DATABASE_IMPLEMENTATION_PLAN.md
DATABASE_ENDPOINT_MAPPING.md
```

`AGENTS.md` define qué agente se ocupa de cada parte del proyecto y las reglas que comparten. `DEPLOY.md` describe el despliegue en Railway (servicios web y worker, variables de entorno y primera carga de datos). [DEPLOY_DINAHOSTING.md](DEPLOY_DINAHOSTING.md) es la guía paso a paso del despliegue en el hosting Linux Profesional de Dinahosting (empaquetado con `npm run package:dinahosting`, plantilla `.env.production.example`, scripts de `scripts/dinahosting/` y `scripts/deploy/`, cron en lugar del worker); solo se ha ejecutado en un servidor real la Fase 0 de comprobaciones (sin Node ni `psql` en el `PATH` de la sesión SSH), el despliegue en sí no, y la propia guía lista lo no verificado.

`DATABASE_IMPLEMENTATION_PLAN.md` describe el plan de implementación y el modelo conceptual de la base de datos.

`DATABASE_ENDPOINT_MAPPING.md` contiene el mapa conceptual de entidades agrupadas por dominio (datos maestros, sedes, eventos, competición, histórico de pilotos, ingesta de datos) y su relación jerárquica.

Este README debe utilizarse como documento de contexto general para entender:

- qué es el proyecto;
- cómo está estructurado;
- cómo se importan los datos;
- cómo se relacionan las entidades;
- cómo deben evolucionar la base de datos y la aplicación.
