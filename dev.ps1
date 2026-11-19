# Wrapper Windows para dev.sh (a logica roda DENTRO do WSL).
#
# Uso:
#   .\dev.ps1 app
#   .\dev.ps1 db
#   .\dev.ps1 all
#   .\dev.ps1 restart-app
#   .\dev.ps1 restart-db
#   .\dev.ps1 restart-all
#   .\dev.ps1 status | stop | db-reset | help
#   .\dev.ps1 db -Full        # inclui Studio e demais servicos
param(
    [Parameter(Position = 0)]
    [ValidateSet('app', 'db', 'all', 'restart-app', 'restart-db', 'restart-all', 'status', 'stop', 'db-reset', 'help')]
    [string]$Command = 'all',

    [switch]$Full
)

$ErrorActionPreference = 'Stop'

$wslDistro = 'Ubuntu'
$projectDir = '/home/saulo/si_agendsmrnto_wha/si_agendamento_wha'
$devScript = "$projectDir/dev.sh"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Agendou SaaS - $Command" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

wsl -d $wslDistro -- true
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Nao foi possivel acessar a distro $wslDistro." -ForegroundColor Red
    exit 1
}

# Abre o navegador somente quando a aplicacao e iniciada.
if ($Command -in @('app', 'all', 'restart-app', 'restart-all')) {
    Start-Job -ScriptBlock {
        Start-Sleep -Seconds 10
        Start-Process 'http://localhost:5173'
    } | Out-Null
    Write-Host "      Acesse: http://localhost:5173 (Ctrl+C encerra)" -ForegroundColor Gray
}

$scriptArgs = @($Command)
if ($Full) {
    $scriptArgs += '--full'
}

wsl -d $wslDistro -- bash $devScript @scriptArgs
exit $LASTEXITCODE
