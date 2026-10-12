#!/usr/bin/env bash
# =============================================================================
# instalar-release.sh - Instala un paquete de la app en el servidor (lo invoca
# desplegar.ps1; tambien se puede lanzar a mano).
#
# Uso (en el servidor, como root o con sudo):
#     instalar-release.sh /ruta/al/paquete
# donde la ruta es la carpeta generada por `npm run package:dinahosting`
# (dist/dinahosting) ya subida al servidor. Se MUEVE a /srv/motogp/releases.
#
# Pasos: mueve el paquete a releases/AAAAMMDD-HHMMSS -> npm ci --omit=dev ->
# prisma migrate deploy -> cambia el enlace /srv/motogp/current (atomico) ->
# reinicia motogp-stats -> comprobacion de salud. Si la comprobacion falla, VUELVE
# al release anterior automaticamente. Se conservan los 3 ultimos releases.
#
# Aviso sobre migraciones: se aplican ANTES del cambio de version. Si una migracion
# borra o renombra algo que usa el release anterior, la vuelta atras automatica
# no la deshace (las migraciones de este proyecto solo suelen AÑADIR).
# =============================================================================
set -euo pipefail

APP_USER="motogp"
APP_HOME="/srv/motogp"
RELEASES="$APP_HOME/releases"
CURRENT="$APP_HOME/current"
ENV_FILE="/etc/motogp-stats.env"
SERVICIO="motogp-stats.service"
# URL_SALUD se calcula despues de comprobar que existe $ENV_FILE (usa su PORT).
ESPERA_MAX=150      # segundos maximos esperando a que la app responda
CONSERVAR=3
PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

paso() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
fallo() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fallo "ejecutelo como root (o con sudo)."
# Bloqueo contra despliegues simultaneos (flock viene en util-linux, presente en Debian).
exec 9>/var/lock/motogp-deploy.lock
flock -n 9 || fallo "ya hay un despliegue en curso."
ORIGEN="${1:-}"
[ -n "$ORIGEN" ] || fallo "uso: instalar-release.sh /ruta/al/paquete"
[ -d "$ORIGEN" ] || fallo "no existe la carpeta $ORIGEN"
ORIGEN="$(cd "$ORIGEN" && pwd)"
for f in app.js package.json package-lock.json sync-sessions.cjs .next prisma; do
  [ -e "$ORIGEN/$f" ] || fallo "el paquete no es valido: falta $f en $ORIGEN"
done
# REVISION (la escribe desplegar.ps1): que version se esta instalando.
if [ -f "$ORIGEN/REVISION" ]; then
  paso "Version a instalar (REVISION)"
  sed 's/^/    /' "$ORIGEN/REVISION"
fi
id "$APP_USER" >/dev/null 2>&1 || fallo "no existe el usuario $APP_USER: ejecute antes instalar-servidor.sh"
[ -f "$ENV_FILE" ] || fallo "falta $ENV_FILE: ejecute antes instalar-servidor.sh"
[ -f "/etc/systemd/system/$SERVICIO" ] || fallo "falta la unidad $SERVICIO: ejecute antes instalar-servidor.sh"
# Puerto de la app: el PORT de /etc/motogp-stats.env (3000 si falta o no es numerico).
PUERTO_APP="$(grep -E '^PORT=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '"[:space:]' || true)"
case "$PUERTO_APP" in ''|*[!0-9]*) PUERTO_APP=3000 ;; esac
URL_SALUD="http://127.0.0.1:${PUERTO_APP}/api/next-gp"
[ -x /usr/local/bin/node ] || fallo "falta /usr/local/bin/node: ejecute antes instalar-servidor.sh"

# Comandos como el usuario motogp (sin shell de login; HOME fijo para la cache de npm).
como_app() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" PATH="$PATH" "$@"; }

ANTERIOR=""
if [ -L "$CURRENT" ]; then ANTERIOR="$(readlink -f "$CURRENT")"; fi
if [ -n "$ANTERIOR" ] && [ ! -d "$ANTERIOR" ]; then ANTERIOR=""; fi

# ------------------------------------------------------------------ 1. Mover
NUEVO="$RELEASES/$(date +%Y%m%d-%H%M%S)"
paso "1/5 Preparando el release $(basename "$NUEVO")"
mkdir -p "$RELEASES"
[ ! -e "$NUEVO" ] || fallo "ya existe $NUEVO (reintente en un segundo)."
mv "$ORIGEN" "$NUEVO"
mkdir -p "$NUEVO/tmp" "$NUEVO/logs"
chown -R "$APP_USER:$APP_USER" "$NUEVO"
chmod 755 "$NUEVO"

# Si algo falla ANTES del cambio de enlace, el release a medias se borra y la web sigue como estaba.
CAMBIADO=0
limpiar_si_falla() {
  local codigo=$?
  if [ "$codigo" -ne 0 ] && [ "$CAMBIADO" -eq 0 ] && [ -d "$NUEVO" ]; then
    printf '\nSe descarta el release incompleto %s (la version en marcha no se ha tocado).\n' "$NUEVO" >&2
    rm -rf "$NUEVO"
  fi
}
trap limpiar_si_falla EXIT

