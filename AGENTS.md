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

---

## Los agentes

### `database-guardian`

**Se ocupa de:** `prisma/schema.prisma`, las migraciones, restricciones e índices, consultas Prisma complejas, la integridad y limpieza de datos (duplicados, huérfanos), el rendimiento de PostgreSQL (consultas lentas, índices, mantenimiento, copias) y todo lo relativo a qué endpoint de MotoGP proporciona qué dato.

**Sabe:** las claves de unión entre las dos APIs, por qué las horas no coinciden entre ellas, qué campos cambian según el tipo de sesión y las reglas de idempotencia del proyecto.

**No se ocupa de:** componentes, estilos ni rutas de UI, ni de ejecutar o escribir importadores (eso es de `import-guardian`).

### `frontend-guardian`

**Se ocupa de:** `src/components/`, `src/app/` (páginas y route handlers), los repositorios de lectura de `src/services/db/`, los estados de carga y error y las decisiones de framework de Next.js (server/client components, caché, metadata, navegación, build y despliegue en Railway).

**Sabe:** la arquitectura de datos actual (la UI lee de PostgreSQL vía Prisma), las convenciones de fetching, el formato de respuesta de las rutas internas y la trampa horaria de `getMadridTimestamp`.

**No se ocupa de:** decidir la identidad visual (eso es de `ui-designer`) ni de importadores.

### `ui-designer`

**Se ocupa de:** la capa visual, en dos modos. *Diseñar* pantallas y componentes nuevos (páginas, estados de carga/error/vacío, responsive) y *auditar* que cualquier cambio visible mantenga la identidad visual del proyecto (paleta, tipografía, tarjetas, iconos, estados).

**Sabe:** el sistema visual completo (oscuro, acento rojo, `.card`, etiquetas en mayúsculas), la composición de la portada y la deuda de diseño conocida.

**No se ocupa de:** datos (repositorios, rutas, importadores, esquema). Al auditar es revisor, no constructor: corrige solo cuando se le pide, alineándose con un patrón que ya exista.

### `import-guardian`

**Se ocupa de:** ejecutar y encadenar los `npm run import:*`, actualizar la base de datos tras un Gran Premio, rellenar datos que faltan y escribir o modificar importadores (`src/services/importers/`, `scripts/`), incluida la sincronización en vivo (`sync:sessions` / `watch:sessions`). Diagnostica por qué un dato no ha entrado (`SyncRun`, `ApiSnapshot`).

**No se ocupa de:** cambios de esquema o migraciones (`database-guardian`) ni de UI.

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
| Esquema, migración, restricción o índice | `database-guardian` |
| Ejecutar o escribir un importador, actualizar datos tras un GP | `import-guardian` |
| Componente, página, route handler, repositorio de lectura (`src/services/db/`) | `frontend-guardian` |
| Diseñar una pantalla o componente nuevo (aspecto y experiencia) | `ui-designer` |
| Revisar coherencia visual de un cambio ya hecho | `ui-designer` (modo auditar) |
| Interfaces compartidas, errores de tipos, tipado de Prisma | `typescript-pro` |
| Revisar un diff antes de commitear | `code-reviewer` |
| Algo falla y no se sabe por qué | `debugger` |
| "Mostrar en la interfaz un dato nuevo" | Primero `database-guardian` (¿existe el dato?), luego `frontend-guardian`, luego `ui-designer` (auditoría) |
| Documentación (`README.md`, `AGENTS.md`, `DEPLOY.md`, `DATABASE_*.md`) | `docs-guardian` |
| Configuración del repo (no documentación) | Agente principal, sin delegar |

**Regla de frontera:** el contrato entre ambos mundos es la respuesta de las rutas de `src/app/api/`. `database-guardian` es dueño de todo lo que hay por debajo; `frontend-guardian`, de todo lo que hay por encima. Si una tarea exige cambiar ese contrato, dilo explícitamente en el traspaso: qué campos se añaden, con qué nombres y qué tipos.

**Orden de trabajo cuando intervienen varios:** nunca en paralelo sobre los mismos ficheros. Primero los datos, después la interfaz, y la revisión visual al final.

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

- **`getMadridTimestamp` interpreta mal la zona horaria.** Las horas de `Session.dateStart` son el reloj local del circuito (con horario de verano) etiquetado como UTC, pero `getMadridTimestamp` las trata como hora de Madrid: la cuenta atrás (`Countdown`) y la tarjeta Sprint de la portada (`ChampionshipStats`) salen desfasadas para los GP fuera de Europa. El calendario ya usa `wallClockToInstant(date, timeZone)` de `src/utils/date.ts`; arreglar la portada requiere usar `Event.timeZone` (hoy `/api/next-gp` no lo devuelve).
- **Dos copias de `wallClockToInstant`.** `src/utils/date.ts` y `src/services/importers/liveSessionSync.ts` tienen cada una la suya, con comportamiento distinto sin zona horaria (la de `date.ts` exige zona; la de `liveSessionSync` devuelve la hora tal cual).
- **El año 2026 está fijo en la interfaz.** El título de `/calendario` y el selector de año de `Header.tsx` lo escriben a mano.
- **Equipos duplicados.** La API de resultados los modela por temporada y la general como entidad única, y sus `legacy_id` no coinciden. Unificarlos exige una decisión de modelo del usuario.
- **Sin tests automatizados ni ESLint.** No hay `npm test` y `npm run lint` no funciona.
- **`LiveTimingSnapshot` y `LiveRiderTiming` están vacíos.** Requieren sondeo de sesiones en directo, no importación histórica.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
