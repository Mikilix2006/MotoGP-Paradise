# Arranca el vigilante de sesiones en segundo plano con log.
#
# Lo usa la tarea programada "MotoGP Stats - Vigilante de sesiones"
# (ver scripts/register-watcher-task.ps1). También sirve a mano:
#
#   powershell -ExecutionPolicy Bypass -File scripts/watch-sessions.ps1

$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectDir "logs"
$logFile = Join-Path $logDir "watch-sessions.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Rotación simple: si el log pasa de 5 MB se conserva el anterior.
if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 5MB) {
    Move-Item -Force $logFile (Join-Path $logDir "watch-sessions.prev.log")
}

Set-Location $projectDir

# La salida de Node es UTF-8; sin esto PowerShell 5.1 la reinterpreta
# como ANSI y el log queda ilegible.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Content -Path $logFile -Encoding UTF8 -Value ("=== Arranque " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + " ===")

# npm.cmd para que el proceso viva en esta consola oculta.
& npm.cmd run watch:sessions 2>&1 | ForEach-Object { Add-Content -Path $logFile -Encoding UTF8 -Value $_ }
