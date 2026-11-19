#!/usr/bin/env bash
# Sobe a aplicacao e/ou o banco local (Supabase: Postgres + Auth + REST).
#
# Uso (dentro do WSL):
#   ./dev.sh app             # somente Vite
#   ./dev.sh db              # somente banco (stack minimo, sem Studio)
#   ./dev.sh all             # banco + Vite
#   ./dev.sh restart-app     # reinicia somente o Vite
#   ./dev.sh restart-db      # reinicia somente o banco (dados preservados)
#   ./dev.sh restart-all     # reinicia banco + Vite
#   ./dev.sh status          # estado de app e banco
#   ./dev.sh stop            # para app e banco
#   ./dev.sh db-reset        # apaga dados locais e reaplica migrations + seed
#   ./dev.sh help            # ajuda
#
# No Windows, use dev.ps1 / dev.bat com os mesmos comandos.
# Use --full com db/all/restart-* para subir todos os servicos (inclui Studio).
set -euo pipefail

export PATH="$HOME/.local/node/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SUPABASE_BIN="${SUPABASE_BIN:-$HOME/.local/bin/supabase}"
APP_PORT="${APP_PORT:-5173}"
ENV_FILE="$ROOT/.env.development.local"

# Essenciais para o app: Postgres + Auth (GoTrue) + REST (PostgREST).
MINIMAL_EXCLUDE="studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit"
# Chave publica deterministica do stack Supabase local (usada apenas como fallback).
LOCAL_PUBLISHABLE_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

info() { echo "==> $*"; }
err()  { echo "[ERRO] $*" >&2; }

need_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "CLI do Docker nao encontrado dentro do WSL."
    err "Verifique Docker Desktop > Settings > Resources > WSL Integration (Ubuntu) e reinicie o Docker Desktop."
    err "Veja docs/EXECUCAO_LOCAL_POSTGRES.md."
    exit 1
  fi
  if ! timeout 15s docker info >/dev/null 2>&1; then
    err "Docker daemon nao responde (backend do Docker Desktop pode estar travado)."
    err "Reinicie o Docker Desktop no Windows e tente novamente."
    err "Veja docs/EXECUCAO_LOCAL_POSTGRES.md#docker-desktop-travado."
    exit 1
  fi
}

need_supabase() {
  if [ ! -x "$SUPABASE_BIN" ]; then
    SUPABASE_BIN="$(command -v supabase || true)"
  fi
  if [ -z "$SUPABASE_BIN" ] || [ ! -x "$SUPABASE_BIN" ]; then
    err "Supabase CLI nao encontrado. Instale em ~/.local/bin/supabase."
    exit 1
  fi
}

db_running() {
  timeout 20s "$SUPABASE_BIN" status >/dev/null 2>&1
}

app_pids() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  fi
  if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "$APP_PORT" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | tr '\n' ' ' || true)"
  fi
  if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnpH "sport = :$APP_PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u | tr '\n' ' ' || true)"
  fi
  printf '%s' "$pids"
}

kill_app() {
  local pids p i
  pids="$(app_pids)"
  [ -z "$pids" ] && return 0
  info "Encerrando aplicacao na porta $APP_PORT (PID: $pids)..."
  for p in $pids; do
    kill "$p" 2>/dev/null || true
  done
  for i in $(seq 1 20); do
    [ -z "$(app_pids)" ] && return 0
    sleep 0.5
  done
  for p in $pids; do
    kill -9 "$p" 2>/dev/null || true
  done
}

# Vite carrega .env.development.local com prioridade sobre .env.
# Se o arquivo nao existir, geramos a partir de `supabase status -o env`.
ensure_env() {
  if [ -f "$ENV_FILE" ] \
    && grep -q '^VITE_SUPABASE_URL=' "$ENV_FILE" \
    && grep -q '^VITE_SUPABASE_PUBLISHABLE_KEY=' "$ENV_FILE"; then
    return 0
  fi

  need_supabase
  local env_out key url project_id
  env_out="$(timeout 20s "$SUPABASE_BIN" status -o env 2>/dev/null || true)"

  key="$(printf '%s\n' "$env_out" | awk -F= '/^(PUBLISHABLE_KEY|ANON_KEY)=/{print substr($0, index($0, "=") + 1); exit}')"
  key="$(printf '%s' "$key" | sed -e 's/^"//' -e 's/"$//')"
  [ -n "$key" ] || key="$LOCAL_PUBLISHABLE_KEY"

  url="$(printf '%s\n' "$env_out" | awk -F= '/^(API_EXTERNAL_URL|SUPABASE_PUBLIC_URL|API_URL)=/{print substr($0, index($0, "=") + 1); exit}')"
  url="$(printf '%s' "$url" | sed -e 's/^"//' -e 's/"$//')"
  [ -n "$url" ] || url="http://127.0.0.1:54321"

  project_id="$(awk -F' = ' '/^project_id[[:space:]]*=/{gsub(/"/, "", $2); print $2; exit}' "$ROOT/supabase/config.toml" 2>/dev/null || true)"
  [ -n "$project_id" ] || project_id="si_agendamento_wha"

  cat > "$ENV_FILE" <<EOF
