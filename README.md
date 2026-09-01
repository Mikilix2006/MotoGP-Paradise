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
npm run import:session-results
npm run import:rider-statistics
npm run import:bmw-award
```

Para una primera prueba se recomienda dejar que termine con el histórico completo de una única temporada antes de lanzar una importación masiva de todas las temporadas.

> Nota: el proyecto no cuenta actualmente con una suite de tests automatizados.

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
```

`iso` es único.

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

Los pilotos conservan los diferentes identificadores disponibles desde las APIs, incluyendo identificadores UUID y `legacy_id`.

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
```

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
firstPosition
secondPosition
thirdPosition
podiums
poles
points
position
```

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

Permite mantener una fotografía de la clasificación correspondiente al punto del campeonato en que se realizó la importación.

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

## Fase 4 — Información enriquecida de circuitos

Importar:

```text
CircuitTrack
CircuitDescription
CircuitAsset
```

Esta fase alimenta datos visuales como:

- kilómetros;
- curvas;
- imágenes SVG.

---

## Fase 5 — Sesiones

Importar:

```text
Session
```

Las sesiones deben existir antes de importar clasificaciones.

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

## Fase 7 — Estadísticas de pilotos

Importar:

```text
RiderSeasonEntry
RiderSeasonStatistics
RiderSeasonImage
```

---

## Fase 8 — Clasificaciones

Importar:

```text
ChampionshipStanding
BmwAwardStanding
```

---

# 20. Scripts de importación

Los scripts se ejecutan mediante `tsx`.

Ejemplo de patrón:

```bash
npm run import:seasons
```

Otros importadores deben seguir una estructura equivalente:

```text
scripts/
    import-seasons.ts
    import-events.ts
    import-...
```

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

La interfaz principal ya ha utilizado datos relacionados con el siguiente Gran Premio.

La lógica de selección es:

```text
1. Buscar evento con estado CURRENT.
2. Si no existe ninguno:
   buscar el primer evento con estado NOT-STARTED.
```

Esto permite que la aplicación siga mostrando el próximo GP aunque no exista un evento actualmente en estado `CURRENT`.

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

# 25. API interna de la aplicación

El frontend debe consultar preferiblemente rutas internas de Next.js.

Ejemplo:

```text
/api/next-gp
```

El flujo recomendado es:

```text
React Component
      │
      ▼
/api/next-gp
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

Una estructura aproximada es:

```text
MotoGP-Paradise/
│
├── prisma/
│   └── schema.prisma
│
├── scripts/
│   ├── import-seasons.ts
│   ├── import-events.ts
│   └── ...
│
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── next-gp/
│   │       └── ...
│   │
│   ├── components/
│   │   ├── NextGrandPrix.tsx
│   │   └── ...
│   │
│   ├── lib/
│   │   └── prisma.ts
│   │
│   └── services/
│       └── importers/
│           ├── seasonImporter.ts
│           ├── eventImporter.ts
│           └── ...
│
├── .env
├── package.json
└── README.md
```

La estructura exacta puede evolucionar, pero debe mantenerse la separación entre:

```text
UI
API interna
Servicios
Importadores
Base de datos
```

---

# 27. Despliegue

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

---

# 29. Posibles automatizaciones futuras

El sistema está preparado para añadir:

- sincronización diaria;
- sincronización antes y después de sesiones;
- actualización de clasificaciones;
- actualización del próximo GP;
- almacenamiento de snapshots;
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

El proyecto también cuenta con documentos adicionales sobre la base de datos:

```text
DATABASE_IMPLEMENTATION_PLAN.md
DATABASE_ENDPOINT_MAPPING.md
```

`DATABASE_IMPLEMENTATION_PLAN.md` describe el plan de implementación y el modelo conceptual de la base de datos.

`DATABASE_ENDPOINT_MAPPING.md` contiene el mapa conceptual de entidades agrupadas por dominio (datos maestros, sedes, eventos, competición, histórico de pilotos, ingesta de datos) y su relación jerárquica.

Este README debe utilizarse como documento de contexto general para entender:

- qué es el proyecto;
- cómo está estructurado;
- cómo se importan los datos;
- cómo se relacionan las entidades;
- cómo deben evolucionar la base de datos y la aplicación.
