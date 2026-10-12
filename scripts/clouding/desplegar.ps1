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
.PARAMETER Ref
  Rama, etiqueta, hash u origin/main. Si se indica, se despliega EXACTAMENTE ese commit
  (se construye en un worktree temporal bajo %TEMP%, sin tocar la carpeta de trabajo).
  Sin -Ref se empaqueta la carpeta de trabajo actual (avisa si hay cambios sin commitear).
.PARAMETER SoloEmpaquetar
  Construye el paquete y lo deja en dist\paquete-<hash7>, pero NO sube ni ejecuta nada
  en el servidor (-Servidor sigue siendo obligatorio; puede ser 127.0.0.1).

  En ambos casos el paquete lleva un fichero REVISION (commit, ref, fecha, limpio) que
  instalar-release.sh muestra y que queda dentro del release del servidor.
#>
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._:@-]*$')][string]$Servidor,
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._:@-]*$')][string]$Usuario = "root",
  [int]$Puerto = 22,
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._/@^~-]*$')][string]$Ref,
  [switch]$SoloEmpaquetar
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
$necesarios = @("git", "npm")
if (-not $SoloEmpaquetar) { $necesarios += @("ssh", "scp") }
foreach ($cmd in $necesarios) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fallar "no se encuentra '$cmd'. Instale el cliente OpenSSH (Configuracion > Aplicaciones > Caracteristicas opcionales), Git o Node.js."
  }
}

# --- Que se va a desplegar -----------------------------------------------------
$limpio = "si"
if ($Ref) {
  $commit = & { $ErrorActionPreference = "Continue"; git rev-parse --verify "$Ref^{commit}" 2>$null }
  if ($LASTEXITCODE -ne 0 -or -not $commit) { Fallar "-Ref '$Ref' no existe en este repositorio (pruebe 'git fetch' o revise el nombre)." }
  $refTexto = $Ref
} else {
  $commit = (git rev-parse HEAD)
  if ($LASTEXITCODE -ne 0) { Fallar "no se pudo leer HEAD con git." }
  $refTexto = "(carpeta de trabajo)"
  if (git status --porcelain) {
    $limpio = "no"
    Write-Host "AVISO: hay cambios sin commitear; se empaqueta la CARPETA DE TRABAJO, no el commit $($commit.Substring(0,7))." -ForegroundColor Yellow
    Write-Host "       (use -Ref <rama|hash|origin/main> para desplegar exactamente un commit)" -ForegroundColor Yellow
  }
}
$corto = $commit.Substring(0, 7)
Write-Host "Version a desplegar: $corto  ref=$refTexto  limpio=$limpio" -ForegroundColor Cyan

$base = $raiz        # carpeta desde la que se construye (raiz o worktree)
$worktree = $null
if ($Ref) {
  # Ruta corta (limite de 260 caracteres de Windows con node_modules).
  $worktree = Join-Path $env:TEMP "mgp-$corto"
  if (Test-Path $worktree) {
    # Resto de un intento anterior: se limpia antes de empezar.
    & { $ErrorActionPreference = "Continue"; git worktree remove --force $worktree 2>$null }
    if (Test-Path $worktree) { Remove-Item -Recurse -Force $worktree }
    git worktree prune
  }
}

