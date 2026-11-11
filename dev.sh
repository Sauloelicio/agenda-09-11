#!/usr/bin/env bash
# Sobe o Vite DENTRO do WSL (filesystem nativo ext4).
#
# Por que nao rodar no Windows? O projeto fica em \\wsl.localhost, e o watcher
# do Node falha nesse filesystem 9p (EISDIR / restarts em loop). Rodando aqui o
# HMR funciona normalmente. O WSL encaminha a porta, entao o Windows acessa
# http://localhost:5173.
set -euo pipefail

export PATH="$HOME/.local/node/bin:/usr/local/bin:/usr/bin:/bin"
cd /home/saulo/si_agendsmrnto_wha/si_agendamento_wha

if [ ! -x ./node_modules/.bin/vite ]; then
  echo "[ERRO] node_modules Linux nao encontrado."
  echo "Rode uma vez:  npm ci"
  exit 1
fi

exec npm run dev
