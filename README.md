# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f2fa834f-bcaa-4c84-bd16-dff6ada57ed5

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f2fa834f-bcaa-4c84-bd16-dff6ada57ed5) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/f2fa834f-bcaa-4c84-bd16-dff6ada57ed5) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## Desenvolvimento local com Supabase (Docker)

O projeto usa Supabase (Auth + PostgREST) e não funciona apenas com Postgres puro.
Para rodar tudo localmente é necessário o **Supabase CLI** e o **Docker**.

### 1. Instalar o Supabase CLI

```bash
# Linux/WSL (binário standalone, sem Node)
curl -fsSL -o /tmp/supabase.tar.gz \
  https://github.com/supabase/cli/releases/download/v3.1.0/supabase_3.1.0_linux_amd64.tar.gz
tar -xzf /tmp/supabase.tar.gz -C /tmp
mkdir -p ~/.local/bin && mv /tmp/supabase ~/.local/bin/
export PATH="$HOME/.local/bin:$PATH"
```

### 2. Subir o banco local

```bash
supabase start          # sobe Postgres + Auth + REST + Studio (primeira vez baixa imagens)
supabase db reset       # aplica supabase/migrations/* e supabase/seed.sql
supabase status         # mostra API URL, anon key e Studio
```

> **Máquina com pouco espaço em disco?** O app só precisa de Postgres + Auth + REST.
> Suba apenas o essencial (economiza ~5 GB de imagens):
>
> ```bash
> supabase start -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
> ```

Serviços locais:

| Serviço | URL |
|---|---|
| API (REST/Auth) | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | `http://127.0.0.1:54323` |
| Inbucket (emails) | `http://127.0.0.1:54324` |

### 3. Apontar o frontend para o banco local

Crie `.env.development.local` (não versionado) com os valores impressos por `supabase status`:

```dotenv
VITE_SUPABASE_PROJECT_ID="si_agendamento_wha"
VITE_SUPABASE_PUBLISHABLE_KEY="<ANON_KEY>"
VITE_SUPABASE_URL="http://127.0.0.1:54321"
```

O Vite carrega esse arquivo apenas em `npm run dev`. O `.env` continua apontando para o projeto hospedado.

### 4. Rodar a aplicação

Com o projeto dentro do WSL, rode o Vite **no WSL** (filesystem nativo). O Windows
acessa pela porta encaminhada:

```bash
# dentro do WSL
export PATH="$HOME/.local/node/bin:$PATH"   # Node instalado em user-space
cd /home/saulo/si_agendsmrnto_wha/si_agendamento_wha
npm run dev   # http://localhost:5173
```

No Windows, `iniciar.ps1` / `iniciar.bat` já fazem isso e abrem o navegador.
Ambos apenas chamam `dev.sh` (que fixa o PATH do Node e roda `npm run dev`).

> **Por que não rodar `npm run dev` no Windows?** O projeto fica em
> `\\wsl.localhost\...`; o watcher do Node falha nesse filesystem 9p
> (`EISDIR` e restarts em loop). Por isso `node_modules` é instalado dentro do
> WSL. Se precisar buildar no Windows, renomeie `node_modules` para
> `node_modules.windows` antes de rodar `npm ci` no Windows.

Credenciais do seed local:

- **E-mail:** `demo@agendou.dev`
- **Senha:** `demo1234`
- **Painel:** `/admin`
- **Página pública:** `/agendar/demo-studio`

### 5. Aplicar as migrations no projeto hospedado

```bash
# Opção A (recomendada neste projeto): usa o pooler IPv4 automaticamente
./supabase/aplicar_hosted.sh 'SENHA_DO_BANCO'
```

```bash
# Opção B: link + push direto
supabase link --project-ref <PROJECT_REF>
supabase db push
```

> **IPv6:** o host direto `db.<ref>.supabase.co:5432` só responde em IPv6. Em
> redes sem IPv6 use o pooler (session mode, porta 5432):
> `postgresql://postgres.<ref>:SENHA@aws-1-us-east-1.pooler.supabase.com:5432/postgres`.
> A porta 6543 (transaction mode) **não** serve para DDL/migrations.
>
> O projeto `ftywkjwvtwnjmnmnfdln` está em **us-east-1** (o IPv6 do host direto
> começa com `2600:1f18`) e o pooler que reconhece o tenant é o `aws-1`.

