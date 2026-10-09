# Desplegar en Dinahosting (hosting Linux Profesional / Advanced)

Guía paso a paso para publicar MotoGP Stats en el hosting Linux "Profesional" (nivel Advanced) de Dinahosting. El despliegue en Railway está en [DEPLOY.md](DEPLOY.md); este documento es independiente y no lo sustituye.

**Estado:** el paquete y los scripts están preparados y probados en local (empaquetado, volcado y carga de datos contra una base de prueba). Solo se ha ejecutado en un servidor real la **Fase 0** (comprobaciones por SSH, resultados en el apartado [0.1](#01-por-ssh)); **el despliegue en sí no se ha ejecutado**. Ese primer servidor no tiene Node.js en el `PATH` ni `psql`, por lo que la guía incluye pasos para instalar Node con NVM (apartado [4.0](#40-instalar-nodejs-con-nvm)) y alternativas para cargar los datos (apartado [4.4](#44-cargar-los-datos)). Lo que depende del hosting está marcado como *según la documentación de Dinahosting* (dato publicado por ellos), *medido en el servidor* (Fase 0) o *pendiente de comprobar*. La lista completa está en [Qué no está verificado](#12-qué-no-está-verificado).

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

**El plan** (según la documentación de Dinahosting): Hosting Profesional Linux, nivel Advanced. Incluye Node.js 20.18.1 para las aplicaciones Node (y versiones propias con NVM por SSH), PostgreSQL 12, MySQL, cron, SSH sin root, Git y `.htaccess` (mod_rewrite, mod_headers…). No hay Docker, Redis ni MongoDB. No publican límites de memoria ni de CPU. **Medido en la Fase 0:** ese Node de Dinahosting no es accesible desde la sesión SSH (`node: command not found`); para usar `node`, `npm` y `npx` por SSH hay que instalar uno propio con NVM (apartado [4.0](#40-instalar-nodejs-con-nvm)). Según la ayuda de Dinahosting, la versión personalizada de Node se indica para planes Hosting Avanzado.

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
| `node -v`, `npm -v` | Lo esperable es `command not found` (así fue en el primer servidor probado). Si aparece una versión, debe ser 20.18 o superior: el paquete declara `engines.node >=20.18` (lo escribe `scripts/package-dinahosting.mjs`; el `package.json` del repo no declara `engines`), Next 16.3.3 exige `>=20.9.0`, Prisma 6.12.0 `>=18.18` y `app.js` usa `process.loadEnvFile`, que exige 20.12 o superior. Si falta o es antigua, ver [4.0](#40-instalar-nodejs-con-nvm) |
| `free -m`, `ulimit -a` | Memoria y límites. **Son los del servidor completo (hosting compartido), no los de tu cuenta**: los límites reales por cuenta (cgroup, cuota) se miran en [0.3](#03-comprobaciones-adicionales). Next.js necesita memoria para arrancar |
| `df -h .`, `du -sh ~` | Espacio libre del servidor y tamaño del home. La cuota real de la cuenta se mira en el panel. El `node_modules` ocupó unos 650 MB medidos en Windows: reserva ese espacio más el volcado (21,5 MB comprimido, 106 MB sin comprimir). `Permission denied` en directorios del hosting (`.db`, `.rc`, `.metadata`, `Maildir`) es normal |
| `which flock crontab psql gzip awk sha256sum` | `gzip`, `awk` y `sha256sum` los usa `cargar-datos.sh`; `crontab` es necesario para la Fase 6. `flock` no hace falta (el bloqueo lo hace el propio bundle). **`psql` falta en el primer servidor probado**: la carga del apartado [4.4](#44-cargar-los-datos) no funciona tal cual allí |
| Tres `curl -sI` | Cualquier línea `HTTP/...` significa que hay salida a internet. Las respuestas esperables son **404** para `binaries.prisma.sh`, **200** para `registry.npmjs.org` y **400** para la API de MotoGP: son las respuestas normales de esas URL raíz (desde la máquina de desarrollo salen los mismos códigos). Una salida vacía o un error de conexión indica que no hay salida: fallarían `npm ci`, la descarga del motor de Prisma y el cron |

**Resultado real en el primer servidor probado** (medido por SSH; datos del servidor compartido, no de la cuenta):

| Dato | Resultado |
|---|---|
| Sistema | Debian GNU/Linux 11 (bullseye), kernel 6.1, x86_64 |
| OpenSSL | 1.1.1w |
| glibc | **No medida.** Debian 11 usa glibc 2.31 (inferencia por la distribución): confírmalo con `getconf GNU_LIBC_VERSION` (apartado [0.3](#03-comprobaciones-adicionales)). Los binarios oficiales de Node para linux-x64 exigen glibc 2.28 o superior según los requisitos publicados de Node: **a confirmar** contra la documentación de Node |
| Node y npm | `node: command not found` y `npm: command not found` |
| Memoria del servidor | 28.060 MB en total, 12.251 usados, 11.566 disponibles, sin swap |
| `ulimit -a` | Memoria máxima, memoria virtual y tamaño de datos `unlimited`; archivos abiertos 1024; procesos de usuario 111980 |
| Disco del servidor | `/` de 1,5 TB al 91 % con 135 GB libres; `du -sh ~` → 120 KB |
| Herramientas | Presentes: `flock`, `crontab`, `gzip`, `awk`, `sha256sum`. **Ausente: `psql`** (no apareció en `which`) |
| Salida a internet | Hay: 404 (`binaries.prisma.sh`), 200 (`registry.npmjs.org`), 400 (API de MotoGP) |

### 0.2 En el panel y en PostgreSQL

Tras crear la base de datos (Fase 1) y conectar con `psql` (si en el servidor no existe, desde tu PC: ver [4.4](#44-cargar-los-datos)), comprueba:

```sql
SELECT version();
```

Lo que Dinahosting publica sobre bases de datos (<https://dinahosting.com/ayuda/como-creo-una-base-de-datos/> y <https://dinahosting.com/ayuda/base-de-datos-hosting-linux/>): el formulario de creación (Panel > Hosting > Bases de datos) pide nombre, versión, usuario administrador, contraseña y "Acceso desde"; la ayuda de conexión solo documenta MySQL (host `localhost` si la app está en la misma máquina, puerto 3306). **Para PostgreSQL no hay datos publicados** sobre host, puerto (el estándar es 5432, no verificado), phpPgAdmin ni conexión remota: todo eso está pendiente de comprobar en el panel. Dinahosting indica que PostgreSQL se incluye sin coste en los planes Profesional, Profesional Plus y Multihosting especial.

| Dato | Qué necesitas saber |
|---|---|
| Versión exacta de PostgreSQL | Según Dinahosting, la 12. El PostgreSQL local de desarrollo es el 18.6. **La versión mínima de PostgreSQL que exige Prisma 6.12 no está confirmada**: compruébala en la documentación oficial de Prisma antes de desplegar |
| Límite de tamaño de la BD | Se necesitan unos 175 MB, más el crecimiento de la temporada |
| Permisos | El usuario debe poder crear tablas y tipos en el esquema `public` (lo hace `prisma migrate deploy`) |
| SSL | Si el servidor lo exige, hay que añadir `sslmode=require` a la URL |
| Conexiones por usuario | Si el límite es 5 o menos, usa `connection_limit=2` (ver Fase 4) |
| Acceso remoto | Pendiente de comprobar. El formulario de creación permite elegir desde dónde se acepta el acceso (apartado 3), lo que sugiere que la conexión remota es posible, pero no hay documentación de PostgreSQL ni se ha medido el alcance del puerto. Se comprueba con `Test-NetConnection HOST -Port 5432` desde PowerShell (el 5432 es el puerto estándar, no verificado: usa el que indique el panel) |

### 0.3 Comprobaciones adicionales

Para cerrar lo que la primera salida no resolvió (Node ausente, `psql` ausente, límites reales de la cuenta):

```bash
echo $PATH; ls ~/.nvm 2>/dev/null; ls -la ~
ls /usr/lib/postgresql 2>/dev/null; find /usr /opt -maxdepth 4 -name 'psql*' -type f 2>/dev/null | head
getconf GNU_LIBC_VERSION; ldd --version | head -1
cat /proc/self/cgroup
cat /sys/fs/cgroup/memory.max 2>/dev/null
cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null
quota -s 2>/dev/null
```

| Salida | Qué buscar |
|---|---|
| `echo $PATH`, `ls ~/.nvm`, `ls -la ~` | Si hay algún directorio de Node en el `PATH` o un NVM ya instalado; qué hay en el home |
| `ls /usr/lib/postgresql`, `find … 'psql*'` | Si `psql` existe fuera del `PATH` (en ese caso se puede llamar con su ruta completa) |
| `getconf GNU_LIBC_VERSION`, `ldd --version` | glibc real. Los binarios de Node para linux-x64 exigen 2.28 o superior (a confirmar en la documentación de Node) |
| `/proc/self/cgroup`, `memory.max`, `memory.limit_in_bytes` | Límite de memoria de tu cuenta, si existe (`max` o un número enorme = sin límite). Las dos rutas corresponden a cgroup v2 y v1; lo normal es que exista una sola |
| `quota -s` | Cuota de disco de la cuenta, si el sistema la usa. Si no muestra nada, mira el panel |

---

## 3. Fase 1 — Panel de Dinahosting

1. Crea la base de datos PostgreSQL y su usuario (Panel > Hosting > Bases de datos). El formulario pide nombre, versión (Dinahosting recomienda elegir la que tengas en local; ver [0.2](#02-en-el-panel-y-en-postgresql)), usuario administrador, contraseña y **"Acceso desde"**, con tres opciones:
   - **Solo localhost** (la más segura según Dinahosting): **opción recomendada por defecto**. Solo sirve si la carga se hace desde el propio servidor (que necesita `psql` allí).
   - **Localhost + una IP concreta**: úsala **solo temporalmente** si cargas los datos desde tu PC (apartado [4.4](#44-cargar-los-datos)), con tu IP pública, y vuelve a "solo localhost" al terminar.
   - **Cualquier localización**: no recomendada.

   Anota host, puerto, nombre de base de datos, usuario y contraseña (host y puerto de PostgreSQL salen del panel: no los des por supuestos).
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

### 4.0 Instalar Node.js con NVM

Necesario si `node -v` dio `command not found` (Fase 0). Pasos según la ayuda de Dinahosting ([Utilizar versión personalizada de NodeJs](https://dinahosting.com/ayuda/utilizar-version-personalizada-de-nodejs/), indicada para planes Hosting Avanzado); no están ejecutados en este proyecto:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
node -v; npm -v; which node
```

- **Versión recomendada: Node 22 LTS.** Es la línea con la que se ha probado en local (v22.16.0). Mínimos comprobados en el código: el paquete declara `engines.node >=20.18`, Next 16.3.3 exige `>=20.9.0` y `app.js` y el bundle del cron usan `process.loadEnvFile` (Node 20.12 o superior).
- Anota la salida de `which node`: es la ruta que necesitan el cron (Fase 6) y, junto con la copia del binario, el panel (Fase 5). La ruta tendrá la forma `$HOME/.nvm/versions/node/vX.Y.Z/bin/node`.
- **Copia del binario para el panel.** La ayuda indica copiar el binario de `node` al directorio de la aplicación y, en el panel, indicar la "ruta al binario personalizado" (ver [Fase 5](#7-fase-5--aplicación-en-el-panel)). Su ejemplo de ruta es `/app1/v24.18.0/bin/node`, es decir, con estructura `vX.Y.Z/bin/node` dentro del directorio de la app. Qué hay que copiar exactamente (solo `bin/node` o la carpeta de la versión) y si la ruta del panel es relativa a la raíz de la aplicación: **pendiente de comprobar**.
- NVM solo está disponible en las sesiones que lo cargan (el instalador lo añade a `~/.bashrc`); los comandos de las fases siguientes que usan `node`, `npm` o `npx` dan por hecho que NVM está cargado. El cron **no** lo carga: usa la ruta absoluta.
- Actualizar Node más adelante implica repetir la copia del binario y actualizar la ruta del panel y del cron.

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
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"   # si node no está en el PATH (apartado 4.0)
cd ~/www/motogp
npm ci --omit=dev
```

Necesita internet (comprobada en la Fase 0) y Node en el `PATH` (apartado [4.0](#40-instalar-nodejs-con-nvm)): el `postinstall` ejecuta `prisma generate` y descarga el motor Linux. En el servidor probado (Debian 11, OpenSSL 1.1.1w) Prisma debería elegir el motor `debian-openssl-1.1.x`: **no verificado**. Si la salida indica que no encuentra un motor para la plataforma, ver [Problemas frecuentes](#13-problemas-frecuentes).

### 4.3 Crear el esquema

```bash
set -a; . ~/.motogp-stats.env; set +a
npx prisma migrate deploy
```

El repositorio tiene 6 migraciones (`ls prisma/migrations`); `comprobaciones.sql` espera ver las 6 aplicadas.

`prisma migrate deploy` **no necesita `psql`**: solo Node más el CLI de Prisma, ya sea por SSH en el servidor (como arriba) o desde tu PC con conexión remota a la base de datos (opción B del apartado 4.4).

### 4.4 Cargar los datos

`cargar-datos.sh` **usa `psql`**, que **no existe en el primer servidor probado**. Opciones, por orden de preferencia; **todas pendientes de comprobar**:

**A. Comprobar primero si `psql` existe fuera del `PATH`** (también en [0.3](#03-comprobaciones-adicionales)):

```bash
ls /usr/lib/postgresql 2>/dev/null; find /usr /opt -maxdepth 4 -name 'psql*' -type f 2>/dev/null | head
```

Si aparece, se puede ejecutar el script con ese `psql` delante en el `PATH` (p. ej. `PATH=/ruta/al/bin:$PATH bash cargar-datos.sh …`). El script llama a `psql` sin ruta absoluta.

**B. Carga remota desde tu PC.** Requiere que el puerto de PostgreSQL sea alcanzable desde fuera:

1. Crea la base de datos con "Acceso desde = localhost + tu IP" (Fase 1); vuelve a "solo localhost" al terminar.
2. Comprueba el alcance del puerto en PowerShell: `Test-NetConnection HOST -Port 5432` (usa el puerto que indique el panel).
3. Ejecuta `prisma migrate deploy` desde el repositorio local con `DATABASE_URL` apuntando al host de PostgreSQL de Dinahosting (no necesita `psql`). Antes comprueba con `npx prisma migrate status` que el objetivo es el remoto y no tu base local: un `DATABASE_URL` definido en el entorno suele tener prioridad sobre el `.env` del repo, pero no se ha verificado aquí.
4. Carga con el `psql` de tu PC (tienes el 18; un cliente más nuevo que el servidor es compatible), con las mismas comprobaciones de integridad. El script es **bash**: ejecútalo en Git Bash, no en PowerShell. Qué habría que cambiar o vigilar, sin modificar el script:
   - Necesita en el `PATH` de Git Bash `psql`, `gzip`, `awk` y `sha256sum` (comprueba con `which`; Git Bash suele traer los tres últimos, no verificado).
   - Lee `DATABASE_URL` del entorno (`export DATABASE_URL='postgresql://USUARIO:CLAVE@HOST:PUERTO/BD?schema=public'`, con la contraseña codificada en URL) y le quita `?schema=`.
   - Busca `filtro-volcado.awk` en su propia carpeta: ejecútalo desde `scripts/deploy/` del repo, pasando la ruta local del `.sql.gz` (el `.sha256` debe estar al lado).
   - Usa `-o /dev/null` en `psql`; en Git Bash `/dev/null` existe, pero no se ha probado.
   - Las comprobaciones de `comprobaciones.sql` se lanzan igual con el `psql` local.
   - No hay variante en PowerShell; si hiciera falta, sería una tarea futura.

**C. Cargador en Node para el servidor** (por ejemplo con `pg` y `pg-copy-streams`): **no existe**; sería una tarea futura (ver [Pendientes](#14-pendientes)).

**D. Herramientas web del panel** (si las hubiera): no se sabe si ofrecen importación de PostgreSQL ni qué límite de tamaño tienen. El volcado ocupa 21,5 MB comprimido y 106 MB sin comprimir.

Descripción del script (aplica con cualquiera de las opciones A y B):

`cargar-datos.sh` quita la query string `?schema=` de `DATABASE_URL` (libpq no la admite), comprueba el `.sha256` y `gzip -t`, **aborta si el destino ya tiene filas** en alguna tabla, carga todo en una sola transacción (si algo falla no queda nada a medias) y ejecuta `ANALYZE`. No necesita superusuario. Ejecución en el servidor (solo si hay `psql`, opción A):

```bash
cd ~/datos-deploy
set -a; . ~/.motogp-stats.env; set +a
bash cargar-datos.sh motogp-datos.sql.gz
```

Si el script aborta con "el destino ya tiene N filas", la carga se interrumpe sin tocar nada: vacía la base de datos y repite desde 4.3, o recréala desde el panel.

Comprobaciones posteriores (solo lectura; también requieren `psql`, en el servidor o en tu PC):

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
| Ruta al binario personalizado | Necesaria si usas Node instalado con NVM (apartado [4.0](#40-instalar-nodejs-con-nvm)). Según la ayuda de Dinahosting se indica además del directorio de la app y del archivo de inicio; su ejemplo es `/app1/v24.18.0/bin/node`. Para este proyecto sería la del binario copiado, p. ej. `…/v22.x.y/bin/node`. Formato exacto y si es relativa a la raíz: **pendiente de comprobar** |

Los nombres exactos de los campos y el comportamiento de Passenger son los de la documentación de Dinahosting; cómo trata `listen(0)` y dónde deja los logs está **pendiente de comprobar en el servidor**. Tras guardar, haz `touch tmp/restart.txt` (apartado 4.6).

---

## 8. Fase 6 — Cron de sincronización

Primero, una pasada manual para ver que funciona:

```bash
cd ~/www/motogp
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"   # si usas NVM (apartado 4.0)
which node
node sync-sessions.cjs
```

Debe cargar las variables (el log indica la **ruta** del fichero, nunca su contenido), conectar con la base de datos y terminar con un resumen ("Sin evento en curso" o "Evento en curso: …"). Si falla por la conexión, revisa `DATABASE_URL`.

Después, programa la tarea con `crontab -e` (o desde el panel, si Dinahosting lo ofrece). Cada 5 minutos:

```cron
*/5 * * * * cd $HOME/www/motogp && $HOME/.nvm/versions/node/vX.Y.Z/bin/node sync-sessions.cjs >> logs/sync.log 2>&1
```

**El cron no carga NVM por sí solo**, así que `node` no estará en su `PATH`: la ruta debe ser absoluta. Sustituye `vX.Y.Z` por la versión instalada (la que devuelve `which node` tras cargar NVM, apartado [4.0](#40-instalar-nodejs-con-nvm)). Que `$HOME` se expanda en el crontab de Dinahosting no está comprobado: si no funciona, escribe la ruta completa.

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
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"   # si usas NVM (apartado 4.0)
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

Del despliegue no se ha ejecutado nada en el hosting real; solo la Fase 0 (resultados en [0.1](#01-por-ssh)). Ya **medido** en el primer servidor probado: Debian 11 x86_64, OpenSSL 1.1.1w, salida a internet, presencia de `flock`, `crontab`, `gzip`, `awk` y `sha256sum`, y ausencia de Node y de `psql` en el `PATH`. Resérvate margen para ajustes en lo demás:

1. **Passenger real:** cómo se comporta `listen(0)`, dónde salen los logs (`app.js` escribe en stdout/stderr) y qué valida del "Path ejecutable".
2. **Memoria y límites reales de la cuenta** (lo medido es del servidor completo) y arranque en frío de Next.js bajo Passenger. Comprobaciones en [0.3](#03-comprobaciones-adicionales).
3. **Instalación de NVM y Node en este servidor**, copia del binario y "ruta al binario personalizado" en el panel (apartados 4.0 y Fase 5), y que el cron funcione con la ruta absoluta de NVM.
4. **Selección del motor de Prisma:** con OpenSSL 1.1 sobre Debian 11 Prisma debería elegir `debian-openssl-1.1.x`, pero no está verificado. Si no lo hace, hará falta `binaryTargets` en `prisma/schema.prisma`, que **no se ha tocado**. Tampoco está medida la versión de glibc (la de Debian 11 sería la 2.31, por inferencia) ni confirmado que sea suficiente para el binario de Node elegido (2.28 o superior, a confirmar).
5. **`npm ci` en Linux** (solo se ha medido en Windows: unos 650 MB).
6. **`prisma migrate deploy` contra un PostgreSQL 12 real**, y la versión mínima de PostgreSQL que soporta Prisma 6.12 (consultar la documentación oficial de Prisma).
7. **Las reglas de `.htaccess.seguridad`** contra un Apache real.
8. **La estructura con la app fuera de `www`.**
9. **La carga de datos con el último ajuste de `cargar-datos.sh`** (`-o /dev/null`), ni contra PostgreSQL 12. Lo probado en local es la carga completa anterior a ese ajuste.
10. **Cómo cargar los datos sin `psql` en el servidor:** si existe `psql` fuera del `PATH`, y si la carga remota desde el PC funciona (apartado [4.4](#44-cargar-los-datos)).
11. **PostgreSQL de Dinahosting:** host, puerto, **alcance real del puerto desde fuera**, phpPgAdmin, SSL obligatorio y límite de conexiones (no hay documentación publicada de PostgreSQL; Fase 0).
12. **Cuota de disco de la cuenta** (se mira en el panel).

---

## 13. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| `500` en toda la web tras añadir el `.htaccess` | Quita el bloque entre `MOTOGP-SEGURIDAD-INICIO` y `MOTOGP-SEGURIDAD-FIN` (hay copia en `../htaccess.copia-FECHA`), confirma que la web vuelve y avisa a soporte: alguna directiva no se permite |
| `node: command not found` / `npm: command not found` por SSH | Node no está en el `PATH` (es lo que pasó en el primer servidor). Instálalo con NVM y cárgalo en la sesión (apartado [4.0](#40-instalar-nodejs-con-nvm)) |
| El cron no ejecuta `node` (`node: command not found` en `logs/sync.log`) | El cron no carga NVM: usa la ruta absoluta `$HOME/.nvm/versions/node/vX.Y.Z/bin/node` (la de `which node` tras cargar NVM). Si no sale ni el error en el log, revisa que `logs/` exista |
| `psql: command not found` al cargar datos o hacer comprobaciones | `psql` no está en el servidor. Opciones (pendientes de comprobar) en el apartado [4.4](#44-cargar-los-datos): buscarlo fuera del `PATH`, cargar desde tu PC, o un cargador en Node futuro. `prisma migrate deploy` no lo necesita |
| `Prisma Client could not locate the Query Engine` / motor no encontrado | `npm ci --omit=dev` no pudo descargar o elegir el motor Linux. Comprueba la salida a `binaries.prisma.sh` (Fase 0: un `404` en la raíz es normal; lo que importa es que responda) y vuelve a ejecutar `npm ci --omit=dev`. Si se instala el motor equivocado, añade `binaryTargets` al esquema Prisma (cambio de código, fuera del alcance de esta guía: consúltalo) |
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

- **Instalar Node con NVM y completar la Fase 0** con el apartado [0.3](#03-comprobaciones-adicionales) (glibc, límites de cgroup, cuota, `psql` fuera del `PATH`).
- **Resolver la carga de datos sin `psql` en el servidor** (apartado [4.4](#44-cargar-los-datos)): comprobar si hay `psql`, probar la carga remota desde el PC o escribir un cargador en Node (`pg` y `pg-copy-streams`, no existe). Averiguar también el host y el puerto de PostgreSQL y si es alcanzable desde fuera.
- **Importadores `import:*` en el servidor.** No están empaquetados y no se sabe si la BD de Dinahosting acepta conexiones remotas (pendiente de comprobar; si las acepta, los `import:*` podrían ejecutarse desde el PC contra ella), así que hoy no hay forma probada de ejecutar en producción temporadas nuevas, categorías, detalles de evento/circuito, pilotos o histórico. Hasta que se resuelva: ejecutarlos en local y repetir volcado y carga, o empaquetarlos en una tarea futura.
- **Probar todo en un entorno real** (apartado 12), empezando por un subdominio.
- **Decidir sobre las vulnerabilidades de `npm audit`** (apartado 11).
- **Rotación de `logs/sync.log`.**
- **Valorar la estructura con la app fuera de `www`.**
