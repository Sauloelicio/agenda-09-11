@echo off
title Iniciando Agendou SaaS
echo ========================================================
echo   Iniciando o Servidor de Desenvolvimento do SaaS...
echo ========================================================

:: Se estiver em caminho de rede UNC, mapeia unidade Z:
if "%~d0"=="\\" (
  echo [INFO] Mapeando caminho de rede para unidade Z:...
  pushd "%~dp0"
) else (
  cd /d "%~dp0"
)

echo [INFO] Pasta atual: %CD%
echo [INFO] Iniciando Vite na porta 5173...
call npm run dev

if "%~d0"=="\\" (
  popd
)
pause

