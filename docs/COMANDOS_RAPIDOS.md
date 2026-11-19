# Comandos rápidos — local (Docker + front-end)

Cartão de referência para rodar e testar o projeto localmente sem precisar de
ajuda. Para explicações detalhadas, veja
[EXECUCAO_LOCAL_POSTGRES.md](EXECUCAO_LOCAL_POSTGRES.md).

## 1. Rotina diária (Windows, na pasta do projeto)

```powershell
.\dev.bat all          # sobe banco + front-end -> http://localhost:5173
```

Equivalente em PowerShell puro (caso a política de execução bloqueie o `.ps1`):

```powershell
powershell -ExecutionPolicy Bypass -File .\dev.ps1 all
```

Para parar tudo depois dos testes:

```powershell
.\dev.bat stop
```

`iniciar.bat` (duplo clique) também funciona: ele chama exatamente `all`.

## 2. Comandos individuais

| Objetivo | Windows | WSL |
|---|---|---|
| Só front-end (banco já está up) | `.\dev.bat app` | `./dev.sh app` |
| Só banco | `.\dev.bat db` | `./dev.sh db` |
| Banco + front-end | `.\dev.bat all` | `./dev.sh all` |
| Restart front-end | `.\dev.bat restart-app` | `./dev.sh restart-app` |
| Restart banco (mantém dados) | `.\dev.bat restart-db` | `./dev.sh restart-db` |
| Restart ambos | `.\dev.bat restart-all` | `./dev.sh restart-all` |
| Ver status | `.\dev.bat status` | `./dev.sh status` |
| Recriar banco do zero | `.\dev.bat db-reset` | `./dev.sh db-reset` |
| Banco com Studio (:54323) | `.\dev.bat db -Full` | `./dev.sh db --full` |

Dentro do WSL, entre antes com:

```bash
cd /home/saulo/si_agendsmrnto_wha/si_agendamento_wha
```

> `db-reset` **apaga os dados locais** e reaplica `supabase/migrations/` +
> `supabase/seed.sql`. Use só quando quiser voltar ao estado limpo.

## 3. Teste rápido de saúde

```powershell
docker info --format '{{.ServerVersion}}'                             # Docker ok
Invoke-WebRequest http://localhost:5173 -UseBasicParsing              # front 200
Invoke-WebRequest http://127.0.0.1:54321/auth/v1/settings -UseBasicParsing  # Auth 200
```

Usuário do seed: `demo@agendou.dev` / `demo1234`
→ `http://localhost:5173/admin` e `http://localhost:5173/agendar/demo-studio`.

Portas:

| Serviço | Endereço |
|---|---|
| Front-end (Vite) | `http://localhost:5173` |
| API REST / Auth | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (`-Full` / `--full`) | `http://127.0.0.1:54323` |

## 4. Se o Docker travar

Sintoma: `docker info` pendura ou `.\dev.bat db` falha com "daemon não responde".
No **PowerShell**:

```powershell
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -match '^(Docker Desktop|com\.docker\.|docker|docker-agent)$' } |
  Stop-Process -Force

Start-Sleep -Seconds 3
Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
```

Aguarde ~15 s, confirme e suba de novo:

```powershell
docker info --format '{{.ServerVersion}}'
.\dev.bat all
```

## 5. Depois dos testes: commit

No WSL:

```bash
cd /home/saulo/si_agendsmrnto_wha/si_agendamento_wha

git status --short          # veja exatamente o que mudou
git diff                    # confira antes de staged

git add <arquivo1> <arquivo2>
git commit -m "Descreva a mudança"
git push
```

> **Não use `git add .` sem conferir:** existem alterações pendentes de
> feature de billing (`src/lib/billing.ts`, `src/components/Billing*.tsx`,
> `supabase/functions/*`, `wrangler.jsonc`, etc.) que podem não ser suas.

## 6. O que não versionar

- `.env`, `.env.development.local` (já no `.gitignore`)
- `node_modules/`, `dist/`
- `supabase/.temp/`
