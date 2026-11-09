# Script para iniciar o servidor Vite contornando a restricao de caminhos UNC do Windows
$projectPath = "\\wsl.localhost\Ubuntu\home\saulo\si_agendsmrnto_wha\si_agendamento_wha"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Iniciando o Servidor de Desenvolvimento do SaaS...      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Remove unidade X: anterior caso exista
if (Test-Path "X:\") {
    subst X: /D | Out-Null
}

# Mapeia X: para o caminho do WSL
Write-Host "[1/2] Mapeando caminho de rede para unidade X:..." -ForegroundColor Yellow
subst X: $projectPath

# Navega para X: e executa
Set-Location X:\
Write-Host "[2/2] Iniciando Vite em http://localhost:5173/ ..." -ForegroundColor Green
npm run dev

