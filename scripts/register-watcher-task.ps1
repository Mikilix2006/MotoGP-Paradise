# Registra (o actualiza) la tarea programada que arranca el
# vigilante de sesiones al iniciar sesión en Windows.
#
#   powershell -ExecutionPolicy Bypass -File scripts/register-watcher-task.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/register-watcher-task.ps1 -Unregister
#
# No necesita permisos de administrador: la tarea corre con el
# usuario actual, sin ventana, y se relanza si el proceso muere.

param(
    [switch]$Unregister
)

$taskName = "MotoGP Stats - Vigilante de sesiones"
$projectDir = Split-Path -Parent $PSScriptRoot
$script = Join-Path $projectDir "scripts\watch-sessions.ps1"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Tarea eliminada: $taskName"
    exit 0
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 2) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Importa a PostgreSQL los resultados y el estado del GP en cuanto termina cada sesión (npm run watch:sessions)." `
    -Force | Out-Null

Write-Host "Tarea registrada: $taskName"
Write-Host "Se arranca al iniciar sesión. Para lanzarla ahora: Start-ScheduledTask -TaskName '$taskName'"
