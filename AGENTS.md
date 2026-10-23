# AGENTS.md

Guía de coordinación para los agentes que trabajan en **MotoGP Stats**.

Este documento define quién se ocupa de qué, cómo se pasan el trabajo entre ellos y qué reglas comparten todos. El contexto completo del proyecto está en [README.md](README.md); aquí solo está lo necesario para repartir el trabajo correctamente.

---

## El proyecto en tres frases

Aplicación de estadísticas de MotoGP con Next.js, TypeScript, PostgreSQL y Prisma. Los datos de la API pública de MotoGP se importan, normalizan y almacenan en una base de datos propia mediante importadores idempotentes. La aplicación responde desde su propia base de datos: la API externa solo la usan los importadores y la sincronización en vivo, nunca la interfaz.

---

## Estado actual (importante para no romper decisiones deliberadas)

La base de datos se puebla con los importadores y la sincronización en vivo (`sync:sessions` / `watch:sessions`), y **toda la interfaz lee de PostgreSQL** a través de Prisma. La API externa de MotoGP solo la consultan los importadores.

```
     IMPORTACIÓN                              INTERFAZ

     API de MotoGP                            Componentes React ("use client")
          │                                        │ fetch
          ▼                                        ▼
     Importadores                             /api/... (route handlers)
     + sincronización en vivo                       │
          │                                        ▼
          ▼                                   src/services/db/*Repository.ts
     PostgreSQL  ◄──────── Prisma ────────────────┘
```

La interfaz no debe hacer ninguna llamada a la API de MotoGP: si falta un dato, se añade al importador y a la base de datos, no se consulta en caliente.

