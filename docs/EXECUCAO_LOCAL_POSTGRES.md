# Execução local com Postgres (stack Supabase)

Este guia é dedicado a rodar o projeto na sua máquina usando o **banco local**.
Ele cobre o script único `dev.sh` (WSL) e os wrappers `dev.ps1` / `dev.bat` (Windows).

## 1. Por que "Postgres local" significa Supabase local

O frontend é uma SPA (Vite + React) que conversa com o banco por
`@supabase/supabase-js`. Ele depende de três serviços, não apenas do Postgres:

| Serviço | Função |
|---|---|
| **Postgres 17** | armazena os dados (`public`, `auth`, `extensions`) |
| **GoTrue (Auth)** | cadastro, login, sessões e JWT |
| **PostgREST (API)** | expõe tabelas/funções como REST, aplicando RLS |

Um container só com Postgres **não** é suficiente: o app não consegue autenticar
nem consultar tabelas. Por isso o "banco local" é o stack do Supabase via Docker,
com `supabase/config.toml` e `supabase/migrations/` deste repositório.

```text
Navegador  ->  Vite (WSL, :5173)  ->  supabase-js  ->  Supabase local (Docker)
                                                        |- API/Auth :54321
                                                        |- Postgres :54322
                                                        '- Studio   :54323 (opcional)
```

## 2. Pré-requisitos

- **WSL2** com a distro `Ubuntu`.
- **Node 22 + npm instalados dentro do WSL** (neste projeto, em `~/.local/node/bin`).
- **Supabase CLI 3.x** em `~/.local/bin/supabase`.
- **Docker Desktop** com a integração WSL habilitada para a distro `Ubuntu`.

Verificação rápida, dentro do WSL:

```bash
node -v                                   # v22.x
npm -v
supabase --version                        # 3.x
docker info --format '{{.ServerVersion}}' # responde sem erro
```