# --------------------------------------------------------- 2. Dependencias
paso "2/5 Instalando dependencias (npm ci --omit=dev; necesita internet, puede tardar)"
( cd "$NUEVO" && como_app npm ci --omit=dev --no-audit --no-fund )

# ------------------------------------------------------------ 3. Migraciones
paso "3/5 Aplicando migraciones de la base de datos"
# Prisma CLI no lee /etc/motogp-stats.env: se carga aqui (solo para este comando).
( cd "$NUEVO" && como_app bash -c 'set -a; . "$1"; set +a; exec npx prisma migrate deploy' _ "$ENV_FILE" )

# -------------------------------------------------------- 4. Cambiar version
paso "4/5 Activando el release y reiniciando la app"
ln -sfn "$NUEVO" "$RELEASES/.current.nuevo"
mv -T "$RELEASES/.current.nuevo" "$CURRENT"   # cambio atomico (rename)
CAMBIADO=1
if [ -n "$ANTERIOR" ]; then
  echo "$ANTERIOR" > "$APP_HOME/shared/release-anterior"
  info "Release anterior guardado: $ANTERIOR"
else
  info "Primera instalacion: no hay release anterior."
fi
systemctl daemon-reload
systemctl enable "$SERVICIO" >/dev/null 2>&1 || true
# Un fallo al arrancar NO debe abortar (set -e): hay que pasar por la comprobacion y el rollback.
systemctl restart "$SERVICIO" || info "El servicio no arrancó; se comprobará y, si procede, se volverá atrás."

# ------------------------------------------------------ 5. Comprobar salud
paso "5/5 Comprobando que la app responde (hasta ${ESPERA_MAX}s)"
# Se acepta 200 (hay datos) o 404 (app y base de datos OK, pero aun sin Gran Premio
# cargado: caso normal en una instalacion nueva). Un 500 significa fallo (p. ej. BD).
comprobar() {
  local inicio codigo
  inicio=$SECONDS
  while [ $((SECONDS - inicio)) -lt "$ESPERA_MAX" ]; do
    codigo="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$URL_SALUD" || true)"
    if [ "$codigo" = "200" ] || [ "$codigo" = "404" ]; then
      info "La app responde (HTTP $codigo)."
      return 0
    fi
    sleep 3
  done
  return 1
}

if comprobar; then
  # Limpieza: solo los $CONSERVAR ultimos releases (nunca el nuevo ni el anterior).
  mapfile -t TODOS < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*-[0-9]*' | sort)
  SOBRAN=$(( ${#TODOS[@]} - CONSERVAR ))
  if [ "$SOBRAN" -gt 0 ]; then
    for VIEJO in "${TODOS[@]:0:SOBRAN}"; do
      if [ "$VIEJO" != "$NUEVO" ] && [ "$VIEJO" != "$ANTERIOR" ]; then
        rm -rf -- "$VIEJO"
        info "Release antiguo borrado: $(basename "$VIEJO")"
      fi
    done
  fi
  printf '\nDESPLIEGUE CORRECTO: %s\n' "$(basename "$NUEVO")"
  if [ -f "$NUEVO/REVISION" ]; then sed 's/^/    /' "$NUEVO/REVISION"; fi
  exit 0
fi

# ----------------------------------------------------------- Vuelta atras
printf '\nERROR: la app NO responde tras desplegar %s. Ultimos logs:\n\n' "$(basename "$NUEVO")" >&2
journalctl -u "$SERVICIO" -n 60 --no-pager >&2 || true

if [ -n "$ANTERIOR" ]; then
  printf '\nVolviendo al release anterior: %s\n' "$ANTERIOR" >&2
  ln -sfn "$ANTERIOR" "$RELEASES/.current.nuevo"
  mv -T "$RELEASES/.current.nuevo" "$CURRENT"
  if ! systemctl restart "$SERVICIO"; then
    printf '
AVISO: el release anterior tampoco arranca. Ultimos logs:

' >&2
    journalctl -u "$SERVICIO" -n 60 --no-pager >&2 || true
    fallo "no se pudo reiniciar el servicio tras la vuelta atras. Revise: journalctl -u $SERVICIO -n 100"
  fi
  if comprobar; then
    printf 'El release anterior vuelve a funcionar. El fallido queda en %s para investigarlo.\n' "$NUEVO" >&2
  else
    printf 'AVISO: tampoco responde el release anterior. Revise: journalctl -u %s -n 100\n' "$SERVICIO" >&2
  fi
else
  printf '\nEs la primera instalacion: no hay release anterior al que volver.\n' >&2
  printf 'Revise los logs (journalctl -u %s -n 100) y la configuracion de %s.\n' "$SERVICIO" "$ENV_FILE" >&2
fi
exit 1
