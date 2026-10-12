<#
.SYNOPSIS
  Despliega MotoGP Stats en el VPS de Clouding desde el PC Windows.

.DESCRIPTION
  Ejecutar en la RAIZ del repositorio:
      powershell -ExecutionPolicy Bypass -File .\scripts\clouding\desplegar.ps1 -Servidor 203.0.113.10
  (con la politica de ejecucion por defecto de Windows, un .\desplegar.ps1 directo
  suele bloquearse; por eso se lanza con -ExecutionPolicy Bypass).
  Hace: npm run package:dinahosting -> sube dist/dinahosting e instalar-release.sh
  con scp a un directorio temporal del servidor -> ejecuta instalar-release.sh por ssh
  (instala dependencias, migra la base de datos, cambia de version y comprueba la salud;
  si falla, vuelve solo a la version anterior).

  Requisitos previos: haber ejecutado instalar-servidor.sh en el servidor, y tener
  ssh y scp en el PC (cliente OpenSSH de Windows).

  AVISO: si no tiene una clave SSH configurada, la contrasena de SSH se pedira varias
  veces (una por cada ssh y scp). Es normal.

.PARAMETER Servidor
  IP o nombre del servidor. Debe empezar por letra o numero (si empezara por "-", ssh
  lo tomaria por una opcion); solo admite letras, numeros y . _ : @ -
.PARAMETER Usuario
  Usuario SSH (por defecto root; si no es root debe poder usar sudo sin contrasena).
  Mismas restricciones de caracteres que Servidor.
.PARAMETER Puerto
  Puerto SSH (por defecto 22).
#>
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._:@-]*$')][string]$Servidor,
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._:@-]*$')][string]$Usuario = "root",
  [int]$Puerto = 22
)

$ErrorActionPreference = "Stop"

function Fallar($mensaje) {
  Write-Host ""
  Write-Host "ERROR: $mensaje" -ForegroundColor Red
  exit 1
}

function Ejecutar($descripcion, [scriptblock]$bloque) {
  & $bloque
  if ($LASTEXITCODE -ne 0) { Fallar "$descripcion (codigo $LASTEXITCODE)." }
}

# --- Comprobaciones previas ---------------------------------------------------
$raiz = (Get-Location).Path
if (-not (Test-Path (Join-Path $raiz "package.json")) -or -not (Test-Path (Join-Path $raiz "scripts\package-dinahosting.mjs"))) {
  Fallar "ejecute este script desde la raiz del repositorio (donde esta package.json). Ahora esta en: $raiz"
}
foreach ($cmd in @("ssh", "scp", "npm")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fallar "no se encuentra '$cmd'. Instale el cliente OpenSSH (Configuracion > Aplicaciones > Caracteristicas opcionales) o Node.js."
  }
}
$instalador = Join-Path $raiz "scripts\clouding\instalar-release.sh"
if (-not (Test-Path $instalador)) { Fallar "falta $instalador" }

$destino = "$Usuario@$Servidor"
$opcionesSsh = @("-p", "$Puerto", "-o", "ServerAliveInterval=30")
$opcionesScp = @("-P", "$Puerto")
$sudo = ""
if ($Usuario -ne "root") { $sudo = "sudo " }

# --- 1. Empaquetar ---------------------------------------------------------
Write-Host "==> 1/4 Empaquetando la aplicacion (npm run package:dinahosting)" -ForegroundColor Cyan
Ejecutar "fallo al empaquetar" { npm run package:dinahosting }
$paquete = Join-Path $raiz "dist\dinahosting"
foreach ($f in @("app.js", "package.json", "sync-sessions.cjs", ".next")) {
  if (-not (Test-Path (Join-Path $paquete $f))) { Fallar "el paquete no se genero bien: falta dist\dinahosting\$f" }
}

# --- 2. Directorio temporal -----------------------------------------------
$id = Get-Date -Format "yyyyMMdd-HHmmss"
$remoto = "/tmp/motogp-deploy-$id"
Write-Host "==> 2/4 Creando directorio temporal en el servidor ($remoto)" -ForegroundColor Cyan
Write-Host "    (si no usa clave SSH, se le pedira la contrasena varias veces)" -ForegroundColor DarkGray
Ejecutar "no se pudo conectar por SSH a $destino" { ssh @opcionesSsh $destino "mkdir -p $remoto && chmod 700 $remoto" }

# --- 3. Subir -----------------------------------------------------------------
Write-Host "==> 3/4 Subiendo el paquete y el instalador" -ForegroundColor Cyan
Ejecutar "fallo al subir el paquete" { scp @opcionesScp -r $paquete "${destino}:$remoto/paquete" }
Ejecutar "fallo al subir instalar-release.sh" { scp @opcionesScp $instalador "${destino}:$remoto/instalar-release.sh" }

# --- 4. Instalar --------------------------------------------------------------
Write-Host "==> 4/4 Instalando en el servidor (puede tardar varios minutos)" -ForegroundColor Cyan
# sed quita posibles CR por si el fichero llegara con finales de linea de Windows.
$ordenRemota = "sed -i 's/\r$//' $remoto/instalar-release.sh && ${sudo}bash $remoto/instalar-release.sh $remoto/paquete; r=`$?; rm -rf $remoto; exit `$r"
ssh @opcionesSsh $destino $ordenRemota
if ($LASTEXITCODE -ne 0) {
  Fallar "el despliegue fallo en el servidor (codigo $LASTEXITCODE). Lea los mensajes de arriba; si la app no arranco, el servidor vuelve solo a la version anterior."
}

Write-Host ""
Write-Host "Despliegue terminado correctamente." -ForegroundColor Green
Write-Host "Logs de la app:  ssh $destino journalctl -u motogp-stats -n 50 --no-pager"
