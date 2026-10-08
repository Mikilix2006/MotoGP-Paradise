# Desplegar en Dinahosting (hosting Linux Profesional / Advanced)

Guía paso a paso para publicar MotoGP Stats en el hosting Linux "Profesional" (nivel Advanced) de Dinahosting. El despliegue en Railway está en [DEPLOY.md](DEPLOY.md); este documento es independiente y no lo sustituye.

**Estado:** el paquete y los scripts están preparados y probados en local (empaquetado, volcado y carga de datos contra una base de prueba). **Nada se ha ejecutado todavía en un servidor real de Dinahosting.** Lo que depende del hosting está marcado como *según la documentación de Dinahosting* (dato publicado por ellos) o *pendiente de comprobar en el servidor*. La lista completa está en [Qué no está verificado](#12-qué-no-está-verificado).

## Índice

1. [Qué se despliega y cómo encaja en el hosting](#1-qué-se-despliega-y-cómo-encaja-en-el-hosting)
2. [Fase 0 — Comprobaciones previas (SSH y panel)](#2-fase-0--comprobaciones-previas-ssh-y-panel)
3. [Fase 1 — Panel de Dinahosting](#3-fase-1--panel-de-dinahosting)
4. [Fase 2 — En tu equipo (Windows)](#4-fase-2--en-tu-equipo-windows)
5. [Fase 3 — Subida de ficheros](#5-fase-3--subida-de-ficheros)
6. [Fase 4 — En el servidor (SSH)](#6-fase-4--en-el-servidor-ssh)
7. [Fase 5 — Aplicación en el panel](#7-fase-5--aplicación-en-el-panel)
8. [Fase 6 — Cron de sincronización](#8-fase-6--cron-de-sincronización)
9. [Fase 7 — Verificación](#9-fase-7--verificación)
10. [Actualizaciones](#10-actualizaciones)
11. [Seguridad](#11-seguridad)
12. [Qué no está verificado](#12-qué-no-está-verificado)
13. [Problemas frecuentes](#13-problemas-frecuentes)
14. [Pendientes](#14-pendientes)

> Nota de numeración: los apartados llevan número correlativo; las "Fases" 0 a 7 son los pasos del despliegue en orden.

---

## 1. Qué se despliega y cómo encaja en el hosting

**El plan** (según la documentación de Dinahosting): Hosting Profesional Linux, nivel Advanced. Incluye Node.js 20.18.1 (y versiones propias con NVM por SSH), PostgreSQL 12, MySQL, cron, SSH sin root, Git y `.htaccess` (mod_rewrite, mod_headers…). No hay Docker, Redis ni MongoDB. No publican límites de memoria ni de CPU.

Fuentes oficiales:

- <https://en.dinahosting.com/hosting>
- <https://dinahosting.com/ayuda/como-creo-una-aplicacion-con-node-js/>
- <https://dinahosting.com/ayuda/ruby-node/>
- <https://dinahosting.com/ayuda/tecnologias-dinahosting/>
- <https://dinahosting.com/ayuda/utilizar-version-personalizada-de-nodejs/>

**Cómo corre una app Node allí** (según esa documentación): se crea en el Panel (Hosting > Servidor > Otras aplicaciones, tipo Node.js, con "Raíz de la aplicación" y "Path ejecutable"), dentro de `www` o del directorio de un subdominio. La arranca Passenger, que asigna el socket y lo enlaza al puerto 80. No hay procesos permanentes propios.

**Consecuencias para este proyecto** (decisiones tomadas y verificadas en los ficheros):

| Pieza | En Railway | En Dinahosting |
|---|---|---|
| Web | `npm run start:web` | `app.js` (`scripts/dinahosting/app.js`): servidor propio con `next({ dev: false })` y `listen(0)`; Passenger decide el socket, la app no fija puerto. Fuerza `NODE_ENV=production` |
| Sincronización en vivo | servicio *worker* con `npm run watch:sessions` (proceso continuo) | cron cada 5 minutos que ejecuta `sync-sessions.cjs`, un bundle de `scripts/watch-sessions.ts --once` |
| Migraciones | `prisma migrate deploy` en cada arranque | a mano por SSH, solo cuando hay migraciones nuevas |
| Carga inicial de datos | `import:*` desde tu máquina contra la BD pública | volcado de tu BD local (solo datos) y carga por SSH (Fase 2 y 4) |

Por qué un servidor propio y no `output: "standalone"`: el `server.js` estándar trata `PORT=0` como "no definido" y el trazado copiaría el motor de Prisma de Windows. `npm run dev` y `npm run start:web` no cambian.

**Qué contiene el paquete** (`npm run package:dinahosting` → `dist/dinahosting/`, unos 7,4 MB; lo escribe `scripts/package-dinahosting.mjs`):

| Elemento | Para qué |
|---|---|
| `app.js` | Entrada de Passenger |
| `.next/` | Build de producción (sin caché ni `dev`; los alias de Turbopack se sustituyen por paquetes mínimos sin enlaces de Windows) |
| `prisma/` | Esquema y migraciones |
| `package.json`, `package-lock.json` | Propios del paquete: sin `devDependencies` y con `prisma` en `dependencies`, para que `npm ci --omit=dev` ejecute `prisma generate` (postinstall) y cree el motor Linux. El `package.json` del repo no se toca |
| `next.config.mjs` | `next.config.ts` transpilado (el servidor no tiene TypeScript) |
| `sync-sessions.cjs` | Bundle de la pasada de sincronización para cron (no necesita `tsx`) |
| `.env.example` | Copia de `.env.production.example`: plantilla sin secretos |
| `.htaccess.seguridad` | Reglas Apache para denegar ficheros sensibles (se **añaden** al `.htaccess`) |
| `public/` (si existe), `tmp/`, `logs/` | Carpetas vacías de trabajo (`tmp/` para el reinicio y el bloqueo del cron, `logs/` para `sync.log`) |

**No** incluye `node_modules` (el de Windows no sirve en Linux): se instala en el servidor. **No** incluye `scripts/deploy/` (volcado y carga de datos): se sube aparte (Fase 3).

---

## 2. Fase 0 — Comprobaciones previas (SSH y panel)

Hazlas **antes de preparar nada**: si algo falla aquí, ahorra trabajo.

### 0.1 Por SSH

```bash
ssh USUARIO@HOST
uname -a; cat /etc/os-release; openssl version; node -v; npm -v; free -m; ulimit -a; df -h .; du -sh ~
which flock crontab psql gzip awk sha256sum
curl -sI https://binaries.prisma.sh | head -1
curl -sI https://registry.npmjs.org | head -1
curl -sI https://api.motogp.pulselive.com/motogp/v1 | head -1
```

Qué mirar en cada salida:

| Salida | Qué buscar |
|---|---|
| `uname -a`, `/etc/os-release`, `openssl version` | Distribución, arquitectura (debe ser x86_64) y versión de OpenSSL. De ellas depende que `prisma generate` elija el motor correcto (ver [Qué no está verificado](#12-qué-no-está-verificado)) |
| `node -v`, `npm -v` | Según Dinahosting, Node 20.18.1. Si no es 20.x, ver la documentación de versión personalizada con NVM (enlace en el apartado 1). El paquete declara `engines.node >=20.18` y `app.js` usa `process.loadEnvFile`, que exige Node 20.12 o superior |
| `free -m`, `ulimit -a` | Memoria libre y límites de procesos/memoria. No hay límites publicados; Next.js necesita memoria para arrancar |
| `df -h .`, `du -sh ~` | Espacio libre y cuota. El `node_modules` ocupó unos 650 MB medidos en Windows: reserva ese espacio más el volcado (21,5 MB comprimido, 106 MB sin comprimir) |
| `which flock crontab psql gzip awk sha256sum` | Todos deben aparecer. `psql`, `gzip`, `awk` y `sha256sum` los usa `cargar-datos.sh`; `crontab` es necesario para la Fase 6. `flock` no hace falta (el bloqueo lo hace el propio bundle). Si falta `psql`, la carga de datos del apartado 6 no funciona tal cual: pendiente de resolver con Dinahosting |
| Tres `curl -sI` | Deben devolver una línea `HTTP/...` (cualquier código, no vacío). Sin salida a internet fallan `npm ci`, la descarga del motor de Prisma y el cron |

### 0.2 En el panel y en PostgreSQL

Tras crear la base de datos (Fase 1) y conectar con `psql`, comprueba:

```sql
SELECT version();
```

| Dato | Qué necesitas saber |
|---|---|
| Versión exacta de PostgreSQL | Según Dinahosting, la 12. El PostgreSQL local de desarrollo es el 18.6. **La versión mínima de PostgreSQL que exige Prisma 6.12 no está confirmada**: compruébala en la documentación oficial de Prisma antes de desplegar |
| Límite de tamaño de la BD | Se necesitan unos 175 MB, más el crecimiento de la temporada |
| Permisos | El usuario debe poder crear tablas y tipos en el esquema `public` (lo hace `prisma migrate deploy`) |
| SSL | Si el servidor lo exige, hay que añadir `sslmode=require` a la URL |
| Conexiones por usuario | Si el límite es 5 o menos, usa `connection_limit=2` (ver Fase 4) |
| Acceso remoto | Lo habitual en hosting compartido es que PostgreSQL **no** acepte conexiones desde fuera. Si es así, `migrate deploy` y la carga de datos se hacen por SSH desde el servidor, como describe esta guía |

---

## 3. Fase 1 — Panel de Dinahosting

1. Crea la base de datos PostgreSQL y su usuario. Anota host, puerto, nombre de base de datos, usuario y contraseña (host y puerto salen del panel: no los des por supuestos).
2. Se recomienda **crear un subdominio** para la primera prueba (p. ej. `motogp.dominio.es`): la documentación de Dinahosting permite las aplicaciones Node en `www` o en el directorio de un subdominio, y así puedes probar sin tocar la web principal.
3. Comprueba que Node.js está activado para tu cuenta (apartado "Otras aplicaciones", ver Fase 5).
4. Haz ahora las comprobaciones del apartado 0.2.

---

## 4. Fase 2 — En tu equipo (Windows)

### 2.1 Empaquetar la aplicación

```powershell
npm run package:dinahosting
```

Hace `next build` en local y deja en `dist/dinahosting/` solo lo que hay que subir (apartado 1). Necesita `esbuild`, que llega como dependencia transitiva de `tsx`; si falta, el empaquetador se detiene con un mensaje claro (`npm install`).

### 2.2 Volcar los datos de tu base de datos local

Genera un volcado **solo de datos** (`pg_dump --data-only`, esquema `public`, sin `_prisma_migrations`), filtrado con lista blanca para quitar las líneas que PostgreSQL 12 no entiende (`\restrict`, `SET transaction_timeout`, `\unrestrict`…) y comprimido con gzip. Escribe también un fichero `.sha256` al lado.

```powershell
$env:PGHOST='localhost'; $env:PGPORT='5432'; $env:PGUSER='postgres'; $env:PGDATABASE='motogp_stats'
$env:PGPASSWORD='...'   # solo en esta sesión; nunca en un fichero
.\scripts\deploy\volcar-datos.ps1 -Salida C:\ruta\motogp-datos.sql.gz
```

Si `pg_dump` no está en el `PATH`, define `$env:PG_BIN` con la carpeta `bin` de PostgreSQL. Sustituye los valores por los de tu base local.

Referencia medida en local: volcado de 106 MB sin comprimir y 21,5 MB comprimido.

Por qué solo datos: el esquema lo crea `npx prisma migrate deploy` en el destino, y así queda registrado en `_prisma_migrations`.

### 2.3 Recomendado: ensayo de carga en local

El último ajuste de `cargar-datos.sh` (`-o /dev/null` en `psql`) se añadió **después** de la prueba completa de carga. Antes de subir, ejecútalo una vez contra una base de PostgreSQL vacía local (esquema creado con `prisma migrate deploy`) y compara con `comprobaciones.sql` (apartado 6).

---

## 5. Fase 3 — Subida de ficheros

Por SFTP o `scp`. Tres subidas, con destinos distintos:

| Qué | Origen | Destino en el servidor |
|---|---|---|
| Paquete de la app | contenido de `dist/dinahosting/` (incluidos los ficheros con punto, como `.next` y `.htaccess.seguridad`) | raíz de la aplicación, p. ej. `~/www/motogp` |
| Volcado | `motogp-datos.sql.gz` y `motogp-datos.sql.gz.sha256` | `~/datos-deploy/` — **fuera de `www`** |
| Scripts de carga | `scripts/deploy/cargar-datos.sh`, `filtro-volcado.awk`, `comprobaciones.sql` | `~/datos-deploy/` (los tres juntos: `cargar-datos.sh` busca `filtro-volcado.awk` en su misma carpeta) |

Ejemplo con `scp` (Git Bash o PowerShell con OpenSSH; sustituye `USUARIO`, `HOST` y rutas):

```bash
ssh USUARIO@HOST "mkdir -p ~/www/motogp ~/datos-deploy"
scp -r dist/dinahosting/. USUARIO@HOST:www/motogp/
scp /c/ruta/motogp-datos.sql.gz /c/ruta/motogp-datos.sql.gz.sha256 USUARIO@HOST:datos-deploy/
scp scripts/deploy/cargar-datos.sh scripts/deploy/filtro-volcado.awk scripts/deploy/comprobaciones.sql USUARIO@HOST:datos-deploy/
```

Los volcados (`.sql.gz`, `.sha256`) **nunca** deben quedar dentro de `www`.

---

## 6. Fase 4 — En el servidor (SSH)

Los pasos vienen de la cabecera de `scripts/package-dinahosting.mjs`, `cargar-datos.sh` y `.env.production.example`.

### 4.1 Fichero de variables, fuera de `www`

```bash
cd ~/www/motogp
cp .env.example ~/.motogp-stats.env
chmod 600 ~/.motogp-stats.env
nano ~/.motogp-stats.env      # rellenar los valores reales
```

Variables que contiene (solo nombres; los valores salen del panel):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `"postgresql://USUARIO:CLAVE@HOST:PUERTO/BD?schema=public&connection_limit=3&pool_timeout=20"` |
| `MOTOGP_API_URL` | `https://api.motogp.pulselive.com/motogp/v1` |
| `MOTOGP_RESULTS_API_URL` | `https://api.motogp.pulselive.com/motogp/v1/results` |
| `NODE_ENV` | `production` (la plantilla lo trae; `app.js` además lo fuerza) |

Notas sobre `DATABASE_URL`:

- Host, puerto, usuario y base de datos son los del panel. Añade `sslmode=require` solo si el servidor lo exige.
- Si la contraseña tiene caracteres especiales (`@`, `:`, `/`, `#`, `?`, `%`…), hay que codificarla en URL (`@` → `%40`, etc.).
- Con un límite de conexiones por usuario de 5 o menos, usa `connection_limit=2`: la web y el cron abren cada uno su propio pool de Prisma.

Orden de búsqueda del fichero (tanto `app.js` como el bundle del cron usan el **primero que exista**; las variables ya definidas en el entorno no se pisan):

1. la ruta indicada en `MOTOGP_ENV_FILE`;
2. `~/.motogp-stats.env` (recomendado: el home está fuera de `www`);
3. `.env` junto a la app (funciona, pero está en la zona pública y la app avisa por stderr).

La CLI de Prisma **no** lee `~/.motogp-stats.env`. Antes de cualquier comando `prisma`, cárgalo en la sesión:

```bash
set -a; . ~/.motogp-stats.env; set +a
```

### 4.2 Instalar dependencias

```bash
cd ~/www/motogp
npm ci --omit=dev
```

Necesita internet: el `postinstall` ejecuta `prisma generate` y descarga el motor Linux. Si la salida indica que no encuentra un motor para la plataforma, ver [Problemas frecuentes](#13-problemas-frecuentes).

### 4.3 Crear el esquema

```bash
set -a; . ~/.motogp-stats.env; set +a
npx prisma migrate deploy
```

El repositorio tiene 6 migraciones (`ls prisma/migrations`); `comprobaciones.sql` espera ver las 6 aplicadas.

### 4.4 Cargar los datos

`cargar-datos.sh` quita la query string `?schema=` de `DATABASE_URL` (libpq no la admite), comprueba el `.sha256` y `gzip -t`, **aborta si el destino ya tiene filas** en alguna tabla, carga todo en una sola transacción (si algo falla no queda nada a medias) y ejecuta `ANALYZE`. No necesita superusuario.

```bash
cd ~/datos-deploy
set -a; . ~/.motogp-stats.env; set +a
bash cargar-datos.sh motogp-datos.sql.gz
```

Si el script aborta con "el destino ya tiene N filas", la carga se interrumpe sin tocar nada: vacía la base de datos y repite desde 4.3, o recréala desde el panel.

Comprobaciones posteriores (solo lectura):

```bash
psql "${DATABASE_URL%%\?*}" -X -f comprobaciones.sql
```

Qué debe salir (viene comentado en el propio SQL): las 6 migraciones con `ok = t`; el recuento por tabla igual al de tu base local; ninguna FK sin validar; 0 secuencias (los id son UUID generados por Prisma); datos clave coherentes; estadísticas al día.

Resultado de la prueba en local: recuentos y hash md5 por tabla idénticos en las 25 tablas con datos y `prisma migrate status` al día; la carga completa tardó 58 s. **Con PostgreSQL 12 real no se ha probado.**

Si el volcado no cabe en tu cuota o la carga es demasiado lenta, no improvises: consúltalo con Dinahosting.

### 4.5 Reglas de seguridad de Apache

```bash
cd ~/www/motogp
touch .htaccess
cp .htaccess ../htaccess.copia-$(date +%F)
grep -q 'MOTOGP-SEGURIDAD-INICIO' .htaccess || cat .htaccess.seguridad >> .htaccess
```

Se **añaden al final** del `.htaccess` existente, nunca lo reemplazan (Dinahosting o Passenger pueden haber escrito ahí su configuración). El `grep` evita duplicarlas. Detalle y comprobaciones en [Seguridad](#11-seguridad).

### 4.6 Reiniciar la aplicación

```bash
mkdir -p tmp logs && touch tmp/restart.txt
```

Passenger reinicia la app cuando cambia la fecha de `tmp/restart.txt`.

---

## 7. Fase 5 — Aplicación en el panel

En el Panel: Hosting > Servidor > Otras aplicaciones > crear aplicación.

| Campo | Valor |
|---|---|
| Tipo | Node.js |
| Raíz de la aplicación | la carpeta donde subiste el paquete (p. ej. `www/motogp` o la del subdominio) |
| Path ejecutable | `app.js` |

Los nombres exactos de los campos y el comportamiento de Passenger son los de la documentación de Dinahosting; cómo trata `listen(0)` y dónde deja los logs está **pendiente de comprobar en el servidor**. Tras guardar, haz `touch tmp/restart.txt` (apartado 4.6).

---

## 8. Fase 6 — Cron de sincronización

Primero, una pasada manual para ver que funciona:

```bash
cd ~/www/motogp
which node
node sync-sessions.cjs
```

Debe cargar las variables (el log indica la **ruta** del fichero, nunca su contenido), conectar con la base de datos y terminar con un resumen ("Sin evento en curso" o "Evento en curso: …"). Si falla por la conexión, revisa `DATABASE_URL`.

Después, programa la tarea con `crontab -e` (o desde el panel, si Dinahosting lo ofrece). Cada 5 minutos:

```cron
*/5 * * * * cd $HOME/www/motogp && $HOME/.nvm/versions/node/v20.18.1/bin/node sync-sessions.cjs >> logs/sync.log 2>&1
```

Sustituye la ruta de `node` por la que devuelva `which node` en el servidor (la ruta con NVM es la que se usó al preparar la guía, no está comprobada).

Comportamiento del bundle (de `scripts/dinahosting/sync-cron.ts`), sin depender de `flock`:

- Bloqueo en `tmp/sync-sessions.lock`. Si la pasada anterior sigue viva, la nueva escribe "Pasada anterior todavía en curso: se omite esta." y termina con **código 0**.
- Un bloqueo de un proceso muerto, o de más de 30 minutos, se considera obsoleto y se retoma.
- Una pasada colgada (p. ej. la API no responde) se aborta a los 20 minutos con **código 2** y libera el bloqueo.
- `logs/sync.log` **no rota** solo: vigila su tamaño (p. ej. vaciándolo de vez en cuando con `: > logs/sync.log`).

### Qué cubre esta pasada y qué no

Leído en `src/services/importers/liveSessionSync.ts` y `scripts/watch-sessions.ts` (README, [Fase 10](README.md#fase-10--sincronización-en-vivo)). Una pasada, siempre sobre la temporada marcada como actual (`Season.current = true`):

**Sí cubre:**

1. Refrescar el estado de los eventos de esa temporada (`NOT-STARTED` → `CURRENT` → `FINISHED`) con una sola llamada (`importEvents`).
2. Localizar los eventos activos (con un día de margen) y refrescar sus sesiones.
3. Importar la clasificación de las sesiones terminadas que no la tienen (y reimportar las terminadas hace menos de 6 horas, por sanciones).
4. Tras entrar el resultado de una carrera o sprint: estadísticas de pilotos, clasificación del campeonato y BMW Award de esa temporada.

**No cubre** (son los importadores `import:*`, que **no están empaquetados** para el servidor; el paquete solo lleva el bundle de la sincronización de sesiones y la web):

- Dar de alta una **temporada nueva** o cambiar cuál es la actual (`import:seasons`). Si no hay temporada con `current = true`, la pasada devuelve "no hay temporada actual" y no hace nada.
- Categorías de los eventos (`import:event-categories`) y detalles del evento y circuitos (`import:event-details`: pistas, calendario por días, URLs, banderas…).
- Alta de sesiones de eventos que aún no están activos (`import:sessions`): la pasada solo refresca las de los eventos activos.
- Pilotos y entradas por temporada (`import:riders`). Los pilotos que aparezcan en resultados nuevos sí los crea el importador de resultados, pero no se completan sus datos.
- Cualquier **histórico** o temporada anterior, y el mantenimiento `fix:duplicate-riders`.

**Cómo mantener esos datos hoy.** No hay un procedimiento probado para ejecutarlos en el servidor. Las opciones razonables son:

1. Ejecutar los `import:*` **en local** y repetir el volcado y la carga (Fases 2 y 4). Ojo: `cargar-datos.sh` solo carga en tablas vacías, así que habría que recrear la base de datos (o vaciarla) antes de recargar. Es un procedimiento posible con los scripts actuales, pero **no se ha probado como ciclo de actualización**.
2. Empaquetar los importadores para el servidor en una futura tarea (ver [Pendientes](#14-pendientes)).

---

## 9. Fase 7 — Verificación

Desde cualquier máquina (sustituye `dominio.es`):

```bash
curl -I https://dominio.es/
curl -I https://dominio.es/calendario
curl -sI https://dominio.es/api/calendar | head -1
curl -s https://dominio.es/api/next-gp | head -c 300
curl -s https://dominio.es/api/riders/standings | head -c 300
```

Todas deben dar `200` y las rutas `/api/...` devuelven JSON con la forma `{ "data": ... }` (README, sección 25). Después, las comprobaciones de seguridad del apartado [Seguridad](#11-seguridad) y una pasada manual de `sync-sessions.cjs` (Fase 6). Si algo falla, ve a [Problemas frecuentes](#13-problemas-frecuentes).

---

## 10. Actualizaciones

Para publicar una versión nueva:

1. En local: `npm run package:dinahosting`.
2. Subir el contenido de `dist/dinahosting/` a la raíz de la aplicación (Fase 3). **Cuidado:** no borres nada que no sea parte del paquete; en especial conserva `.htaccess` (con las reglas de seguridad ya añadidas) y `node_modules/`. Subir el paquete encima no sobrescribe el `.htaccess` porque el paquete no lleva ninguno.
3. Por SSH, según corresponda:

```bash
cd ~/www/motogp
npm ci --omit=dev                                  # solo si cambió package-lock.json
set -a; . ~/.motogp-stats.env; set +a
npx prisma migrate deploy                          # solo si hay migraciones nuevas
touch tmp/restart.txt                              # siempre
```

El cron no necesita tocarse; usará el nuevo `sync-sessions.cjs` en la siguiente pasada.

---

## 11. Seguridad

**Principio:** la app vive dentro de la zona pública de Apache. Por eso el fichero de variables va **fuera de `www`** (`~/.motogp-stats.env`, `chmod 600`) y los volcados `.sql.gz` / `.sha256` no se suben a `www`. `DATABASE_URL` lleva la contraseña de PostgreSQL.

**Defensa en profundidad: `.htaccess.seguridad`.** Deniega la descarga directa de `.env`, volcados, `package.json`, `prisma/`, `logs/`, `tmp/`, `.git`, `.next`, `app.js`, `*.cjs`… y desactiva el listado de directorios. Se instala como en el apartado 4.5 (añadir al final, idempotente). **No se ha podido probar contra un Apache real.** Compruébalo desde fuera:

```bash
curl -I https://dominio.es/.env                    # 403 o 404
curl -I https://dominio.es/.motogp-stats.env       # 403 o 404
curl -I https://dominio.es/package.json            # 403 o 404
curl -I https://dominio.es/package-lock.json       # 403 o 404
curl -I https://dominio.es/prisma/schema.prisma    # 403 o 404
curl -I https://dominio.es/logs/sync.log           # 403 o 404
curl -I https://dominio.es/tmp/restart.txt         # 403 o 404
curl -I https://dominio.es/app.js                  # 403 o 404
curl -I https://dominio.es/sync-sessions.cjs       # 403 o 404
curl -I https://dominio.es/.next/BUILD_ID          # 403 o 404
curl -I https://dominio.es/.git/config             # 403 o 404
curl -I https://dominio.es/copia.sql.gz            # 403 o 404 (fichero de prueba)
curl -I https://dominio.es/api/calendar            # 200 (lo atiende Node)
curl -I https://dominio.es/                        # 200
```

Si algún fichero sensible devuelve `200`, **no sirvas la web**: borra ese fichero del servidor y usa `~/.motogp-stats.env`.

Si Apache devuelve `500` tras añadir el bloque, quita el bloque entre `MOTOGP-SEGURIDAD-INICIO` y `MOTOGP-SEGURIDAD-FIN` y avisa a soporte de Dinahosting: significa que alguna directiva no está permitida en `.htaccess`. Tras comprobar que todo funciona puedes borrar `.htaccess.seguridad` del servidor.

**Estructura más segura (no implementada).** La raíz de aplicación ideal sería una carpeta fuera de `www` (p. ej. `~/motogp-app/`) con todo el paquete, y en `www/motogp/` solo un `app.js` de una línea que haga `require("/home/USUARIO/motogp-app/app.js")`. No está verificado con el Passenger de Dinahosting (su documentación exige la app dentro de `www` o de un subdominio y puede validar la raíz). Si quieres probarla, hazlo primero en un subdominio.

**Dependencias (`npm audit --omit=dev`, 3 hallazgos; no se ha aplicado `audit fix`).** Decisión pendiente del usuario:

| Paquete | Gravedad | Detalle |
|---|---|---|
| `next` 16.3.3 | crítica | RCE en `next/og` `ImageResponse` (GHSA-vcvr-r3jv-pc5j). La app **no** usa `next/og`, ni `opengraph-image`, ni `next/image`, así que no es explotable aquí; conviene actualizar Next cuando haya parche |
| `sharp` 0.35.4 | alta | Solo lo usa Next para optimizar imágenes, que la app no usa |
| `source-map-js` | alta | Solo interviene en el build |

---

## 12. Qué no está verificado

Nada de esto se ha ejecutado en el hosting real. Resérvate margen para ajustes:

1. **Passenger real:** cómo se comporta `listen(0)`, dónde salen los logs (`app.js` escribe en stdout/stderr) y qué valida del "Path ejecutable".
2. **Memoria disponible** y arranque en frío de Next.js bajo Passenger (no hay límites publicados).
3. **Versión de Linux/OpenSSL** y que `prisma generate` detecte bien la plataforma. Si no lo hace, hará falta `binaryTargets` en `prisma/schema.prisma`, que **no se ha tocado**.
4. **`npm ci` en Linux** (solo se ha medido en Windows: unos 650 MB).
5. **`prisma migrate deploy` contra un PostgreSQL 12 real**, y la versión mínima de PostgreSQL que soporta Prisma 6.12 (consultar la documentación oficial de Prisma).
6. **Las reglas de `.htaccess.seguridad`** contra un Apache real.
7. **La estructura con la app fuera de `www`.**
8. **La carga de datos con el último ajuste de `cargar-datos.sh`** (`-o /dev/null`), ni contra PostgreSQL 12. Lo probado en local es la carga completa anterior a ese ajuste.
9. **Que `psql`, `gzip`, `awk` y `sha256sum` existan en el servidor** y que `crontab` esté disponible por SSH (Fase 0).
10. **Acceso remoto a PostgreSQL**, SSL obligatorio y límite de conexiones (Fase 0).

---

## 13. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| `500` en toda la web tras añadir el `.htaccess` | Quita el bloque entre `MOTOGP-SEGURIDAD-INICIO` y `MOTOGP-SEGURIDAD-FIN` (hay copia en `../htaccess.copia-FECHA`), confirma que la web vuelve y avisa a soporte: alguna directiva no se permite |
| `Prisma Client could not locate the Query Engine` / motor no encontrado | `npm ci --omit=dev` no pudo descargar o elegir el motor Linux. Comprueba la salida a `binaries.prisma.sh` (Fase 0) y vuelve a ejecutar `npm ci --omit=dev`. Si se instala el motor equivocado, añade `binaryTargets` al esquema Prisma (cambio de código, fuera del alcance de esta guía: consúltalo) |
| La app no arranca (página de error de Passenger, `502`/`503`) | Revisa el log de errores de Passenger/Apache que ofrezca el panel, comprueba que Raíz = carpeta del paquete y Path ejecutable = `app.js`, que `node_modules/` existe, y haz `touch tmp/restart.txt`. Ejecuta `node app.js` a mano por SSH para ver el error (Ctrl+C para parar) |
| Mensaje "No se encontró ningún fichero de variables" en el log | `~/.motogp-stats.env` no existe o está en otro home (cron y web deben correr con el mismo usuario). Revisa la ruta (o define `MOTOGP_ENV_FILE`) |
| Errores de "Too many connections" / "timeout fetching a connection from the pool" | Baja `connection_limit` en `DATABASE_URL` (p. ej. a 2) y reinicia con `touch tmp/restart.txt` |
| `migrate deploy` falla con "Environment variable not found: DATABASE_URL" | Falta `set -a; . ~/.motogp-stats.env; set +a` en esa sesión |
| `migrate deploy` o la carga fallan por permisos | El usuario de la BD no puede crear tablas/tipos en `public`: consúltalo con Dinahosting |
| `cargar-datos.sh`: "el destino ya tiene N filas; abortado" | Es la protección contra duplicados. Recrea la base de datos y repite desde `migrate deploy` |
| El cron no hace nada | Mira `logs/sync.log`. Causas habituales: ruta de `node` incorrecta (`which node`), `logs/` inexistente, variables sin cargar, o "Pasada anterior todavía en curso" repetido (bloqueo vivo: ver `tmp/sync-sessions.lock`) |
| `sync-sessions.cjs` dice "no hay temporada actual" | La base no tiene ninguna temporada con `current = true`: falta datos (ver [Qué no cubre la pasada](#qué-cubre-esta-pasada-y-qué-no)) |

---

## 14. Pendientes

- **Importadores `import:*` en el servidor.** No están empaquetados y la BD de Dinahosting probablemente no acepta conexiones remotas, así que hoy no hay forma probada de ejecutar en producción temporadas nuevas, categorías, detalles de evento/circuito, pilotos o histórico. Hasta que se resuelva: ejecutarlos en local y repetir volcado y carga, o empaquetarlos en una tarea futura.
- **Probar todo en un entorno real** (apartado 12), empezando por un subdominio.
- **Decidir sobre las vulnerabilidades de `npm audit`** (apartado 11).
- **Rotación de `logs/sync.log`.**
- **Valorar la estructura con la app fuera de `www`.**
