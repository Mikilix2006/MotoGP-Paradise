#!/usr/bin/env bash
# =============================================================================
# instalar-servidor.sh - Prepara un VPS Debian 12+ (Clouding) para MotoGP Stats.
#
# SE EJECUTA UNA VEZ, COMO ROOT, EN EL SERVIDOR RECIEN CREADO. Es seguro repetirlo:
# no sobrescribe contraseñas ni ficheros que ya existan.
#
# COMO LLEVAR LOS FICHEROS AL SERVIDOR (decision: rutas relativas al script)
#   Este script usa los ficheros que hay a su lado (systemd/*, copia-bd.sh), asi que
#   hay que subir la carpeta scripts/clouding ENTERA. Desde el PC (PowerShell):
#       scp -r scripts\clouding root@IP_DEL_SERVIDOR:/root/
#   y en el servidor:
#       bash /root/clouding/instalar-servidor.sh
#
# USOS
#   1) Instalar el servidor:   bash instalar-servidor.sh
#      Variables opcionales (se escriben delante del comando):
#        DOMINIO=midominio.es   Caddy sirve ese dominio con HTTPS automatico
#                               (el DNS debe apuntar ya a la IP del servidor).
#                               Sin DOMINIO se sirve HTTP en el puerto 80 por IP.
#        NODE_MAJOR=22          Version mayor de Node.js (por defecto 22).
#      Ejemplo:  DOMINIO=motogp.midominio.es bash instalar-servidor.sh
#   2) Desplegar la app y cargar los datos: lo hace desplegar.ps1 desde el PC
#      (sube el paquete e invoca instalar-release.sh). Para cargar el volcado de
#      datos existente use scripts/deploy/cargar-datos.sh con la DATABASE_URL de
#      /etc/motogp-stats.env (ver la guia de despliegue).
#
#   bash instalar-servidor.sh --ayuda    muestra este texto.
# =============================================================================
set -Eeuo pipefail
export PATH="$PATH:/usr/sbin:/sbin:/usr/local/sbin"

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_MAJOR="${NODE_MAJOR:-22}"
DOMINIO="${DOMINIO:-}"
ENV_FILE="/etc/motogp-stats.env"
APP_USER="motogp"
APP_HOME="/srv/motogp"
NODE_MIN_MAJOR=20
NODE_MIN_MINOR=18

paso() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
aviso() { printf '    AVISO: %s\n' "$*" >&2; }
fallo() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