Decisiones deliberadas de la página `/pilotos` (detalle en el [README](README.md): [Category](README.md#category), [24.1](README.md#pilotos-pilotos) y [`/api/riders/carousel`](README.md#apiriderscarousel)):

- **La clase reina hasta 2001 es la categoría «500cc»** (`legacyId` -1, sembrada por una migración de datos). `legacyId` 3 es solo MotoGP; para cifras de «clase reina» se suman `legacyId` 3 y -1. Cada importador la resuelve de forma distinta (reglas en [DATABASE_ENDPOINT_MAPPING.md](DATABASE_ENDPOINT_MAPPING.md#categoría-500cc)); ningún importador crea esa fila.
- **Imágenes de pilotos: único host `photos.motogp.com`** (`images.remotePatterns` de `next.config.ts`). `next/image` solo se usa en la ficha de `/pilotos` (`RiderSlide`); el resto de la aplicación sigue con `<img>`. Una URL de otro host tumba la página en desarrollo, así que `riderImporter` no la guarda y `riderCarouselRepository` devuelve `image_url` nulo.
- **Biografías: HTML en la base de datos (`rider_biographies`), texto plano al leer** (`htmlToPlainText`). No se renderiza HTML de la API.
- **El carrusel de `/pilotos` solo muestra titulares** (`RiderSeasonEntry.type = 'Official'`); no incluye suplentes. Decisión del usuario.
- **Los países salen en español en las rutas de UI** (`countryNameEs` en `src/utils/country.ts`, con respaldo al nombre de la base de datos).
- **`/api/dev/*` es solo desarrollo**: responde 404 en producción y no escribe nada.

---

## Los agentes

### `database-guardian`

**Se ocupa de:** `prisma/schema.prisma`, las migraciones, restricciones e índices, consultas Prisma complejas, la integridad y limpieza de datos (duplicados, huérfanos) y el rendimiento de PostgreSQL (consultas lentas, índices, mantenimiento, copias).

**Sabe:** las claves de unión ya verificadas entre las dos APIs, por qué las horas no coinciden entre ellas, qué campos cambian según el tipo de sesión y las reglas de idempotencia del proyecto.

**No se ocupa de:** componentes, estilos ni rutas de UI, de ejecutar o escribir importadores (eso es de `import-guardian`) ni de explorar endpoints o campos nuevos de la API de MotoGP (eso es de `motogp-api-scout`).

### `frontend-guardian`

**Se ocupa de:** `src/components/`, `src/app/` (páginas y route handlers), los repositorios de lectura de `src/services/db/`, los estados de carga y error y las decisiones de framework de Next.js (server/client components, caché, metadata, navegación, build y despliegue en Railway o en el VPS de Clouding).

**Sabe:** la arquitectura de datos actual (la UI lee de PostgreSQL vía Prisma), las convenciones de fetching, el formato de respuesta de las rutas internas y la trampa horaria (`Session.dateStart` es el reloj local del circuito; `getMadridTimestamp` queda solo como respaldo).

**No se ocupa de:** decidir la identidad visual (eso es de `ui-designer`) ni de importadores.

### `ui-designer`

**Se ocupa de:** la capa visual, en dos modos. *Diseñar* pantallas y componentes nuevos (páginas, estados de carga/error/vacío, responsive) y *auditar* que cualquier cambio visible mantenga la identidad visual del proyecto (paleta, tipografía, paneles y tarjetas, iconos, estados).

**Sabe:** el sistema visual completo (claro por defecto con modo oscuro conmutable, acento rojo, identidad «racing» con superficies redondeadas con sombra y degradados rojos: `.section` para las secciones de la portada, `.card`/`.panel` para bloques, `.cut`, `.tag`, `.btn-race`/`.btn-ghost`, `.eyebrow` y `.page-title`; titulares en mayúsculas cursiva, tipografía Barlow Condensed + Barlow), la composición de la portada y la deuda de diseño conocida.

**No se ocupa de:** datos (repositorios, rutas, importadores, esquema). Al auditar es revisor, no constructor: corrige solo cuando se le pide, alineándose con un patrón que ya exista.

### `import-guardian`

**Se ocupa de:** ejecutar y encadenar los `npm run import:*`, actualizar la base de datos tras un Gran Premio, rellenar datos que faltan y escribir o modificar importadores (`src/services/importers/`, `scripts/`), incluida la sincronización en vivo (`sync:sessions` / `watch:sessions`). Diagnostica por qué un dato no ha entrado (`SyncRun`, `ApiSnapshot`).

**No se ocupa de:** cambios de esquema o migraciones (`database-guardian`) ni de UI.

### `motogp-api-scout`

**Se ocupa de:** explorar con `curl` las dos APIs de MotoGP **antes** de diseñar un importador o un cambio de esquema que necesite datos nuevos: de qué endpoint sale cada dato, la forma real de la respuesta, los identificadores, cómo se cruzan con lo que ya hay en PostgreSQL y con qué cobertura (cuántos pilotos o temporadas lo tienen), incluida la comprobación de las URL de imágenes. Entrega un informe `logs/api-scout-<tema>.md` con una sección «Propuesta» separada en cambios de esquema (para `database-guardian`) e importación (para `import-guardian`).

**Es de solo lectura:** no edita código, esquema, importadores ni documentación `.md` de referencia, y no escribe en la base de datos. Solo escribe en `logs/` y en `scripts/tmp-*.ts` temporales, y hace peticiones secuenciales, sin ráfagas.

**No se ocupa de:** decidir el modelo (`database-guardian`), escribir o ejecutar importadores (`import-guardian`) ni UI.

### Agentes especialistas

Se invocan para tareas concretas y respetan las fronteras de los anteriores:

- **`typescript-pro`** — tipos: unificar interfaces compartidas, endurecer tipos, errores de `tsc`, tipado de Prisma.
- **`code-reviewer`** — revisión de código de solo lectura (corrección, seguridad, idempotencia, contrato de rutas). No revisa estilo visual.
- **`debugger`** — causa raíz de fallos, aislando la capa (BD → repositorio → ruta → componente) y con las trampas conocidas del proyecto; arregla lo mínimo y traspasa al agente dueño cuando la causa es de su terreno.
- **`docs-guardian`** — mantiene al día toda la documentación `.md` de referencia (`README.md`, `AGENTS.md`, `DEPLOY.md`, `DATABASE_*.md`) contra el código real: compara esquema, migraciones, importadores, scripts, rutas, páginas y agentes con lo documentado y corrige lo obsoleto. Es el único que edita esos documentos. Solo edita documentación: no toca código, esquema, importadores ni configuración y no hace commits; de las definiciones de agentes solo corrige datos factuales que hayan quedado falsos. Si el código parece contradecir una regla documentada, lo reporta en lugar de documentarlo como correcto.

---

## Cómo repartir una tarea

| La tarea toca... | Agente |
|---|---|
| ¿De qué endpoint sale un dato nuevo y con qué cobertura? (forma real de la respuesta, identificadores, imágenes) | `motogp-api-scout`, antes que `database-guardian` |
| Esquema, migración, restricción o índice | `database-guardian` |
| Ejecutar o escribir un importador, actualizar datos tras un GP | `import-guardian` |
| Componente, página, route handler, repositorio de lectura (`src/services/db/`) | `frontend-guardian` |
| Diseñar una pantalla o componente nuevo (aspecto y experiencia) | `ui-designer` |
| Revisar coherencia visual de un cambio ya hecho | `ui-designer` (modo auditar) |
| Interfaces compartidas, errores de tipos, tipado de Prisma | `typescript-pro` |
| Revisar un diff antes de commitear | `code-reviewer` |
| Algo falla y no se sabe por qué | `debugger` |
| "Mostrar en la interfaz un dato nuevo" | Primero `database-guardian` (¿existe el dato en el esquema?); si no está en la base de datos, antes `motogp-api-scout` (¿de qué endpoint sale?) y después `import-guardian`; luego `frontend-guardian`, luego `ui-designer` (auditoría) |
| Documentación (`README.md`, `AGENTS.md`, `DEPLOY.md`, `DATABASE_*.md`) | `docs-guardian` |
| Configuración del repo (no documentación) | Agente principal, sin delegar |

**Regla de frontera:** el contrato entre ambos mundos es la respuesta de las rutas de `src/app/api/`. `database-guardian` es dueño de todo lo que hay por debajo; `frontend-guardian`, de todo lo que hay por encima. Si una tarea exige cambiar ese contrato, dilo explícitamente en el traspaso: qué campos se añaden, con qué nombres y qué tipos.

**Orden de trabajo cuando intervienen varios:** nunca en paralelo sobre los mismos ficheros. Primero los datos (si hay que explorar la API, `motogp-api-scout` va antes que el esquema), después la interfaz, y la revisión visual al final.

---

## Reglas que comparten todos

1. **Nada de cambios de esquema por iniciativa propia.** Si un dato no cabe en el modelo, propón el cambio y espera aprobación. Los cambios deben ser aditivos siempre que sea posible.
2. **Importaciones idempotentes.** Ejecutar un importador dos veces no puede crear filas nuevas la segunda vez.
3. **No asumir que todos los endpoints usan el mismo identificador.** Las dos APIs de MotoGP usan UUID distintos para la misma entidad; se cruzan por `legacyId`/`toadApiUuid`.
4. **Los datos históricos vienen incompletos.** Trata todo campo opcional como potencialmente ausente y nunca envíes `null` a una columna obligatoria.
5. **Todo el texto visible va en español**, mensajes de error incluidos. Los comentarios del código también.
6. **No inventes campos de la API.** Si dudas de la forma real de una respuesta, compruébala con `curl` antes de escribir el mapeo.
7. **Verifica de verdad.** Que compile no es que funcione. Ejecuta lo que has tocado y comprueba los datos o el resultado; si no has podido verificarlo, dilo claramente.
8. **Los ficheros temporales de comprobación** van en `scripts/tmp-*.ts` y se borran al terminar.
9. **La documentación se actualiza antes de dar la tarea por terminada.** Tras cualquier cambio notable (esquema o migraciones, importadores o scripts, rutas `/api`, páginas o componentes visibles, agentes), el agente que lo hizo (o el principal) invoca a `docs-guardian`. Es el único que edita la documentación `.md` de referencia.
10. **Anota en `logs/` lo que el desarrollador debe saber** (datos que no has podido cargar o encontrar, fallos que has visto y no te corresponde arreglar, información relevante), no solo en tu respuesta. Convención en [Carpeta `logs/`](#carpeta-logs).

---

## Carpeta `logs/`

`logs/` está en la raíz del repositorio y **no se versiona** (`.gitignore` ignora `logs/` y `*.log`; también contiene los logs del vigilante de sesiones, `watch-sessions.log`). No es documentación de referencia: los agentes escriben ahí lo que ocurre durante el desarrollo y `docs-guardian` lo lee como contexto, pero verifica todo contra el código antes de documentarlo.

| Fichero | Quién lo escribe | Contenido |
|---|---|---|
| `logs/desarrollo-pilotos.md` | Todos los agentes, a mano | Log de desarrollo de la página `/pilotos`: lo que cada agente descubre y el desarrollador debe saber |
| `logs/api-scout-<tema>.md` (hoy `api-scout-pilotos.md`) | `motogp-api-scout` | Informe de exploración de la API: dato, endpoint, campos, clave de unión, cobertura medida, riesgos y propuesta |
| `logs/imagenes-pilotos.log` | `POST /api/dev/image-issue` (solo desarrollo, al cargar `/pilotos`) | Una línea por imagen de piloto que no se pudo mostrar (`null` o error de carga). No existe hasta que se registra un caso |

Cómo anotar en `logs/desarrollo-pilotos.md`: añade al final una entrada con tu nombre y una línea por hallazgo, marcada con su tipo.

```text
## AAAA-MM-DD · <agente> · <tema>
- [DATO-FALTA | FALLO | INFO] descripción breve (con la ruta o la consulta para reproducirlo)
```

`DATO-FALTA` es un dato que no se ha podido cargar o encontrar, `FALLO` un error o incoherencia, `INFO` cualquier otra cosa relevante.

---

## Comprobaciones

```bash
npx tsc --noEmit -p tsconfig.json   # el proyecto está en strict
npx prisma validate                 # si se ha tocado el esquema
```

ESLint no está instalado ni configurado, así que `npm run lint` no funciona y no es una comprobación válida; tampoco existe `npm test`.

Migraciones: `prisma migrate dev` es interactivo y falla en entornos no interactivos. Usa `prisma migrate diff` para generar el SQL y `prisma migrate deploy` para aplicarlo (procedimiento detallado en `database-guardian`).

---

## Deudas conocidas (no las "arregles" sin hablarlo)

- **Dos copias de `wallClockToInstant`.** `src/utils/date.ts` y `src/services/importers/liveSessionSync.ts` tienen cada una la suya, con comportamiento distinto sin zona horaria (la de `date.ts` exige zona; la de `liveSessionSync` devuelve la hora tal cual).
- **El año 2026 está fijo en la interfaz.** El título de `/calendario` y el de `/pilotos` («Pilotos 2026») y el selector de año de `Header.tsx` lo escriben a mano.
- **Equipos duplicados.** La API de resultados los modela por temporada y la general como entidad única, y sus `legacy_id` no coinciden. Unificarlos exige una decisión de modelo del usuario.
- **Filas históricas con `Session.type = 'SESSION'` sin migrar.** Versiones anteriores de `import:event-details` guardaban `broadcast.type` (siempre `SESSION` en las sesiones de pista) en las sesiones creadas sin pareja; ahora guardan `baseSessionType(broadcast.shortname)` y `areTypesCompatible` trata `SESSION` como tipo desconocido para que esas filas sigan emparejando por UUID. En la base local quedan unas 763 filas con ese valor (la mayoría `RAC` de 1951-2000) pendientes de una migración de datos aparte que **no se ha hecho** (cifra aportada por el usuario, no recontada aquí). `import:event-details` sigue sin ser idempotente si se ejecuta antes de que `/results/sessions` publique las sesiones (filas huérfanas o duplicadas); con fechas idénticas el orden de la pasada 4 no está garantizado (la consulta ordena solo por `dateStart`). Conviene ejecutarlo siempre después de `import:sessions`.
- **Filas obsoletas en las clasificaciones.** `championshipStandingImporter.ts` y `bmwAwardImporter.ts` solo hacen `upsert` y nunca borran: un piloto que desaparece conserva su fila. `ChampionshipStanding` se puede filtrar por `snapshotAt`; `BmwAwardStanding` solo tiene `fetchedAt` por fila y `getMotoGPRiderStandings` (`riderStandingsRepository.ts`) la lee entera sin filtrar, así que un obsoleto aparecería en `/api/riders/standings`. Además `bmwAwardImporter.ts` (los `eventId` de `create` y `update`) pisa `eventId` con `null` si el evento no se resuelve, y este importador no guarda `ApiSnapshot`. Corrección sugerida: tras importar una temporada, borrar o ignorar las filas con `fetchedAt` anterior al inicio de la ejecución; conservar el `eventId` previo si no se resuelve.
- **Constructores de `import:rider-statistics` sin resolver.** `riderStatisticsImporter.ts` enlaza el constructor por nombre normalizado (la API solo da el nombre); si no lo encuentra, la fila se crea con `constructorId` nulo (el `update` ya no pisa uno resuelto antes). En la pasada completa del 2026-10-14 hubo 289 avisos «Constructor no encontrado» (cifra medida al ejecutarla, no recontada aquí): sobre todo «Unknown» y «XX», más combinaciones históricas como «Huvo-Casal» o «MZ-MZ-RE». Son nombres compuestos o marcas que no existen en `constructors`; crearlos o aliasarlos es decisión de modelo. Dos constructores distintos pueden normalizar igual («mv agusta»). Corrección sugerida: resolver constructores por `legacyId` si la API lo da.
- **`import:riders` solo recorre los pilotos de `/riders`.** `riderImporter.ts` toma los pilotos del listado `/riders` (99 el 2026-10-14: la API ignora `seasonUuid` y devuelve siempre los actuales) y de cada uno importa la ficha. Las leyendas (Rossi, Doohan...) tienen estadísticas por temporada, incluidas las de 500cc, pero no ficha (fecha de nacimiento, año de debut, `legend`), biografía ni trayectoria (`RiderSeasonEntry`). Hoy no se nota porque `/pilotos` solo muestra titulares. Corrección sugerida: que el importador acepte una lista de pilotos de la base de datos (`ridersApiUuid`) para pedir `GET /riders/{ridersApiUuid}`, acotada (no todos los pilotos de golpe).
- **Pasos de carrera descartados por la clave única.** `RiderSeasonEntry` es único en `(riderId, seasonId, categoryId)` y `career[]` puede traer varios pasos para esa clave (cambio de equipo a mitad de año): `pickCareerSteps` guarda uno (gana `current: true`) y descarta el resto (57 el 2026-10-14, contador `entriesSuperseded`). **Decisión del usuario: se acepta.** Efecto conocido en la importación del 2026-10-14: Jorge Navarro (Moto2 2026) tiene un paso `current` Substitute y otro Official, gana el primero y sale de la parrilla `Official` de `/pilotos`. Una trayectoria fiel por equipo exigiría `teamId` en la clave o una tabla de pasos (decisión de modelo, no hecha).
- **Equipos históricos con el nombre actual y errores de origen.** `Team` no guarda temporada, así que la trayectoria de `/pilotos` muestra el nombre del equipo enlazado, que en años antiguos suele ser el actual (Márquez 2013-2023 sale «Honda HRC Castrol»). Además hay errores de la fuente: la API trae un único paso de Jorge Martín en 2018 (Moto3) con el equipo «Red Bull KTM Ajo», que es el de 2019 (`riderImporter` no puede elegir otro). El `constructorId` de `rider_season_entries` también es poco fiable antes de ~2020 y no siempre coincide con el de las estadísticas; la trayectoria prefiere el de estadísticas. Corregirlo exigiría un override manual (decisión del usuario).
- **101 URL `PORTRAIT` antiguas con 404 en la base de datos.** `riderImporter` ya no guarda URL fuera de `photos.motogp.com`, pero 101 filas de `rider_season_images` (años 2005-2016, `www.motogp.com/en/api/rider/photo/grid/old/<legacyId>`, 23 URL distintas, todas dan 404 según la medición del 2026-10-14) siguen ahí. No afectan a `/pilotos` (solo lee `PROFILE`). Limpiarlas (poner `main_url` a `null` o borrarlas) exige copia previa y permiso del usuario.
- **La clase reina hasta 2001 está partida en dos categorías.** La API de resultados llama «500cc» a la clase reina con el mismo uuid y `legacy_id` 3 que MotoGP, así que las sesiones, `EventCategory` y las clasificaciones anteriores a 2002 siguen colgando de la fila MotoGP, mientras que las estadísticas y las inscripciones usan la fila «500cc» (`legacyId` -1). Cualquier agrupación por categoría reparte la clase reina en dos filas (la interfaz suma `legacyId` 3 y -1). Separar sesiones y clasificaciones por año del evento (< 2002) sería otra decisión del usuario. Además, el `create` de `eventCategoryImporter` con una base vacía cuyo primer evento sea anterior a 2002 no se ha probado.
- **`rider_season_statistics.points` es `Int` y trunca los medios puntos.** La API da, por ejemplo, 509,5 en Moto2 y se guarda 509 (en 2026 también Ortola 191,5 → 191). `ChampionshipStanding.points` es `Decimal`: `/api/riders/carousel` usa ese y solo cae al entero si falta la clasificación. Pasar el campo a `Decimal` es un cambio de esquema no aditivo, pendiente de aprobación.
- **`Country.name` y `regionIso` pueden degradarse al reimportar.** El `update` del `upsert` de país en `riderImporter.ts` y en `sessionResultImporter.ts` usa el ISO como nombre de respaldo, y el segundo pisa `regionIso` con `null` si falta. Ya hay países con `name = iso` (YU, EU). No afecta a `flagUrl`, que nunca se pisa con `null`. Corrección sugerida: en el `update`, incluir `name`/`regionIso` solo cuando la API los trae.
- **Código duplicado sin consolidar.** `import-event-details.ts`, `import-riders.ts` e `import-championship-standings.ts` llevan su propia copia de `getSeasonYear()` en lugar de usar `getSeasonYearArgument()` de `src/services/importers/cli.ts`; y las interfaces de respuesta (`MotoGPRider`, `RiderStatistics`, `ConstructorStanding`, `GrandPrix`...) se redeclaran en varios componentes en vez de importarse de `src/types/`.
- **Sin tests automatizados ni ESLint.** No hay `npm test` y `npm run lint` no funciona.
- **Despliegue en el VPS de Clouding sin importadores `import:*` empaquetados.** El paquete (`npm run package:dinahosting`) solo lleva la web y la pasada de `sync:sessions` (bundle `sync-sessions.cjs`, lanzado por el temporizador `motogp-sync`). Con un VPS se podrían ejecutar los `import:*` desde un checkout del repositorio en el servidor, pero **eso no está documentado ni probado**; hoy temporadas nuevas, categorías, detalles de evento, pilotos (incluidas las biografías de `rider_biographies`), estadísticas de 500cc o histórico exigen importarlos en local y repetir volcado/carga (ver [DEPLOY_CLOUDING.md](DEPLOY_CLOUDING.md)).
- **Carga por volcado y semilla 500cc: ajuste sin probar en el servidor.** `20261014120100_category_500cc` inserta una fila en `categories` al ejecutar `prisma migrate deploy` y el volcado de la base local trae esa misma fila (mismo `id`, fijado en la migración). `scripts/deploy/cargar-datos.sh` lo contempla: si el destino tiene exactamente 1 fila y es esa semilla (`b1491d87-f579-429d-b2c0-46c75169888c`), la borra antes de comprobar que todo está vacío y sigue; con más filas aborta como antes. El ajuste solo se ha comprobado con `bash -n`, no cargando un volcado en un servidor real (ver [DEPLOY_CLOUDING.md](DEPLOY_CLOUDING.md#7-fase-5--cargar-los-datos)).
- **SSH del VPS endurecido a medias.** Ya solo entra con clave (`PermitRootLogin prohibit-password`; ver [DEPLOY_CLOUDING.md](DEPLOY_CLOUDING.md#121-endurecer-ssh-solo-con-clave)), pero `desplegar.ps1` sigue entrando como `root`, no hay usuario no root con `sudo` y `fail2ban` no está instalado.
- **Sin dominio ni HTTPS todavía.** La web se sirve por HTTP en la IP; el HTTPS con dominio (Caddy) está preparado en `instalar-servidor.sh` (`DOMINIO=...`) pero no se ha verificado en el servidor.
- **Partes del despliegue sin verificar en el servidor real:** vuelta atrás automática, primera ejecución automática de `motogp-backup`, `import:*` en el servidor y `systemd-analyze verify` (lista completa en [DEPLOY_CLOUDING.md](DEPLOY_CLOUDING.md#qué-está-verificado-y-qué-no)). El hosting compartido de Dinahosting quedó descartado (no ejecuta la aplicación; [DEPLOY_DINAHOSTING.md](DEPLOY_DINAHOSTING.md) es histórico).
- **Repositorio de GitHub público.** Los documentos de despliegue (`DEPLOY*.md`) describen la arquitectura del servidor; conviene mantener el repositorio privado o asumir que esa información es visible (ver [DEPLOY_CLOUDING.md](DEPLOY_CLOUDING.md#12-seguridad)).
- **`graphify-out/` se versiona.** Es el gráfico de conocimiento que genera la herramienta graphify instalada por el usuario; `.gitignore` solo excluye `graphify-out/.graphify_*` (rutas locales de la máquina). No es código ni documentación de referencia: no lo edites a mano.
- **`LiveTimingSnapshot` y `LiveRiderTiming` están vacíos.** Requieren sondeo de sesiones en directo, no importación histórica.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
