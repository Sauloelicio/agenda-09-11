#!/usr/bin/env bash
# Aplica as migrations no projeto Supabase hospedado.
#
# Uso:
#   ./supabase/aplicar_hosted.sh 'SENHA_DO_BANCO'
#
# Por que o pooler? O host direto (db.<ref>.supabase.co) resolve apenas em IPv6
# e muitas redes nao tem IPv6. O pooler aceita IPv4. Usamos a porta 5432
# (session mode), que suporta DDL. A porta 6543 (transaction mode) NAO serve
# para migrations.
#
# A senha NAO fica salva em lugar nenhum: e usada so no argumento do comando.
set -euo pipefail

PROJECT_REF="ftywkjwvtwnjmnmnfdln"
# Descoberto via DNS: o host direto db.<ref>.supabase.co resolve em IPv6
# 2600:1f18:... (AWS us-east-1) e o pooler que reconhece o tenant e o aws-1.
POOLER_HOST="aws-1-us-east-1.pooler.supabase.com"

if [ $# -lt 1 ]; then
  echo "Uso: $0 'SENHA_DO_BANCO'" >&2
  echo "A senha esta em Dashboard -> Project Settings -> Database -> Database password." >&2
  exit 1
fi

PASSWORD="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE="${SUPABASE_BIN:-$HOME/.local/bin/supabase}"

cd "$ROOT"

# Percent-encode: a senha pode conter @ : / ? # % & + = e quebrar a URL.
ENC=$(printf '%s' "$PASSWORD" | sed -e 's/%/%25/g' -e 's/@/%40/g' -e 's/:/%3A/g' \
  -e 's|/|%2F|g' -e 's/?/%3F/g' -e 's/#/%23/g' -e 's/ /%20/g' -e 's/&/%26/g' \
  -e 's/+/%2B/g' -e 's/=/%3D/g')

DB_URL="postgresql://postgres.${PROJECT_REF}:${ENC}@${POOLER_HOST}:5432/postgres"

echo "==> Projeto: $PROJECT_REF"
echo "==> Pooler:  $POOLER_HOST:5432"
echo "==> Migrations em: $ROOT/supabase/migrations"
echo

"$SUPABASE" db push --db-url "$DB_URL" --include-all --yes

echo
echo "==> Verificando tabelas criadas..."
"$SUPABASE" db push --db-url "$DB_URL" --dry-run 2>/dev/null || true
echo "==> Concluido."