try {
  if ($worktree) {
    Write-Host "==> 0/4 Creando worktree temporal de $corto en $worktree" -ForegroundColor Cyan
    Ejecutar "no se pudo crear el worktree" { git worktree add --detach $worktree $commit }
    $base = $worktree
    foreach ($f in @("scripts/package-dinahosting.mjs", "scripts/dinahosting/app.js", "scripts/clouding/instalar-release.sh")) {
      if (-not (Test-Path (Join-Path $base $f))) {
        Fallar "el commit $corto ($Ref) no contiene las herramientas de despliegue (falta $f). Use una rama o commit que las incluya."
      }
    }
    # El build de Next pre-renderiza rutas API y necesita DATABASE_URL: se copia el .env (no se lee ni se muestra).
    if (Test-Path (Join-Path $raiz ".env")) { Copy-Item (Join-Path $raiz ".env") (Join-Path $base ".env") }
    Push-Location $base
    try { Ejecutar "fallo en npm ci" { npm ci } } finally { Pop-Location }
  }
  $instalador = Join-Path $base "scripts\clouding\instalar-release.sh"
  if (-not (Test-Path $instalador)) { Fallar "falta $instalador" }

  # --- 1. Empaquetar -------------------------------------------------------
  Write-Host "==> 1/4 Empaquetando la aplicacion (npm run package:dinahosting)" -ForegroundColor Cyan
  Push-Location $base
  try { Ejecutar "fallo al empaquetar" { npm run package:dinahosting } } finally { Pop-Location }
  $paquete = Join-Path $base "dist\dinahosting"
  foreach ($f in @("app.js", "package.json", "sync-sessions.cjs", ".next")) {
    if (-not (Test-Path (Join-Path $paquete $f))) { Fallar "el paquete no se genero bien: falta dist\dinahosting\$f" }
  }

  # REVISION: LF y ASCII; lo muestra instalar-release.sh y queda dentro del release.
  $fecha = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $revision = "commit=$commit`nref=$refTexto`nfecha=$fecha`nlimpio=$limpio`n"
  [System.IO.File]::WriteAllText((Join-Path $paquete "REVISION"), $revision, [System.Text.Encoding]::ASCII)

  if ($SoloEmpaquetar) {
    $copia = Join-Path $raiz "dist\paquete-$corto"
    if (Test-Path $copia) { Remove-Item -Recurse -Force $copia }
    # Copia ANTES de que el finally borre el worktree.
    Copy-Item -Recurse $paquete $copia
    Write-Host ""
    Write-Host "Paquete listo (NO se ha subido nada): $copia" -ForegroundColor Green
    Write-Host "REVISION:"
    Write-Host $revision
  } else {
    # --- 2. Directorio temporal ---------------------------------------------
    $destino = "$Usuario@$Servidor"
    $opcionesSsh = @("-p", "$Puerto", "-o", "ServerAliveInterval=30")
    $opcionesScp = @("-P", "$Puerto")
    $sudo = ""
    if ($Usuario -ne "root") { $sudo = "sudo " }
    $id = Get-Date -Format "yyyyMMdd-HHmmss"
    $remoto = "/tmp/motogp-deploy-$id"
    Write-Host "==> 2/4 Creando directorio temporal en el servidor ($remoto)" -ForegroundColor Cyan
    Write-Host "    (si no usa clave SSH, se le pedira la contrasena varias veces)" -ForegroundColor DarkGray
    Ejecutar "no se pudo conectar por SSH a $destino" { ssh @opcionesSsh $destino "mkdir -p $remoto && chmod 700 $remoto" }

    # --- 3. Subir -------------------------------------------------------------
    Write-Host "==> 3/4 Subiendo el paquete y el instalador" -ForegroundColor Cyan
    Ejecutar "fallo al subir el paquete" { scp @opcionesScp -r $paquete "${destino}:$remoto/paquete" }
    Ejecutar "fallo al subir instalar-release.sh" { scp @opcionesScp $instalador "${destino}:$remoto/instalar-release.sh" }

    # --- 4. Instalar ------------------------------------------------------------
    Write-Host "==> 4/4 Instalando en el servidor (puede tardar varios minutos)" -ForegroundColor Cyan
    # sed quita posibles CR por si el fichero llegara con finales de linea de Windows.
    $ordenRemota = "sed -i 's/\r$//' $remoto/instalar-release.sh && ${sudo}bash $remoto/instalar-release.sh $remoto/paquete; r=`$?; rm -rf $remoto; exit `$r"
    ssh @opcionesSsh $destino $ordenRemota
    if ($LASTEXITCODE -ne 0) {
      Fallar "el despliegue de $corto fallo en el servidor (codigo $LASTEXITCODE). Lea los mensajes de arriba; si la app no arranco, el servidor vuelve solo a la version anterior."
    }

    Write-Host ""
    Write-Host "Despliegue terminado correctamente: $corto  ref=$refTexto  limpio=$limpio" -ForegroundColor Green
    Write-Host "Logs de la app:  ssh $destino journalctl -u motogp-stats -n 50 --no-pager"
  }
} finally {
  if ($worktree) {
    Set-Location $raiz
    & { $ErrorActionPreference = "Continue"; git worktree remove --force $worktree 2>$null }
    if (Test-Path $worktree) { Remove-Item -Recurse -Force $worktree -ErrorAction SilentlyContinue }
    git worktree prune
    if (Test-Path $worktree) { Write-Host "AVISO: no se pudo borrar $worktree (contiene una copia de .env); borrelo a mano." -ForegroundColor Yellow }
    else { Write-Host "Worktree temporal borrado." -ForegroundColor DarkGray }
  }
}
