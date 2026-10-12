# Graph Report - motogp-stats  (2026-10-12)

## Corpus Check
- 92 files · ~70,459 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .service 3, .example 2, (none) 2)

## Summary
- 637 nodes · 1197 edges · 31 communities (22 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.84)
- Token cost: 166,036 input · 0 output

## Community Hubs (Navigation)
- Agentes y documentación
- Páginas y componentes UI
- Rutas API y config Next
- Repositorio de favoritos GP
- Importador detalles de evento
- Dependencias del paquete
- Servidor Dinahosting (app.js)
- Vista de calendario
- Importador clasificación campeonato
- Scripts npm
- Componente favoritos GP
- Resultados y resolución de pilotos
- Configuración TypeScript
- Prisma, temporadas y categorías
- Sincronización en directo
- CLIs de importación
- Importador premio BMW
- Importadores eventos y sesiones
- Instalación del servidor
- Instalación de release
- Estadísticas de pilotos
- Fusión de pilotos duplicados
- Script de despliegue
- Copia de BD
- Carga de datos

## God Nodes (most connected - your core abstractions)
1. `prisma` - 30 edges
2. `trackSyncRun()` - 23 edges
3. `scripts` - 21 edges
4. `Agente database-guardian` - 19 edges
5. `Agente import-guardian` - 19 edges
6. `compilerOptions` - 16 edges
7. `Agente frontend-guardian` - 15 edges
8. `syncLiveSessions()` - 14 edges
9. `AGENTS.md - guía de coordinación de agentes` - 14 edges
10. `Agente ui-designer` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Estrategia de sincronización inicial` --semantically_similar_to--> `Pipeline de importación en 10 fases (import:*)`  [INFERRED] [semantically similar]
  DATABASE_IMPLEMENTATION_PLAN.md → .claude/agents/import-guardian.md
- `Claves de unión entre las dos APIs (toadApiUuid, legacyId, ridersApiUuid)` --semantically_similar_to--> `Identificadores externos (sección 18)`  [INFERRED] [semantically similar]
  .claude/agents/database-guardian.md → README.md
- `Pipeline de importación en 10 fases (import:*)` --semantically_similar_to--> `Mapa Endpoint → tablas`  [INFERRED] [semantically similar]
  .claude/agents/import-guardian.md → DATABASE_ENDPOINT_MAPPING.md
- `Propuesta ApiResponse<T> / ApiError compartido` --conceptually_related_to--> `Contrato de la API interna ({ data } / { error }, snake_case)`  [INFERRED]
  .claude/agents/typescript-pro.md → README.md
- `main()` --calls--> `importBmwAwardStandings()`  [EXTRACTED]
  scripts/import-bmw-award.ts → src/services/importers/bmwAwardImporter.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Orden del pipeline de importación documentado en varios sitios** — _claude_agents_import_guardian_import_pipeline, database_endpoint_mapping_endpoint_table, readme_import_scripts, database_implementation_plan_initial_sync_order [INFERRED 0.85]
- **Sistema de reparto y traspaso entre agentes** — _claude_agents_database_guardian_database_guardian, _claude_agents_frontend_guardian_frontend_guardian, _claude_agents_ui_designer_ui_designer, _claude_agents_import_guardian_import_guardian, _claude_agents_typescript_pro_typescript_pro, _claude_agents_code_reviewer_code_reviewer, _claude_agents_debugger_debugger, _claude_agents_docs_guardian_docs_guardian [EXTRACTED 1.00]
- **Tratamiento de la hora local del circuito** — readme_session_wall_clock_time, agents_getmadridtimestamp_timezone_debt, readme_wallclocktoinstant, readme_match_broadcasts_to_sessions, agents_wallclocktoinstant_duplication [INFERRED 0.85]

## Communities (31 total, 9 thin omitted)

### Community 0 - "Agentes y documentación"
Cohesion: 0.05
Nodes (68): Agente code-reviewer, Agente database-guardian, Agente debugger, Tabla de trampas ya verificadas, Agente docs-guardian, Agente frontend-guardian, Agente import-guardian, Pipeline de importación en 10 fases (import:*) (+60 more)

### Community 1 - "Páginas y componentes UI"
Cohesion: 0.06
Nodes (44): lucide-react, react, CalendarPage(), metadata, Home(), ChampionshipStats(), ChampionshipStatsData, CircuitTrack (+36 more)

### Community 2 - "Rutas API y config Next"
Cohesion: 0.06
Nodes (42): nextConfig, next, GET(), revalidate, GET(), revalidate, GET(), revalidate (+34 more)

### Community 3 - "Repositorio de favoritos GP"
Cohesion: 0.09
Nodes (48): GET(), revalidate, ConstructorNames, getNextGrandPrixFavorites(), loadConstructorNames(), loadCurrentGrid(), loadRaceResults(), RACE_TYPES (+40 more)

### Community 4 - "Importador detalles de evento"
Cohesion: 0.07
Nodes (38): getSeasonYear(), main(), ApiAsset, ApiBroadcast, ApiBroadcastCategory, ApiCircuit, ApiCircuitDescription, ApiEventDetails (+30 more)

### Community 5 - "Dependencias del paquete"
Cohesion: 0.05
Nodes (37): allowScripts, esbuild@0.28.2, msgpackr-extract@3.0.4, prisma@6.12.0, @prisma/client@6.12.0, @prisma/engines@6.12.0, workerd@1.20260704.1, dependencies (+29 more)

### Community 6 - "Servidor Dinahosting (app.js)"
Cohesion: 0.07
Nodes (25): app, fs, handle, http, loadEnvFile(), next, os, path (+17 more)

### Community 7 - "Vista de calendario"
Cohesion: 0.10
Nodes (29): ApiResponse, CalendarEventData, CalendarView(), EventCard(), formatDate(), formatSessionTime(), formatterCache, getDayKey() (+21 more)

### Community 8 - "Importador clasificación campeonato"
Cohesion: 0.13
Nodes (19): getSeasonYear(), main(), ApiConstructor, ApiRider, ApiStandingItem, ApiStandingsResponse, ApiTeam, ChampionshipStandingImportResult (+11 more)

### Community 9 - "Scripts npm"
Cohesion: 0.10
Nodes (21): scripts, build, dev, fix:duplicate-riders, import:bmw-award, import:championship-standings, import:event-categories, import:event-details (+13 more)

### Community 10 - "Componente favoritos GP"
Cohesion: 0.15
Nodes (17): ApiResponse, COMPONENTS, FavoriteDetails(), formatPercent(), formatPosition(), formatSigned(), GrandPrixFavorites(), ScoreBar() (+9 more)

### Community 11 - "Resultados y resolución de pilotos"
Cohesion: 0.14
Nodes (16): @prisma/client, main(), findRider(), RiderAttributes, RiderIdentity, upsertRider(), ApiClassificationResponse, ApiClassificationResult (+8 more)

### Community 12 - "Configuración TypeScript"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "Prisma, temporadas y categorías"
Cohesion: 0.20
Nodes (11): main(), main(), globalForPrisma, prisma, CurrentSeason, EventCategoryImportResult, importEventCategories(), MotoGPCategoryApi (+3 more)

### Community 14 - "Sincronización en directo"
Cohesion: 0.21
Nodes (15): formatTime(), main(), ONCE, report(), sleep(), DEFAULT_DURATION_MINUTES, findActiveEvents(), findNextSessionStart() (+7 more)

### Community 15 - "CLIs de importación"
Cohesion: 0.28
Nodes (10): main(), main(), getSeasonYear(), main(), main(), getSeasonYearArgument(), importEvents(), refreshEventStatuses() (+2 more)

### Community 16 - "Importador premio BMW"
Cohesion: 0.17
Nodes (14): ApiBmwAwardClassification, ApiBmwAwardResponse, ApiConstructor, ApiCountry, ApiEvent, ApiRider, ApiTeam, BmwAwardImportResult (+6 more)

### Community 17 - "Importadores eventos y sesiones"
Cohesion: 0.16
Nodes (11): EventImportResult, ImportOptions, MotoGPCircuitApi, MotoGPCountryApi, MotoGPEventApi, MotoGPEventFileApi, MotoGPEventLegacyIdApi, ImportOptions (+3 more)

### Community 18 - "Instalación del servidor"
Cohesion: 0.27
Nodes (10): aviso(), DEBIAN_FRONTEND, esperar_pg(), fallo(), info(), node_suficiente(), paso(), PATH (+2 more)

### Community 19 - "Instalación de release"
Cohesion: 0.46
Nodes (6): como_app(), comprobar(), fallo(), info(), paso(), instalar-release.sh script

### Community 20 - "Estadísticas de pilotos"
Cohesion: 0.36
Nodes (6): main(), ApiRiderStatistic, ImportOptions, importRiderStatistics(), normalizeName(), RiderStatisticsImportResult

### Community 21 - "Fusión de pilotos duplicados"
Cohesion: 0.48
Nodes (6): countReferences(), main(), mergeInto(), pickCanonical(), ridersApiUuidOf(), RiderWithCounts

## Knowledge Gaps
- **15 isolated node(s):** `react-dom`, `@types/node`, `@types/react`, `@types/react-dom`, `autoprefixer` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 278 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `Prisma, temporadas y categorías` to `Rutas API y config Next`, `Repositorio de favoritos GP`, `Importador detalles de evento`, `Importador clasificación campeonato`, `Resultados y resolución de pilotos`, `Sincronización en directo`, `CLIs de importación`, `Importador premio BMW`, `Importadores eventos y sesiones`, `Estadísticas de pilotos`, `Fusión de pilotos duplicados`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **What connects `react-dom`, `@types/node`, `@types/react` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Agentes y documentación` be split into smaller, more focused modules?**
  _Cohesion score 0.05352743561030235 - nodes in this community are weakly interconnected._
- **Why does `@prisma/client` connect `Resultados y resolución de pilotos` to `Rutas API y config Next`, `Importador detalles de evento`, `Dependencias del paquete`, `Importador clasificación campeonato`, `Prisma, temporadas y categorías`, `Fusión de pilotos duplicados`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Should `Páginas y componentes UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06038961038961039 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Rutas API y config Next` to `Páginas y componentes UI`, `Repositorio de favoritos GP`, `Dependencias del paquete`, `Servidor Dinahosting (app.js)`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `Rutas API y config Next` be split into smaller, more focused modules?**
  _Cohesion score 0.06033182503770739 - nodes in this community are weakly interconnected._