@echo off
title Iniciando Agendou SaaS
echo ========================================================
echo   Iniciando o Servidor de Desenvolvimento do SaaS...
echo ========================================================
echo [INFO] O Vite roda dentro do WSL (filesystem nativo).
echo [INFO] Abra http://localhost:5173 no navegador.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1"

pause