Alternativa sem senha do banco: executar os arquivos de `supabase/migrations/`
no SQL Editor, em ordem cronológica. Para facilitar, `supabase/apply_all.sql`
já contém todas as migrations concatenadas na ordem correta — basta colar o
arquivo inteiro no SQL Editor de um projeto vazio.

Depois, no Dashboard:

- **Authentication → URL Configuration:** Site URL e Redirect URLs do domínio
  onde o app está publicado (veja a seção de deploy abaixo)
- **Authentication → Sign In / Providers → Email:** desligue **"Confirm email"**.
  O cadastro não exige confirmação: a conta nasce ativa e o usuário entra
  direto no sistema (`requiresEmailConfirmation` foi removido do app).
- Alternativa sem painel: a migration
  `20261112120000_auto_confirm_users.sql` cria um trigger em `auth.users`
  que marca `email_confirmed_at` no INSERT, produzindo o mesmo efeito
  (validado com GoTrue `mailer_autoconfirm=false`).

#### Super admin (master)

A migration `20261112130000_master_admin.sql` cria `public.master_admins` e a
camada de super admin da plataforma.

- Conta master: **`sauloelicio554@gmail.com`** (a senha é definida no Auth).
- Ao entrar, o master vê todas as contas e acessa o **Painel Master** em
  `/master` (link "Painel Master" também aparece no cabeçalho de `/admin`).
- No painel é possível: ver métricas de todas as contas, alterar plano/status/
  validade do teste, abrir o painel de qualquer conta, transferir a
  propriedade, excluir a conta com todos os dados e conceder/remover master.
- O master não depende de `tenant_members`: `is_tenant_member()`,
  `tenant_has_access()` e `has_role()` passam a liberar acesso total para ele.
  Usuários comuns continuam isolados pelo RLS.
- Escritas sensíveis passam por RPCs `SECURITY DEFINER` que exigem
  `is_master()`: `master_list_accounts`, `master_list_users`,
  `master_set_subscription`, `master_set_tenant_owner`,
  `master_delete_tenant` e `master_set_master`.
- A conta master entra automaticamente em `master_admins` quando é criada
  (trigger em `auth.users`); a migration também vincula a conta se ela já
  existir.

### 6. Deploy na Vercel

O `vercel.json` já define framework, pasta de saída e o rewrite de SPA
(necessário para rotas como `/agendar/:slug` e `/admin` funcionarem no refresh).

Variáveis de ambiente do projeto na Vercel (Settings → Environment Variables):

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://ftywkjwvtwnjmnmnfdln.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (chave publicável) |
| `VITE_SUPABASE_PROJECT_ID` | `ftywkjwvtwnjmnmnfdln` |

Elas são embutidas no bundle durante o build — depois de alterá-las, faça um
novo deploy (Redeploy), não basta reiniciar.

Depois do primeiro deploy de produção:

1. Copie a URL final (ex.: `https://agenda-09-11.vercel.app`).
2. No Supabase: **Authentication → URL Configuration**
   - Site URL: a URL de produção
   - Redirect URLs: a URL de produção + `/**` (e `http://localhost:5173/**` se
     quiser testar o frontend local contra o banco hospedado)
3. Se o preview responder `vercel.com/login`, desligue
   **Settings → Deployment Protection → Vercel Authentication** (ou faça
   "Promote to Production" no deploy desejado).

### Estrutura do banco

| Grupo | Tabelas |
|---|---|
| SaaS multi-tenant | `tenants`, `tenant_members`, `tenant_settings`, `tenant_services`, `tenant_professionals`, `tenant_appointments`, `tenant_clients` |
| Legado (`/legacy-nails`) | `services`, `blocked_dates`, `business_settings`, `appointments` |
| Auth/roles | `auth.users`, `user_roles` |

As migrations ficam em `supabase/migrations/`. A pasta `drizzle/migrations/`
é mantida apenas como referência histórica.
