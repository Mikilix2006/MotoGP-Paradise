# Desplegar en un VPS de Clouding (Debian)

Guía práctica, paso a paso, para publicar MotoGP Stats en un servidor virtual (VPS) de Clouding con Debian. Está escrita para una persona **sin experiencia en consola**: cada paso dice qué escribir, dónde y qué debería verse. Es el despliegue **vigente**. El despliegue en Railway está en [DEPLOY.md](DEPLOY.md); el intento en el hosting compartido de Dinahosting (abandonado) está en [DEPLOY_DINAHOSTING.md](DEPLOY_DINAHOSTING.md).

**Servidor de referencia:** VPS Debian 13, 2 vCPU, 3,8 GiB de RAM, disco de 9,8 GB, IP pública fija y acceso `root` por SSH. En esta guía la IP es `IP_DEL_SERVIDOR`: sustitúyela por la tuya.

**Estado:** ver [Qué está verificado y qué no](#qué-está-verificado-y-qué-no). Resumen: el servidor se preparó, la web abre por IP, el despliegue con `-Ref`, la sincronización, la copia manual y el SSH solo con clave están verificados en el servidor real; HTTPS/dominio y la vuelta atrás automática **no se han probado**.

## Índice

1. [Qué es el despliegue y cómo encaja](#1-qué-es-el-despliegue-y-cómo-encaja)
2. [Requisitos](#2-requisitos)
3. [Fase 1 — Conectar por SSH](#3-fase-1--conectar-por-ssh)
4. [Fase 2 — Comprobaciones iniciales](#4-fase-2--comprobaciones-iniciales)
5. [Fase 3 — Preparar el servidor (`instalar-servidor.sh`)](#5-fase-3--preparar-el-servidor-instalar-servidorsh)
6. [Fase 4 — Desplegar la aplicación (`desplegar.ps1`)](#6-fase-4--desplegar-la-aplicación-desplegarps1)
7. [Fase 5 — Cargar los datos](#7-fase-5--cargar-los-datos)
8. [Fase 6 — Comprobar la web y comandos útiles](#8-fase-6--comprobar-la-web-y-comandos-útiles)
9. [Fase 7 — Dominio y HTTPS](#9-fase-7--dominio-y-https)
10. [Actualizaciones](#10-actualizaciones)
11. [Copias de seguridad](#11-copias-de-seguridad)
12. [Seguridad](#12-seguridad)
    - [12.1 Endurecer SSH (solo con clave)](#121-endurecer-ssh-solo-con-clave)
13. [Problemas frecuentes](#13-problemas-frecuentes)
14. [Qué está verificado y qué no](#qué-está-verificado-y-qué-no)

---

## 1. Qué es el despliegue y cómo encaja

"Desplegar" es poner la aplicación en un ordenador que está siempre encendido (el VPS) para que cualquiera pueda abrirla desde un navegador.

```text
Navegador ──► Caddy (puertos 80/443, abiertos a Internet)
                 │  proxy inverso (y HTTPS automático si hay dominio)
                 ▼
              Node.js 127.0.0.1:3000   (servicio systemd "motogp-stats")
                 │  solo accesible desde el propio servidor
                 ▼
              PostgreSQL local (solo escucha en localhost)

Temporizadores systemd:
  motogp-sync    cada 5 min  → una pasada de sincronización de sesiones (sync-sessions.cjs)
  motogp-backup  diaria 03:30 → copia de la base de datos (pg_dump)
```

Piezas, todas bajo `scripts/clouding/` salvo indicación:

| Fichero | Dónde se ejecuta | Para qué |
|---|---|---|
| `instalar-servidor.sh` | Servidor, una vez, como root | Prepara el servidor (Fase 3). Repetible |
| `desplegar.ps1` | Tu PC (PowerShell) | Empaqueta la app, la sube e invoca `instalar-release.sh` (Fase 4) |
| `instalar-release.sh` | Servidor (lo lanza `desplegar.ps1`) | Instala dependencias, migra la base de datos, cambia de versión y comprueba la salud |
| `copia-bd.sh` | Servidor (se instala como `motogp-copia-bd`) | Copia de seguridad de la base de datos |
| `systemd/*` | Servidor | Unidades `motogp-stats.service`, `motogp-sync.service/.timer`, `motogp-backup.service/.timer` |
| `scripts/deploy/*` | PC y servidor | Volcado y carga de los datos (Fase 5) |
| `scripts/dinahosting/app.js` | Servidor (dentro del paquete) | Punto de entrada de Node; con `PORT` definido (y `HOST`) funciona en modo proxy |
| `scripts/package-dinahosting.mjs` | Tu PC (`npm run package:dinahosting`) | Genera el paquete `dist/dinahosting/` que sube `desplegar.ps1` (el nombre es histórico) |

La sincronización en vivo y los temporizadores sustituyen al *worker* de Railway ([DEPLOY.md](DEPLOY.md)).

## 2. Requisitos

- Un servidor **Debian 12 o superior** con acceso `root` (el script lo comprueba y se detiene si no).
- En tu PC Windows: **PowerShell** con los comandos `ssh` y `scp` (cliente OpenSSH; viene en Windows 10/11 como característica opcional), **Node.js** y `npm`, y `git`.
- El repositorio del proyecto descargado y `npm install` hecho.
- Para la carga de datos (Fase 5): `pg_dump` en tu PC (PostgreSQL instalado) y tu base de datos local con datos.

Todos los comandos de PowerShell se escriben en la **raíz del repositorio**, salvo que se diga otra cosa.

## 3. Fase 1 — Conectar por SSH

SSH es la forma de manejar el servidor escribiendo comandos desde tu PC.

1. **Abre el cortafuegos de la plataforma.** El cortafuegos del panel de Clouding funciona **por perfiles**: en el perfil asignado al servidor hay que permitir de **entrada** TCP **22** (SSH), **80** (web) y **443** (web con HTTPS). Sin la regla del 22 no podrás conectar.
2. En PowerShell:

   ```powershell
   ssh root@IP_DEL_SERVIDOR
   ```

   La primera vez pregunta si confías en el servidor: escribe `yes`. Luego pide la contraseña de `root` (al teclearla **no se ve nada**: es normal). Debe aparecer un indicador del tipo `root@nombre:~#`.
3. Para salir: `exit`.

Si falla con `Connection timed out`, casi siempre es el perfil del cortafuegos del panel (falta el 22). Mientras lo arreglas, la **consola de emergencia** del panel de Clouding entra al servidor **sin SSH** y sirve para ejecutar comandos igualmente.

## 4. Fase 2 — Comprobaciones iniciales

Ya dentro del servidor, este comando muestra sistema, memoria, disco, salida a Internet y estado de SSH:

```bash
cat /etc/os-release | head -3; free -h; df -h /; curl -sS -m 5 -o /dev/null -w 'Internet: HTTP %{http_code}\n' https://nodejs.org; systemctl is-active ssh
```

Qué debe salir: Debian 12 o superior, memoria y disco acordes con tu plan (en el de referencia, 3,8 GiB y 9,8 GB), `Internet: HTTP 200` (o 301/302) y `active` en la última línea. Anota el espacio libre: cada versión desplegada ocupa unos 650 MB ([disco lleno](#13-problemas-frecuentes)).

## 5. Fase 3 — Preparar el servidor (`instalar-servidor.sh`)

1. **Sube la carpeta entera** desde tu PC (otra ventana de PowerShell, en la raíz del repositorio):

   ```powershell
   scp -r scripts\clouding root@IP_DEL_SERVIDOR:/root/
   ```

   Hay que subir la carpeta completa: el script usa los ficheros que tiene al lado (`systemd/*` y `copia-bd.sh`) y se detiene si faltan.
2. **Ejecútalo en el servidor** (sesión SSH):

   ```bash
   bash /root/clouding/instalar-servidor.sh
   ```

   Tarda unos minutos (actualiza el sistema e instala paquetes). `bash instalar-servidor.sh --ayuda` muestra su ayuda.

**Qué hace, en sus 9 pasos:**

| Paso | Qué hace |
|---|---|
| 1/9 | Comprueba root, Debian 12+, que estén los ficheros y que `DOMINIO` (si se indica) sea válido |
| 2/9 | `apt update/upgrade` e instala paquetes base (`ufw`, `postgresql`, `curl`, `jq`…); activa las actualizaciones de seguridad automáticas (sin reinicio automático) |
| 3/9 | Instala Node.js (versión mayor `NODE_MAJOR`, por defecto 22) desde nodejs.org verificando la suma SHA-256, en `/opt/node-<versión>` con enlaces en `/usr/local/bin`. Si ya hay Node >= 20.18, no lo toca |
| 4/9 | Crea el usuario de sistema `motogp` (sin consola) y los directorios `/srv/motogp/{releases,shared}` y `/var/backups/motogp` |
| 5/9 | PostgreSQL solo en `localhost`; crea el rol y la base `motogp` (UTF8) con una contraseña aleatoria que no se muestra |
| 6/9 | Crea `/etc/motogp-stats.env` (root:motogp, modo 640) con `NODE_ENV`, `PORT=3000`, `HOST=127.0.0.1`, `DATABASE_URL` y las URL de la API de MotoGP |
| 7/9 | Cortafuegos `ufw`: deniega la entrada salvo SSH (puertos detectados, permitidos antes de activarlo), 80 y 443 |
| 8/9 | Instala Caddy (de Debian o, si no está, del repositorio oficial) y escribe `/etc/caddy/Caddyfile` |
| 9/9 | Instala `motogp-copia-bd` en `/usr/local/sbin`, copia las unidades systemd y activa los temporizadores `motogp-sync` y `motogp-backup`. `motogp-stats` queda habilitado pero **no arrancado** hasta que haya un despliegue |

**Variables opcionales** (se escriben delante del comando):

| Variable | Efecto |
|---|---|
| `DOMINIO=motogp.midominio.es` | Caddy sirve ese dominio con HTTPS automático (el DNS debe apuntar ya al servidor). Sin ella, solo HTTP por IP |
| `NODE_MAJOR=22` | Versión mayor de Node.js a instalar (por defecto 22) |

Ejemplo: `DOMINIO=motogp.midominio.es bash /root/clouding/instalar-servidor.sh`.

**Es idempotente:** se puede repetir sin miedo. No sobrescribe la contraseña de la base de datos, ni `/etc/motogp-stats.env` si ya existe, ni un Caddyfile propio (guarda copia en `/etc/caddy/Caddyfile.original-<fecha>` si no lo gestionaba él).

**El resumen final** (cuadro `SERVIDOR PREPARADO`) indica la versión de Node, el cortafuegos, la URL de la web y los próximos pasos. Si algo falla, el script se detiene y dice en qué línea; corrige el problema y vuelve a lanzarlo.

## 6. Fase 4 — Desplegar la aplicación (`desplegar.ps1`)

Desde la raíz del repositorio, en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\clouding\desplegar.ps1 -Servidor IP_DEL_SERVIDOR
```

(`-ExecutionPolicy Bypass` evita que Windows bloquee el script, ver [Problemas frecuentes](#13-problemas-frecuentes)). Si no usas clave SSH, la contraseña se pedirá varias veces (una por cada `ssh`/`scp`): es normal.

| Parámetro | Para qué |
|---|---|
| `-Servidor` (obligatorio) | IP o nombre del servidor |
| `-Usuario` | Usuario SSH (por defecto `root`; si no es `root` debe poder usar `sudo` sin contraseña) |
| `-Puerto` | Puerto SSH (por defecto 22) |
| `-Ref` | Rama, etiqueta, hash u `origin/main`: despliega **exactamente ese commit** |
| `-SoloEmpaquetar` | Construye el paquete en `dist\paquete-<hash7>` pero **no** sube ni ejecuta nada (`-Servidor` sigue siendo obligatorio; vale `127.0.0.1`) |

**Qué versión se despliega:**

- **Sin `-Ref`**: se empaqueta tu **carpeta de trabajo** tal como está. Si hay cambios sin commitear, avisa y anota `limpio=no`.
- **Con `-Ref`** (p. ej. `-Ref main`): se despliega exactamente ese commit. Se construye en un *worktree* temporal limpio bajo `%TEMP%` (`mgp-<hash7>`), sin tocar tu carpeta de trabajo. El build de Next necesita `DATABASE_URL`, así que se **copia tu `.env` local al worktree solo para el build** (no se lee ni se muestra) y el worktree entero, con esa copia, se **borra al terminar**. El commit debe contener ya las herramientas de despliegue.

**Qué hace, en 4 pasos:** (1) empaqueta con `npm run package:dinahosting`; (2) crea un directorio temporal en el servidor; (3) sube el paquete y `instalar-release.sh` con `scp`; (4) ejecuta `instalar-release.sh` por `ssh`. Este último, a su vez:

1. Mueve el paquete a `/srv/motogp/releases/AAAAMMDD-HHMMSS`.
2. `npm ci --omit=dev` (necesita Internet).
3. `prisma migrate deploy` con las variables de `/etc/motogp-stats.env`. **Esto crea las tablas** en la base de datos.
4. Cambia el enlace `/srv/motogp/current` al release nuevo (cambio atómico) y reinicia `motogp-stats`.
5. **Comprueba la salud** durante hasta 150 s en `http://127.0.0.1:<PORT>/api/next-gp`: acepta **200** (hay datos) o **404** (app y base de datos bien, pero aún sin Gran Premio cargado: normal en una instalación nueva). Un 500 cuenta como fallo.

Si la comprobación **falla**, `instalar-release.sh` muestra los últimos logs y **vuelve solo al release anterior** (si es la primera instalación no hay a qué volver). Los releases se organizan así:

```text
/srv/motogp/
├── releases/AAAAMMDD-HHMMSS/   cada versión desplegada (se conservan las 3 últimas)
├── current  → releases/...     enlace a la versión activa
└── shared/release-anterior     ruta de la versión anterior
```

**Fichero `REVISION`:** `desplegar.ps1` lo escribe en cada paquete (`commit`, `ref`, `fecha`, `limpio`); `instalar-release.sh` lo muestra al empezar y al terminar, y queda dentro del release. En el servidor:

```bash
cat /srv/motogp/current/REVISION
```

## 7. Fase 5 — Cargar los datos

La base de datos del servidor está vacía. Los datos se llevan desde tu base local con un volcado. **Orden obligatorio:** primero la Fase 4 (el despliegue crea las tablas con `prisma migrate deploy`) y después la carga; `cargar-datos.sh` necesita que las tablas existan.

**1. Volcado en tu PC** (PowerShell, raíz del repositorio). `volcar-datos.ps1` lee la conexión de las variables de entorno estándar `PG*` de **esa sesión** (no lee `.env`); pon los valores de tu base local y la contraseña solo en la sesión, nunca en un fichero:

```powershell
$env:PGHOST='localhost'; $env:PGPORT='5432'; $env:PGUSER='USUARIO_LOCAL'; $env:PGDATABASE='NOMBRE_BD_LOCAL'
$env:PGPASSWORD='LA_CONTRASEÑA_LOCAL'
.\scripts\deploy\volcar-datos.ps1 -Salida .\motogp-datos.sql.gz
```

Los valores salen de la `DATABASE_URL` de tu `.env` local. Si `pg_dump` no está en el `PATH`, define `$env:PG_BIN` con la carpeta `bin` de PostgreSQL. Genera `motogp-datos.sql.gz` y su `.sha256` (solo datos, sin `_prisma_migrations`; ambos están en `.gitignore`).

**2. Subida al servidor:**

```powershell
ssh root@IP_DEL_SERVIDOR "mkdir -p /root/datos-deploy"
scp .\motogp-datos.sql.gz .\motogp-datos.sql.gz.sha256 root@IP_DEL_SERVIDOR:/root/datos-deploy/
scp .\scripts\deploy\cargar-datos.sh .\scripts\deploy\filtro-volcado.awk .\scripts\deploy\comprobaciones.sql root@IP_DEL_SERVIDOR:/root/datos-deploy/
```

**3. Carga en el servidor:**

```bash
cd /root/datos-deploy
set -a; . /etc/motogp-stats.env; set +a
bash cargar-datos.sh motogp-datos.sql.gz
```

Comprueba el `.sha256` y la integridad del gzip, **aborta si alguna tabla ya tiene filas** (no toca nada), carga todo en una sola transacción (si falla no queda nada a medias) y ejecuta `ANALYZE`.

**4. Comprobaciones** (solo lectura):

```bash
psql "${DATABASE_URL%%\?*}" -X -f comprobaciones.sql
```

Cifras de referencia de la base local (dato del propietario; no se han recontado aquí): **2.659 pilotos, 1.188 eventos, 12.594 sesiones, ~239.000 resultados, 55 países, 146 eventos con bandera, 6 migraciones** (hay 6 carpetas en `prisma/migrations/`). Las 6 migraciones deben salir con `ok = t`, el recuento por tabla debe igualar al de origen y no debe haber FK sin validar. Los pasos del volcado y la carga se explican con más detalle (aunque pensados para otro servidor) en [DEPLOY_DINAHOSTING.md](DEPLOY_DINAHOSTING.md).

## 8. Fase 6 — Comprobar la web y comandos útiles

Abre en el navegador `http://IP_DEL_SERVIDOR`. Mientras no haya dominio, la web va por HTTP (sin cifrar).

Comandos útiles en el servidor:

| Comando | Para qué |
|---|---|
| `journalctl -u motogp-stats -f` | Ver los logs de la app en directo (Ctrl+C para salir) |
| `systemctl status motogp-stats` | Estado del servicio |
| `systemctl list-timers 'motogp-*'` | Cuándo corrieron/correrán la sincronización y la copia |
| `motogp-copia-bd` | Hacer una copia de la base de datos ahora |
| `ls /var/backups/motogp` | Ver las copias existentes |
| `cat /srv/motogp/current/REVISION` | Qué versión está desplegada |

## 9. Fase 7 — Dominio y HTTPS

Mientras no haya dominio, la web se sirve **solo por HTTP** en la IP. Cuando tengas dominio:

1. En el DNS del dominio, crea un **registro A** que apunte a `IP_DEL_SERVIDOR` y espera a que se propague.
2. En el servidor: `DOMINIO=su.dominio.es bash /root/clouding/instalar-servidor.sh`. Caddy obtendrá el certificado HTTPS automáticamente (requiere 80 y 443 abiertos, también en el cortafuegos del panel).

Idea **no probada**: algunos servicios resuelven nombres del tipo `IP-con-guiones.sslip.io` hacia la IP indicada, lo que permitiría probar HTTPS sin comprar dominio. No se ha comprobado con este proyecto; no cuentes con ello.

## 10. Actualizaciones

Para publicar cambios, repite la Fase 4 (`desplegar.ps1`, mejor con `-Ref` para desplegar un commit concreto). Cada ejecución crea un release nuevo y conserva los 3 últimos.

Aviso: las **migraciones de base de datos se aplican antes del cambio de versión y NO se deshacen en la vuelta atrás automática**. Si una migración borra o renombra algo que usa la versión anterior, esa versión podría no funcionar tras volver. Las migraciones de este proyecto suelen solo añadir.

## 11. Copias de seguridad

- **Copia diaria automática** (`motogp-backup`, 03:30 con hasta 15 min de retraso aleatorio): `pg_dump` comprimido en `/var/backups/motogp/motogp-AAAAMMDD-HHMMSS.sql.gz`, modo 600, se conservan las **14** últimas. Para restaurar en una base **vacía**: `gunzip -c FICHERO.sql.gz | sudo -u postgres psql -v ON_ERROR_STOP=1 motogp`.
- **Instantáneas del panel de Clouding:** se recomienda usarlas además (según la web de Clouding el servicio las permite; no se han probado aquí).
- **Una copia fuera del servidor**, porque las copias locales se pierden si se pierde el servidor. Desde tu PC: `scp root@IP_DEL_SERVIDOR:/var/backups/motogp/FICHERO.sql.gz .`

## 12. Seguridad

- **SSH solo con clave** (paso manual, **no automatizado a propósito** para no dejarte fuera del servidor por error): ver [12.1](#121-endurecer-ssh-solo-con-clave). Sigue permitido el usuario `root` (solo con clave); un usuario no root con `sudo` y `fail2ban` son mejoras opcionales no hechas.
- PostgreSQL escucha solo en `localhost`; el puerto 5432 no está abierto.
- `ufw` deniega todo lo entrante salvo SSH, 80 y 443. El cortafuegos del panel de Clouding es una segunda capa y debe permitir los mismos puertos.
- `DATABASE_URL` (con la contraseña de la base) vive solo en `/etc/motogp-stats.env`, propietario `root`, grupo `motogp`, modo 640.
- **Nunca teclees contraseñas como si fueran comandos ni las pegues en chats o documentos.** Si una contraseña se ha expuesto, cámbiala.

### 12.1 Endurecer SSH (solo con clave)

Verificado en el servidor real. **Orden seguro:** instalar la clave, comprobarla desde una ventana nueva y solo después desactivar la contraseña. No cierres la sesión SSH que ya tienes abierta hasta comprobar que la nueva entra con clave.

1. **Clave en tu PC.** Si no tienes, créala en PowerShell (lo más limpio es una clave aparte: `ssh-keygen -t ed25519 -f $HOME\.ssh\id_ed25519_clouding`; si ya existe `~/.ssh/id_ed25519` y la usas para GitHub, los comandos de abajo la reutilizan, y con una clave aparte hay que añadir `-i` y el nombre del fichero o usar `~/.ssh/config`).
2. **Instalar la clave pública** en el servidor, desde PowerShell **del PC** (el `tr -d '\r'` quita el retorno de carro que añade PowerShell 5.1):

   ```powershell
   Get-Content $HOME\.ssh\id_ed25519.pub | ssh root@IP_DEL_SERVIDOR "umask 077; mkdir -p ~/.ssh; tr -d '\r' >> ~/.ssh/authorized_keys"
   ```

3. **Comprobar la huella** (debe ser idéntica): `ssh-keygen -lf $HOME\.ssh\id_ed25519.pub` en el PC y `ssh-keygen -lf ~/.ssh/authorized_keys` en el servidor.
4. **Probar la clave desde una ventana NUEVA de PowerShell del PC** (indicador `PS C:\...>`, no el del servidor). Debe imprimir `CLAVE_OK`:

   ```powershell
   ssh -o PasswordAuthentication=no -o PreferredAuthentications=publickey root@IP_DEL_SERVIDOR "echo CLAVE_OK"
   ```

5. **Desactivar contraseñas** (en el servidor, solo si el paso 4 funcionó). El fichero empieza por `00-` a propósito: `sshd` aplica la **primera** opción que encuentra y una imagen cloud puede traer un `50-cloud-init.conf` que reactive las contraseñas.

   ```bash
   cat > /etc/ssh/sshd_config.d/00-motogp-ssh.conf <<'EOF'
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PermitRootLogin prohibit-password
   EOF
   sshd -t && systemctl reload ssh
   ```

6. **Comprobar el resultado:** `sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication'`. En el servidor real pasó de `permitrootlogin yes` y `passwordauthentication yes` a `permitrootlogin without-password` (alias antiguo de `prohibit-password`), `passwordauthentication no` y `kbdinteractiveauthentication no`. Desde el PC, `ssh root@IP_DEL_SERVIDOR "echo ENTRO_CON_CLAVE"` entra con la clave y `ssh -o PubkeyAuthentication=no root@IP_DEL_SERVIDOR` da `Permission denied (publickey)`.

**Reversión:** `rm /etc/ssh/sshd_config.d/00-motogp-ssh.conf && systemctl reload ssh`. Si pierdes la clave privada, la **consola de emergencia** del panel de Clouding sigue aceptando la contraseña de `root` (este cambio solo afecta a SSH).

Con esto, `desplegar.ps1` y los `scp` de la guía usan la clave sin pedir contraseña (siguen entrando como `root`).

## 13. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `ssh` da `Connection timed out` | Falta la regla de entrada TCP 22 en el perfil del cortafuegos del panel de Clouding. Mientras tanto usa la consola de emergencia del panel |
| La web da 502 o no responde | Mira `systemctl status motogp-stats` y `journalctl -u motogp-stats -n 100 --no-pager`. Comprueba que 80/443 están abiertos en el panel. Si la app no arranca, revisa `/etc/motogp-stats.env` y que PostgreSQL esté activo |
| `desplegar.ps1` "no se puede cargar porque la ejecución de scripts está deshabilitada" | Lánzalo con `powershell -ExecutionPolicy Bypass -File .\scripts\clouding\desplegar.ps1 -Servidor IP_DEL_SERVIDOR` |
| En el servidor: `bash: invalid option name: set: pipefail` | El script llegó con finales de línea de Windows (CRLF). El repositorio tiene `.gitattributes` con `eol=lf` para `scripts/clouding/*`, `scripts/deploy/*` y `scripts/dinahosting/*`; si aun así ocurre, vuelve a bajar los ficheros o ejecuta `sed -i 's/\r$//' FICHERO` en el servidor |
| El despliegue termina con "la app NO responde" y vuelve atrás | Falla la comprobación de salud (500 o sin respuesta en 150 s). Lee los logs que muestra; causas típicas: `DATABASE_URL` mal, migración fallida, PostgreSQL parado. El release fallido queda en `/srv/motogp/releases/` para investigarlo |
| Disco lleno / `npm ci` falla | Cada release ocupa unos **650 MB** y se conservan 3, en un disco de 9,8 GB. Revisa con `df -h /` y, si hace falta, borra releases antiguos que no sean `current` ni el anterior, o amplía el disco |
| `ufw: command not found` o `psql: command not found` | `instalar-servidor.sh` no terminó (instala `ufw` y los clientes de PostgreSQL). Vuelve a ejecutarlo; es repetible. Para `ufw` en una sesión sin `/usr/sbin` en el `PATH`, usa `/usr/sbin/ufw` |
| `cargar-datos.sh`: "el destino ya tiene N filas" | La base ya tiene datos y la carga se niega a duplicarlos. No se ha tocado nada |
| Al probar la clave SSH: `Permission denied (publickey,password)` | El comando se ejecutó **dentro del servidor** (indicador `root@NOMBRE:~#`): el servidor intentó conectarse a sí mismo y la clave privada está en tu PC. La prueba va en PowerShell del PC (indicador `PS C:\...>`) |
| Ya tenías `~/.ssh/id_ed25519` (p. ej. de GitHub) | Los comandos de [12.1](#121-endurecer-ssh-solo-con-clave) la reutilizan. Más limpio: una clave aparte (`ssh-keygen -t ed25519 -f $HOME\.ssh\id_ed25519_clouding`) |
| Te quedas sin acceso tras endurecer SSH | Por eso no se cierra la sesión antigua hasta comprobar la nueva. Si ya ocurrió: consola de emergencia del panel de Clouding y reversión de [12.1](#121-endurecer-ssh-solo-con-clave) |
| Pegaste dos líneas juntas y una contraseña acabó escrita como comando | Un `read -s` consumió la segunda línea como contraseña y la real se tecleó como orden. Pega las órdenes de una en una y **cambia la contraseña** si ocurre |

## Qué está verificado y qué no

**Verificado en el servidor real (por el usuario):**

- `instalar-servidor.sh` terminó con "SERVIDOR PREPARADO" en Debian 13.
- La web abrió por IP tras desplegar con la versión anterior de `desplegar.ps1`.
- El despliegue con `desplegar.ps1 -Servidor IP_DEL_SERVIDOR -Ref main` funcionó: `/srv/motogp/current/REVISION` mostró `commit=8b95748781d76eb0dc9bf5f92754bedefd1aa7ab`, `ref=main`, `limpio=si`, con 2 releases en `/srv/motogp/releases`.
- Servicios `motogp-stats`, `caddy` y `postgresql` activos. La app escucha solo en `127.0.0.1:3000` y PostgreSQL solo en `127.0.0.1:5432` y `[::1]:5432`. `ufw` activo con 22, 80 y 443.
- `motogp-sync` se dispara cada 5 minutos y una pasada refresca las 20 sesiones del evento en curso y termina con éxito (log de journald).
- `motogp-copia-bd` manual creó `/var/backups/motogp/motogp-FECHA.sql.gz` de 22 MB con permisos 600 y propietario root. El temporizador `motogp-backup` está programado.
- Disco: 4,7 GB usados de 9,8 GB; cada release ocupa unos 650 MB (1,6 GB en `/srv/motogp` con dos).
- SSH endurecido (solo clave, `PermitRootLogin prohibit-password`): ver [12.1](#121-endurecer-ssh-solo-con-clave).
- Carga de datos: indicio de que la temporada está cargada (la web abre y la sincronización refresca sesiones), **sin recuento de filas** del servidor.

**Verificado en local (en el PC, no en el servidor):**

- Sintaxis de los scripts (`bash -n` y el analizador de PowerShell).
- `app.js` con `PORT`/`HOST`.
- Empaquetado con `-Ref` desde un worktree.

**NO verificado en el servidor** (no lo des por hecho):

- HTTPS con dominio.
- La vuelta atrás automática.
- La primera ejecución automática de madrugada de `motogp-backup` (solo se ha probado la copia manual).
- El recuento de filas de la carga de datos en este servidor.
- `systemd-analyze verify` sobre las unidades.
- Los `import:*` en el servidor.
- Las cifras de referencia de la Fase 5 en la base cargada en el servidor.
- El truco de `sslip.io`.
- Las instantáneas del panel de Clouding.

**Limitación conocida:** los importadores `import:*` completos no se empaquetan. Con un VPS se podrían ejecutar desde un checkout del repositorio en el servidor, pero **eso no está documentado ni probado**; hoy los datos nuevos se importan en local y se llevan por volcado (ver [AGENTS.md](AGENTS.md), deudas conocidas).