Se `docker` não for encontrado dentro do WSL, veja
[Docker não encontrado no WSL](#docker-não-encontrado-no-wsl).

## 3. Preparação inicial (uma única vez)

```bash
# 1. Entre no WSL e no diretório do projeto
cd /home/saulo/si_agendsmrnto_wha/si_agendamento_wha

# 2. Instale as dependências LINUX (importante: dentro do WSL)
npm ci

# 3. Suba o banco e deixe o script gerar .env.development.local
./dev.sh db

# 4. Garanta migrations + seed (apaga dados locais; seguro na primeira vez)
./dev.sh db-reset
```

No Windows, o equivalente é:

```powershell
.\dev.ps1 db
.\dev.ps1 db-reset
```

O arquivo `.env.development.local` é ignorado pelo Git. O script o cria
automaticamente a partir de `supabase status -o env` caso ele não exista:

```dotenv
VITE_SUPABASE_PROJECT_ID="si_agendamento_wha"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon/publishable key local>"
VITE_SUPABASE_URL="http://127.0.0.1:54321"
```

O Vite carrega esse arquivo com prioridade sobre `.env` quando roda
`npm run dev`. O `.env` continua apontando para o projeto hospedado.

> **Por que o Vite roda no WSL?** O diretório do projeto é acessado do Windows
> por `\\wsl.localhost\...` (filesystem 9p). O watcher do Node falha nesse
> filesystem (`EISDIR`, restarts em loop). `dev.sh` roda o Vite no ext4 do WSL e o
> Windows acessa pela porta encaminhada.

## 4. Comandos do script

Todos os comandos abaixo são aceitos tanto por `./dev.sh` (WSL) quanto por
`.\dev.ps1` / `dev.bat` (Windows).

| Comando | O que faz |
|---|---|
| `app` | Sobe **somente a aplicação** em `http://localhost:5173` |
| `db` | Sobe **somente o banco** (Postgres + Auth + REST) |
| `all` | Sobe **aplicação + banco** |
| `restart-app` | **Restart da aplicação** (mata o processo da porta 5173 e sobe de novo) |
| `restart-db` | **Restart do banco** (`supabase stop` + `start`, dados preservados) |
| `restart-all` | **Restart da aplicação + banco** |
| `status` | Mostra se app e banco estão rodando, com URLs |
| `stop` | Para aplicação e banco |
| `db-reset` | Apaga os dados locais, reaplica migrations e seed (pede confirmação) |
| `help` | Lista os comandos |

Exemplos:

```bash
# WSL
./dev.sh app
./dev.sh db
./dev.sh all
./dev.sh restart-app
./dev.sh restart-db
./dev.sh restart-all

# Windows (PowerShell)
.\dev.ps1 app
.\dev.ps1 db
.\dev.ps1 all
.\dev.ps1 restart-app
.\dev.ps1 restart-db
.\dev.ps1 restart-all
```

`iniciar.ps1` / `iniciar.bat` continuam funcionando e agora equivalem a
`dev.ps1 all` (banco + aplicação).

Se a política de execução do PowerShell bloquear `.\dev.ps1`, use `dev.bat`
(que já aplica `-ExecutionPolicy Bypass`) ou rode
`powershell -ExecutionPolicy Bypass -File .\dev.ps1 <comando>`.

### Stack mínima vs completa

Por padrão `db`, `all`, `restart-db` e `restart-all` usam o stack **mínimo**
(Postgres + Auth + REST), economizando cerca de 5 GB de imagens. Para subir
todos os serviços, inclusive o **Studio** na porta 54323:

```bash
./dev.sh db --full
./dev.sh all --full
```

```powershell
.\dev.ps1 db -Full
.\dev.ps1 all -Full
```

## 5. Portas, URLs e credenciais

| Serviço | Endereço |
|---|---|
| Aplicação (Vite) | `http://localhost:5173` |
| API REST / Auth | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (somente `--full`) | `http://127.0.0.1:54323` |
| Mailpit (somente `--full`) | `http://127.0.0.1:54324` |

Usuário criado pelo seed (`supabase/seed.sql`):

| Campo | Valor |
|---|---|
| E-mail | `demo@agendou.dev` |
| Senha | `demo1234` |
| Painel admin | `http://localhost:5173/admin` |
| Página pública | `http://localhost:5173/agendar/demo-studio` |

## 6. Acesso direto ao Postgres

Com o banco de pé:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

Em uma ferramenta gráfica (DBeaver, pgAdmin):

| Campo | Valor |
|---|---|
| Host | `127.0.0.1` |
| Porta | `54322` |
| Database | `postgres` |
| Usuário | `postgres` |
| Senha | `postgres` |

Para inspeção, o Studio (`--full`) é mais conveniente porque mostra tabelas e
políticas RLS. Evite alterar dados diretamente por SQL quando estiver testando
o app: escritas fora da API não passam pelo Auth/RLS.

## 7. Ciclo de vida dos dados

| Ação | Comando | Dados locais |
|---|---|---|
| Parar o banco | `./dev.sh stop` ou `restart-db` | **Preservados** (volumes Docker) |
| Reiniciar o banco | `./dev.sh restart-db` | **Preservados** |
| Recriar do zero | `./dev.sh db-reset` | **Apagados**, migrations + seed reaplicados |
| Subir de novo após `stop` | `./dev.sh db` | **Preservados** |

O script **nunca** usa `supabase stop --no-backup`, que apagaria os volumes.

## 8. Migrations

- As migrations locais ficam em `supabase/migrations/` e são aplicadas pelo
  `./dev.sh db-reset`.
- `supabase/seed.sql` é aplicado junto (configurado em `supabase/config.toml`).
- `drizzle/migrations/` é mantido apenas como referência histórica.
- Para o projeto hospedado, use `./supabase/aplicar_hosted.sh 'SENHA_DO_BANCO'`
  ou o SQL Editor, conforme o [README](../README.md#5-aplicar-as-migrations-no-projeto-hospedado).

Depois de criar uma migration local, rode `./dev.sh db-reset` para testá-la do
zero antes de enviar para o hosted.

## 9. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `docker: command not found` dentro do WSL | Integração WSL desligada **ou** backend do Docker Desktop travado | Confirme em Docker Desktop → **Settings → Resources → WSL Integration** se `Ubuntu` está habilitado. Se já está, o backend pode estar travado — veja [Docker Desktop travado](#docker-desktop-travado). |
| `Docker daemon nao responde` / `docker info` pendura | Docker Desktop não está rodando ou travou | Veja [Docker Desktop travado](#docker-desktop-travado). |
| `supabase status` lista vários serviços como `Stopped` | Stack mínima em execução | É esperado: somente Postgres, Auth e REST precisam estar ativos. Confira `API URL` e a URL do Postgres na saída do comando. |
| `[ERRO] node_modules Linux nao encontrado` | Dependências instaladas no Windows | Rode `npm ci` **dentro do WSL**. Se houver `node_modules` do Windows, renomeie para `node_modules.windows`. |
| Vite reinicia em loop / `EISDIR` | `npm run dev` executado no filesystem 9p do Windows | Use `./dev.sh app` ou `.\dev.ps1 app`, que rodam o Vite no WSL. |
| `Porta 5173 já em uso` | Processo antigo do Vite | `./dev.sh restart-app` encerra automaticamente o processo da porta. |
| `Porta 54321/54322 em uso` | Outro stack Supabase local | `./dev.sh stop` e tente novamente; ou `supabase stop --all`. |
| App abre, mas login falha | `.env.development.local` apontando para o hosted | Verifique se `VITE_SUPABASE_URL=http://127.0.0.1:54321`. Apague o arquivo e rode `./dev.sh db` para recriá-lo. |
| Primeira subida do banco demora | Download das imagens Docker | É normal na primeira vez; as próximas são rápidas. |
| Checkout/billing falha em local | Edge Function `create-checkout` não sobe no stack mínimo | Use `./dev.sh db --full` e configure os segredos do AbacatePay, ou teste o billing no projeto hospedado. Veja [ABACATE_PAY.md](ABACATE_PAY.md). |

### Docker Desktop travado

Sintoma típico: `docker info` ou `docker desktop status` ficam pendurados, os
processos do Docker Desktop têm vários dias de uptime e a distro WSL
`docker-desktop` aparece como `Stopped` em `wsl -l -v`. A integração WSL pode
estar corretamente habilitada — quem travou foi o backend.

Reinicialização limpa (no **Windows**, PowerShell):

```powershell
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -match '^(Docker Desktop|com\.docker\.|docker|docker-agent)$' } |
  Stop-Process -Force

Start-Sleep -Seconds 3
Start-Process 'C:\Users\saulo\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe'
```

Aguarde alguns segundos e confirme:

```powershell
docker info --format '{{.ServerVersion}}'
```

```bash
# dentro do WSL
docker info --format '{{.ServerVersion}}'
./dev.sh all
```

Se `C:` estiver com pouco espaço livre (o arquivo
`%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx` cresce bastante), libere espaço
ou mova o data root do Docker para outro disco antes de subir o stack.

## 10. Limitações do stack mínimo

Sem `--full`, estes serviços **não** sobem: Studio, Realtime, Storage, Image
Proxy, Edge Runtime, Logflare, Vector, Supavisor, Postgres Meta e Mailpit.
O fluxo principal do app (cadastro, login, agendamentos, painel admin) não
depende deles. A única funcionalidade afetada é o checkout via Edge Function
do AbacatePay.
