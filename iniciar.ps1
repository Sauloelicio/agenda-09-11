# Compatibilidade: "iniciar" agora sobe banco + aplicacao.
# Toda a logica esta em dev.sh (WSL) e dev.ps1 (wrapper Windows).

$ErrorActionPreference = 'Stop'

& "$PSScriptRoot\dev.ps1" -Command all
exit $LASTEXITCODE
