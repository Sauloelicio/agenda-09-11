# Inicia o servidor Vite DENTRO do WSL (filesystem nativo).
#
# Por que nao rodar no Windows? O projeto fica em \\wsl.localhost, e o watcher
# do Node falha nesse filesystem 9p (EISDIR / restarts em loop). Rodando no WSL
# o Vite usa o ext4 e o HMR funciona normalmente.
#
# Toda a logica de shell fica em dev.sh (evita problemas de quoting do
# PowerShell com $PATH/$HOME).

$ErrorActionPreference = 'Stop'

$wslDistro  = 'Ubuntu'
$projectDir = '/home/saulo/si_agendsmrnto_wha/si_agendamento_wha'
$devScript  = "$projectDir/dev.sh"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Iniciando o Servidor de Desenvolvimento do SaaS...      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Abre o navegador depois de alguns segundos, em segundo plano.
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 10
    Start-Process 'http://localhost:5173'
} | Out-Null

Write-Host "[1/2] Verificando o WSL ($wslDistro)..." -ForegroundColor Yellow
wsl -d $wslDistro -- true
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Nao foi possivel acessar a distro $wslDistro." -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] Iniciando Vite no WSL..." -ForegroundColor Yellow
Write-Host "      Acesse: http://localhost:5173" -ForegroundColor Gray
Write-Host "      (Ctrl+C encerra o servidor)" -ForegroundColor Gray
Write-Host ""

wsl -d $wslDistro -- bash $devScript