if [ "${1:-}" = "--ayuda" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
fi

cd /   # (tras calcular AQUI y la ayuda, que usan rutas relativas) evita el aviso "could not change directory to /root" de psql como postgres

TMP=""
limpiar() { if [ -n "$TMP" ]; then rm -rf "$TMP"; fi; }
trap limpiar EXIT
trap 'printf "\nERROR: el script se detuvo en la linea %s. Corrija el problema y vuelva a ejecutarlo (es repetible).\n" "$LINENO" >&2' ERR

# ---------------------------------------------------------------- (a) Requisitos
paso "1/9 Comprobando el sistema"
[ "$(id -u)" -eq 0 ] || fallo "ejecutelo como root (o con sudo)."
[ -r /etc/os-release ] || fallo "no se puede leer /etc/os-release."
# shellcheck disable=SC1091
. /etc/os-release
[ "${ID:-}" = "debian" ] || fallo "este script es para Debian (se detecto: ${ID:-desconocido})."
[ "${VERSION_ID:-0}" -ge 12 ] 2>/dev/null || fallo "se necesita Debian 12 o superior (se detecto: ${VERSION_ID:-?})."
for f in systemd/motogp-stats.service systemd/motogp-sync.service systemd/motogp-sync.timer \
         systemd/motogp-backup.service systemd/motogp-backup.timer copia-bd.sh; do
  [ -f "$AQUI/$f" ] || fallo "falta $AQUI/$f. Suba la carpeta scripts/clouding ENTERA."
done
if [ -n "$DOMINIO" ] && ! [[ "$DOMINIO" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  fallo "DOMINIO no es valido: '$DOMINIO' (escriba solo el nombre, sin https:// ni barras)."
fi
info "Debian $VERSION_ID, usuario root. Dominio: ${DOMINIO:-(ninguno, se servira por HTTP en la IP)}"

# ------------------------------------------------------------ (b) Paquetes base
paso "2/9 Actualizando el sistema e instalando paquetes base (puede tardar unos minutos)"
export DEBIAN_FRONTEND=noninteractive
APT=(apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
"${APT[@]}" update
"${APT[@]}" upgrade
"${APT[@]}" install curl ca-certificates gnupg ufw unattended-upgrades apt-listchanges \
  postgresql postgresql-client xz-utils openssl jq tar gzip util-linux

# Actualizaciones de seguridad automaticas (sin reinicio automatico del servidor).
if [ ! -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APTCONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APTCONF
  info "Actualizaciones de seguridad automaticas activadas."
else
  info "Actualizaciones automaticas: ya configuradas (no se toca)."
fi

# ------------------------------------------------------------------- (c) Node.js
paso "3/9 Instalando Node.js $NODE_MAJOR"
node_suficiente() {
  command -v node >/dev/null 2>&1 || return 1
  local v major minor
  v="$(node -p 'process.versions.node' 2>/dev/null)" || return 1
  major="${v%%.*}"; minor="${v#*.}"; minor="${minor%%.*}"
  [ "$major" -gt "$NODE_MIN_MAJOR" ] || { [ "$major" -eq "$NODE_MIN_MAJOR" ] && [ "$minor" -ge "$NODE_MIN_MINOR" ]; }
}

if node_suficiente; then
  info "Ya hay Node $(node -v) (>= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}): no se toca."
else
  case "$(uname -m)" in
    x86_64)  NODE_ARCH="x64" ;;
    aarch64) NODE_ARCH="arm64" ;;
    *) fallo "arquitectura no soportada: $(uname -m)" ;;
  esac
  BASE_URL="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  TMP="$(mktemp -d)"
  info "Descargando la lista de sumas (SHASUMS256.txt) de $BASE_URL"
  curl -fsSL "$BASE_URL/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  TARBALL="$(grep -oE "node-v[0-9]+\.[0-9]+\.[0-9]+-linux-${NODE_ARCH}\.tar\.xz" "$TMP/SHASUMS256.txt" | head -n 1 || true)"
  [ -n "$TARBALL" ] || fallo "no se encontro un tarball linux-${NODE_ARCH} en $BASE_URL (existe NODE_MAJOR=$NODE_MAJOR?)."
  NODE_VER="${TARBALL#node-}"; NODE_VER="${NODE_VER%-linux-*}"   # p. ej. v22.11.0
  info "Descargando $TARBALL"
  curl -fSL --progress-bar "$BASE_URL/$TARBALL" -o "$TMP/$TARBALL"
  info "Verificando la suma SHA-256"
  (cd "$TMP" && grep " ${TARBALL}\$" SHASUMS256.txt | sha256sum -c -) \
    || fallo "la suma SHA-256 de $TARBALL NO coincide. Se aborta por seguridad."
  DEST="/opt/node-${NODE_VER}"
  if [ ! -x "$DEST/bin/node" ]; then
    mkdir -p "$TMP/x"
    tar -xJf "$TMP/$TARBALL" -C "$TMP/x" --no-same-owner
    rm -rf "$DEST"
    mv "$TMP/x/node-${NODE_VER}-linux-${NODE_ARCH}" "$DEST"
  fi
  ln -sfn "$DEST/bin/node" /usr/local/bin/node
  ln -sfn "$DEST/bin/npm"  /usr/local/bin/npm
  ln -sfn "$DEST/bin/npx"  /usr/local/bin/npx
  hash -r
  info "Node instalado en $DEST y enlazado en /usr/local/bin."
fi
# El servicio usa /usr/local/bin/node: si el Node preexistente esta en otra ruta, se enlaza.
for b in node npm npx; do
  if [ ! -e "/usr/local/bin/$b" ] && command -v "$b" >/dev/null 2>&1; then
    ln -s "$(command -v "$b")" "/usr/local/bin/$b"
  fi
done
info "node $(/usr/local/bin/node -v), npm $(/usr/local/bin/npm -v)"

# ----------------------------------------------------- (d) Usuario y directorios
paso "4/9 Creando el usuario '$APP_USER' y los directorios"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_HOME" --shell /usr/sbin/nologin --user-group "$APP_USER"
  info "Usuario $APP_USER creado (sin acceso por consola)."
else
  info "El usuario $APP_USER ya existe."
fi
mkdir -p "$APP_HOME/releases" "$APP_HOME/shared" /var/backups/motogp
chown "$APP_USER:$APP_USER" "$APP_HOME" "$APP_HOME/releases" "$APP_HOME/shared"
chmod 750 "$APP_HOME"
chmod 755 "$APP_HOME/releases" "$APP_HOME/shared"
chown root:root /var/backups/motogp
chmod 700 /var/backups/motogp

# ------------------------------------------------------------- (e) PostgreSQL
paso "5/9 Configurando PostgreSQL (solo accesible desde este servidor)"
systemctl enable --now postgresql >/dev/null 2>&1 || true
esperar_pg() { local i; for i in $(seq 1 30); do pg_isready -q && return 0; sleep 1; done; return 1; }
esperar_pg || fallo "PostgreSQL no responde. Revise: systemctl status postgresql"

# Ejecuta SQL como superusuario postgres por el socket local (sin contraseñas).
# Las sentencias con la clave entran por stdin: no salen en la lista de procesos
# ni en el historial de la consola.
psql_pg() { runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }

ESCUCHA="$(psql_pg -c 'SHOW listen_addresses')"
if [ "$ESCUCHA" != "localhost" ] && [ "$ESCUCHA" != "127.0.0.1" ]; then
  CONF="$(psql_pg -c 'SHOW config_file')"
  CONFD="$(dirname "$CONF")/conf.d"
  mkdir -p "$CONFD"
  printf "# MotoGP Stats: PostgreSQL solo escucha en este servidor.\nlisten_addresses = 'localhost'\n" > "$CONFD/90-motogp-localhost.conf"
  systemctl restart postgresql
  esperar_pg || fallo "PostgreSQL no arranca tras limitarlo a localhost. Revise: journalctl -u postgresql"
  ESCUCHA="$(psql_pg -c 'SHOW listen_addresses')"
  [ "$ESCUCHA" = "localhost" ] || fallo "no se pudo limitar PostgreSQL a localhost (listen_addresses=$ESCUCHA)."
fi
info "listen_addresses = $ESCUCHA"

EXISTE_ROL="$(psql_pg -c "SELECT 1 FROM pg_roles WHERE rolname='motogp'")"
CLAVE=""
NUEVO_ENV=0
if [ ! -f "$ENV_FILE" ]; then
  NUEVO_ENV=1
  # Solo hexadecimal (0-9a-f): no necesita escapes ni en SQL ni en la URL.
  CLAVE="$(openssl rand -hex 24)"
  if [ -z "$EXISTE_ROL" ]; then
    printf "CREATE ROLE motogp LOGIN PASSWORD '%s';\n" "$CLAVE" | psql_pg
    info "Rol 'motogp' creado con una contraseña aleatoria."
  else
    printf "ALTER ROLE motogp LOGIN PASSWORD '%s';\n" "$CLAVE" | psql_pg
    info "El rol 'motogp' ya existia pero $ENV_FILE no: se le pone una contraseña nueva."
  fi
elif [ -z "$EXISTE_ROL" ]; then
  # Hay fichero de entorno pero no rol: se reutiliza la clave que figura en el fichero.
  CLAVE="$(sed -n 's#^DATABASE_URL="postgresql://motogp:\([A-Za-z0-9]*\)@.*#\1#p' "$ENV_FILE" | head -n 1)"
  [ -n "$CLAVE" ] || fallo "$ENV_FILE existe, pero no se pudo leer la contraseña de DATABASE_URL y el rol 'motogp' no existe. Renombre ese fichero y repita."
  printf "CREATE ROLE motogp LOGIN PASSWORD '%s';\n" "$CLAVE" | psql_pg
  info "Rol 'motogp' creado con la contraseña que ya figuraba en $ENV_FILE."
else
  info "El rol 'motogp' ya existe; no se toca su contraseña."
fi

if [ -z "$(psql_pg -c "SELECT 1 FROM pg_database WHERE datname='motogp'")" ]; then
  # template0 permite fijar la codificacion con independencia de la configuracion regional.
  psql_pg -c "CREATE DATABASE motogp OWNER motogp ENCODING 'UTF8' TEMPLATE template0"
  info "Base de datos 'motogp' creada (UTF8)."
else
  info "La base de datos 'motogp' ya existe."
fi

# PostgreSQL 15+: el esquema public ya no da CREATE a todos. El dueño de la base
# normalmente si puede (public pertenece a pg_database_owner), pero se comprueba.
PUEDE="$(psql_pg -d motogp -c "SELECT has_schema_privilege('motogp','public','CREATE')")"
if [ "$PUEDE" != "t" ]; then
  psql_pg -d motogp -c "GRANT ALL ON SCHEMA public TO motogp"
  PUEDE="$(psql_pg -d motogp -c "SELECT has_schema_privilege('motogp','public','CREATE')")"
fi
[ "$PUEDE" = "t" ] || fallo "el rol motogp no puede crear objetos en el esquema public."
info "El rol 'motogp' puede crear tablas y tipos en public."

# ------------------------------------------------------- (f) Fichero de entorno
paso "6/9 Fichero de entorno $ENV_FILE"
if [ "$NUEVO_ENV" -eq 1 ]; then
  # Se crea vacio con permisos 640 root:motogp ANTES de escribir la clave.
  ( umask 027; : > "$ENV_FILE" )
  chown root:"$APP_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  cat > "$ENV_FILE" <<ENVFILE
# Variables de MotoGP Stats (las lee systemd). Contiene la contraseña de PostgreSQL:
# propietario root, grupo motogp, modo 640. No lo suba a ningun sitio.
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL="postgresql://motogp:${CLAVE}@127.0.0.1:5432/motogp?schema=public&connection_limit=5&pool_timeout=20"
MOTOGP_API_URL=https://api.motogp.pulselive.com/motogp/v1
MOTOGP_RESULTS_API_URL=https://api.motogp.pulselive.com/motogp/v1/results
ENVFILE
  info "Creado (la contraseña NO se muestra; solo esta en ese fichero)."
else
  info "Ya existe: no se sobrescribe."
fi
CLAVE=""
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# ----------------------------------------------------------- (g) Cortafuegos
paso "7/9 Cortafuegos (ufw)"
# Todos los puertos de sshd -T mas el de la sesion actual (ultimo campo de SSH_CONNECTION).
PUERTOS_SSH="$( { sshd -T 2>/dev/null | awk '/^port /{print $2}'; echo "${SSH_CONNECTION:-}" | awk '{print $NF}'; } | grep -E '^[0-9]+$' | sort -un || true)"
if [ -z "$PUERTOS_SSH" ]; then
  PUERTOS_SSH=22
  aviso "no se pudo leer el puerto de SSH; se asume 22."
fi
SSH_PORT="$(echo $PUERTOS_SSH)"   # una sola linea, separada por espacios, para los mensajes
info "Puertos SSH detectados: $SSH_PORT (se permiten ANTES de activar el cortafuegos)."
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
for p in $PUERTOS_SSH; do ufw allow "${p}/tcp" >/dev/null; done
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
info "Abiertos: SSH ($SSH_PORT), 80 y 443. PostgreSQL (5432) NO está abierto."
aviso "si Clouding tiene su propio cortafuegos en el panel, debe permitir tambien 80 y 443."

# ------------------------------------------------------------------ (h) Caddy
paso "8/9 Instalando y configurando Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  if "${APT[@]}" install caddy; then
    info "Caddy instalado desde los repositorios de Debian."
  else
    info "Caddy no esta en los repositorios de Debian: se usa el repositorio oficial."
    install -d -m 755 /usr/share/keyrings
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    "${APT[@]}" update
    "${APT[@]}" install caddy
  fi
else
  info "Caddy ya instalado: $(caddy version | head -n 1)"
fi

MARCA="# Gestionado por MotoGP Stats (instalar-servidor.sh)"
if [ -f /etc/caddy/Caddyfile ] && ! grep -qF "$MARCA" /etc/caddy/Caddyfile; then
  cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.original-$(date +%Y%m%d-%H%M%S)"
  info "Copia del Caddyfile anterior guardada en /etc/caddy/."
fi
mkdir -p /etc/caddy
if [ -z "$DOMINIO" ] && [ -f /etc/caddy/Caddyfile ] && grep -qF "$MARCA" /etc/caddy/Caddyfile; then
  info "Se conserva la configuración de Caddy existente; para cambiarla ejecuta con DOMINIO=..."
elif [ -n "$DOMINIO" ]; then
  cat > /etc/caddy/Caddyfile <<CADDY
$MARCA
# Sirve https://$DOMINIO con certificado automatico (Let's Encrypt).
# Requisito: el DNS de $DOMINIO apunta a este servidor y los puertos 80/443 estan abiertos.
# Para cambiar de dominio: edite la primera linea y ejecute  systemctl reload caddy
$DOMINIO {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
else
  cat > /etc/caddy/Caddyfile <<CADDY
$MARCA
# SIN DOMINIO: la web se sirve solo por HTTP (sin cifrar) en el puerto 80, por la IP.
# Cuando tenga dominio (con su DNS apuntando a este servidor), sustituya ":80" por el
# dominio, p. ej.  motogp.midominio.es {  y ejecute  systemctl reload caddy
# (o vuelva a lanzar instalar-servidor.sh con DOMINIO=motogp.midominio.es).
# Caddy obtendra entonces el certificado HTTPS automaticamente.
:80 {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
fi
chmod 644 /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
systemctl is-active --quiet caddy || fallo "Caddy no esta activo. Revise: journalctl -u caddy"
info "Caddy activo y configurado."

# ---------------------------------------------------------- (i) Unidades systemd
paso "9/9 Instalando servicios systemd (app, sincronizacion y copias)"
install -m 755 "$AQUI/copia-bd.sh" /usr/local/sbin/motogp-copia-bd
for u in motogp-stats.service motogp-sync.service motogp-sync.timer motogp-backup.service motogp-backup.timer; do
  install -m 644 "$AQUI/systemd/$u" "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable motogp-stats.service >/dev/null 2>&1
systemctl enable --now motogp-sync.timer motogp-backup.timer >/dev/null 2>&1
if [ -e /srv/motogp/current/app.js ]; then
  systemctl restart motogp-stats.service
  info "Ya hay un release desplegado: motogp-stats reiniciado."
else
  info "motogp-stats queda habilitado pero NO arrancado: se arrancara al desplegar."
fi
info "Temporizadores activos: sincronizacion (cada 5 min; espera a que haya app) y copia diaria (03:30)."

# ------------------------------------------------------------------- Resumen
IP="$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
if [ -n "$DOMINIO" ]; then URL="https://$DOMINIO"; else URL="http://$IP"; fi
cat <<RESUMEN

==============================================================================
 SERVIDOR PREPARADO
==============================================================================
 Node.js ........ $(/usr/local/bin/node -v)
 PostgreSQL ..... solo en localhost, base y rol 'motogp'
 Entorno ........ $ENV_FILE (modo 640; contiene la contraseña, no se ha mostrado)
 Cortafuegos .... SSH ($SSH_PORT), 80, 443
 Web (cuando haya app) ... $URL

 PROXIMOS PASOS
  1. Desde su PC, en la raiz del repositorio (PowerShell):
         .\scripts\clouding\desplegar.ps1 -Servidor $IP
     Sube el paquete, instala dependencias, aplica las migraciones y arranca la app.
  2. Cargue los datos existentes (volcado) con scripts/deploy/cargar-datos.sh,
     usando la DATABASE_URL de $ENV_FILE (ver la guia de despliegue).
  3. Compruebe la web en $URL
  4. Si aun no tiene dominio: cuando lo tenga, apunte su DNS (registro A) a $IP y
     ejecute:  DOMINIO=su.dominio.es bash $AQUI/instalar-servidor.sh
  5. Revise el cortafuegos del panel de Clouding (80 y 443 deben estar permitidos).

 Comandos utiles:
     journalctl -u motogp-stats -f        (logs de la app)
     systemctl status motogp-stats        (estado)
     systemctl list-timers 'motogp-*'     (sincronizacion y copias)
     motogp-copia-bd                      (copia de la BD ahora mismo)
==============================================================================
RESUMEN
