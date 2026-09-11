# AGENTS.md

Guía de coordinación para los agentes que trabajan en **MotoGP Stats**.

Este documento define quién se ocupa de qué, cómo se pasan el trabajo entre ellos y qué reglas comparten todos. El contexto completo del proyecto está en [README.md](README.md); aquí solo está lo necesario para repartir el trabajo correctamente.

---

## El proyecto en tres frases

Aplicación de estadísticas de MotoGP con Next.js, TypeScript, PostgreSQL y Prisma. Los datos de la API pública de MotoGP se importan, normalizan y almacenan en una base de datos propia mediante importadores idempotentes. El objetivo final es que la aplicación responda desde su propia base de datos en lugar de consultar la API externa en cada visita.

---

## Estado actual (importante para no romper decisiones deliberadas)

La base de datos **ya se está poblando**, pero la interfaz **todavía consulta la API externa en vivo**. Esto es intencionado mientras se monta la aplicación.

```
     IMPORTACIÓN (activa)                    INTERFAZ (activa)

     API de MotoGP                           API de MotoGP
          │                                       │
          ▼                                       ▼
     Importadores                            src/services/*Service.ts
          │                                       │
          ▼                                       ▼
     PostgreSQL  ····· todavía sin conectar ····  /api/...
                                                  │
                                                  ▼
                                             Componentes React
```

Ningún agente debe conectar la interfaz a PostgreSQL sin que el usuario lo pida explícitamente. Si detectas que algo se beneficiaría de ello, propónlo y espera respuesta.

---

## Los agentes

### `database-guardian`

**Se ocupa de:** `prisma/schema.prisma`, migraciones, `src/services/importers/`, `scripts/import-*.ts`, consultas Prisma y todo lo relativo a qué endpoint de MotoGP proporciona qué dato.

**Sabe:** las claves de unión entre las dos APIs, por qué las horas no coinciden entre ellas, qué campos cambian según el tipo de sesión y las reglas de idempotencia del proyecto.

**No se ocupa de:** componentes, estilos ni rutas de UI.

### `frontend-guardian`

**Se ocupa de:** `src/components/`, `src/app/` (páginas y route handlers), `src/services/*Service.ts`, obtención de datos, estados de carga y error.

**Sabe:** la arquitectura de datos actual, las convenciones de fetching, el formato de respuesta de las rutas internas y la trampa horaria de `getMadridTimestamp`.

**No se ocupa de:** decidir la identidad visual (eso lo audita `ui-design-guardian`) ni de importadores.

### `ui-design-guardian`

**Se ocupa de:** auditar que cualquier cambio visible mantenga la identidad visual del proyecto (paleta, tipografía, tarjetas, iconos, estados).

**Es un revisor, no un constructor.** Corrige solo cuando se le pide, y siempre alineándose con un patrón que ya exista en el código.

---

## Cómo repartir una tarea

| La tarea toca... | Agente |
|---|---|
| Esquema, migración, importador, script de importación | `database-guardian` |
| Componente, página, route handler, servicio de datos | `frontend-guardian` |
| Revisar coherencia visual de un cambio ya hecho | `ui-design-guardian` |
| "Mostrar en la interfaz un dato nuevo" | Primero `database-guardian` (¿existe el dato?), luego `frontend-guardian`, luego `ui-design-guardian` |
| Documentación, README, configuración del repo | Agente principal, sin delegar |

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

---

## Comprobaciones

```bash
npx tsc --noEmit -p tsconfig.json   # el proyecto está en strict
npm run lint
npx prisma validate                 # si se ha tocado el esquema
```

Migraciones: `prisma migrate dev` es interactivo y falla en entornos no interactivos. Usa `prisma migrate diff` para generar el SQL y `prisma migrate deploy` para aplicarlo (procedimiento detallado en `database-guardian`).

---

## Deudas conocidas (no las "arregles" sin hablarlo)

- **La interfaz no lee de PostgreSQL.** Deliberado por ahora.
- **`getMadridTimestamp` interpreta mal la zona horaria.** La API de resultados devuelve la hora estándar del circuito, no la de Madrid; las cuentas atrás de los GP fuera de Europa van desfasadas. Arreglarlo requiere usar `Event.timeZone`.
- **Equipos duplicados.** La API de resultados los modela por temporada y la general como entidad única, y sus `legacy_id` no coinciden. Unificarlos exige una decisión de modelo del usuario.
- **Sin tests automatizados.** No hay `npm test`.
- **`LiveTimingSnapshot` y `LiveRiderTiming` están vacíos.** Requieren sondeo de sesiones en directo, no importación histórica.