# Gerado por dev.sh. Sobrescreve .env apenas durante 'npm run dev'.
VITE_SUPABASE_PROJECT_ID="$project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="$key"
VITE_SUPABASE_URL="$url"
EOF
  info "Arquivo .env.development.local criado."
}

need_app() {
  if [ ! -x ./node_modules/.bin/vite ]; then
    err "node_modules Linux nao encontrado. Rode 'npm ci' DENTRO do WSL."
    exit 1
  fi
}

start_db() {
  local full="${1:-0}"
  need_docker
  need_supabase

  if db_running; then
    info "Banco local ja esta rodando."
    ensure_env
    "$SUPABASE_BIN" status
    return 0
  fi

  info "Subindo o banco local (Postgres + Auth + REST)..."
  if [ "$full" = "1" ]; then
    "$SUPABASE_BIN" start
  else
    "$SUPABASE_BIN" start -x "$MINIMAL_EXCLUDE"
  fi
  ensure_env
  echo
  "$SUPABASE_BIN" status
}

start_app() {
  need_app
  ensure_env
  info "Aplicacao: http://localhost:$APP_PORT"
  exec npm run dev -- --port "$APP_PORT"
}

restart_db() {
  local full="${1:-0}"
  need_docker
  need_supabase
  info "Parando o banco local (dados preservados)..."
  "$SUPABASE_BIN" stop || true
  sleep 1
  start_db "$full"
}

stop_all() {
  kill_app
  if [ -x "$SUPABASE_BIN" ]; then
    "$SUPABASE_BIN" stop || true
  fi
  info "Aplicacao e banco parados."
}

status_cmd() {
  local pids
  pids="$(app_pids)"
  if [ -n "$pids" ]; then
    info "Aplicacao: RODANDO (PID: $pids) em http://localhost:$APP_PORT"
  else
    info "Aplicacao: PARADA"
  fi
  echo
  need_supabase
  if db_running; then
    "$SUPABASE_BIN" status
  else
    info "Banco: PARADO"
  fi
}

db_reset() {
  local answer
  need_docker
  need_supabase
  if ! db_running; then
    start_db 0
  fi
  err "ATENCAO: 'db-reset' APAGA todos os dados locais e reaplica migrations + seed."
  read -r -p "Confirmar? [s/N] " answer || true
  case "$answer" in
    s|S|sim|SIM|Sim) ;;
    *) info "Cancelado."; return 0 ;;
  esac
  "$SUPABASE_BIN" db reset
}

usage() {
  cat <<EOF
Uso: ./dev.sh <comando> [--full]

  app           Sobe somente a aplicacao (Vite) em http://localhost:5173
  db            Sobe somente o banco local (Postgres + Auth + REST)
  all           Sobe banco + aplicacao
  restart-app   Reinicia somente a aplicacao
  restart-db    Reinicia somente o banco (dados preservados)
  restart-all   Reinicia banco + aplicacao
  status        Mostra o estado de aplicacao e banco
  stop          Para aplicacao e banco
  db-reset      Apaga os dados locais e reaplica migrations + seed
  help          Mostra esta ajuda

  --full        Com db/all/restart-* sobe todos os servicos (inclui Studio :54323).
                Sem --full usa o stack minimo (sem Studio, Realtime, Storage, Edge).

Exemplos:
  ./dev.sh all
  ./dev.sh restart-db
  ./dev.sh db --full
EOF
}

cmd="${1:-app}"
if [ "$cmd" = "-h" ] || [ "$cmd" = "--help" ] || [ "$cmd" = "help" ]; then
  usage
  exit 0
fi
shift || true

full=0
for arg in "$@"; do
  case "$arg" in
    --full) full=1 ;;
    *) err "Opcao desconhecida: $arg"; usage >&2; exit 1 ;;
  esac
done

case "$cmd" in
  app)          start_app ;;
  db)           start_db "$full" ;;
  all)          start_db "$full"; start_app ;;
  restart-app)  kill_app; start_app ;;
  restart-db)   restart_db "$full" ;;
  restart-all)  restart_db "$full"; kill_app; start_app ;;
  status)       status_cmd ;;
  stop)         stop_all ;;
  db-reset)     db_reset ;;
  *) err "Comando desconhecido: $cmd"; usage >&2; exit 1 ;;
esac
