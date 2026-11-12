-- ==============================================================================
-- MASTER / SUPER ADMIN
--
-- Adiciona uma camada de super administrador da plataforma, independente dos
-- donos de cada tenant.
--
--   * public.master_admins guarda quem é master.
--   * public.is_master() responde se o usuário logado é master.
--   * is_tenant_member(), tenant_has_access() e has_role() passam a liberar
--     o master para todos os tenants, sem afetar o isolamento entre contas
--     normais (RLS continua valendo para todo mundo que não é master).
--   * RPCs SECURITY DEFINER permitem listar/gerenciar contas e assinaturas
--     sem ampliar grants perigosos para usuários comuns.
--
-- Idempotente: pode ser aplicada mais de uma vez.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Tabela de masters
-- ------------------------------------------------------------------------------
create table if not exists public.master_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.master_admins enable row level security;

grant select on public.master_admins to authenticated;
grant all on public.master_admins to service_role;

drop policy if exists master_read_self on public.master_admins;
create policy master_read_self on public.master_admins
  for select to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. is_master()
-- ------------------------------------------------------------------------------
create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.master_admins where user_id = auth.uid()
  );
$$;

comment on function public.is_master() is
  'Verdadeiro quando o usuário logado está em public.master_admins (super admin da plataforma).';

revoke all on function public.is_master() from public, anon;
grant execute on function public.is_master() to authenticated;

-- ------------------------------------------------------------------------------
-- 3. Bypass de isolamento para o master
-- ------------------------------------------------------------------------------
create or replace function public.is_tenant_member(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select public.is_master()
      or exists (
        select 1 from public.tenant_members
        where tenant_id = _tenant_id and user_id = auth.uid()
      );
$$;

create or replace function public.tenant_has_access(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select public.is_master()
      or exists (
        select 1
        from public.tenants
        where id = _tenant_id
          and (
            subscription_status = 'active'
            or (subscription_status = 'trial' and trial_ends_at > statement_timestamp())
          )
      );
$$;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select (public.is_master() and _user_id = auth.uid())
      or exists (
        select 1 from public.user_roles
        where user_id = _user_id and role = _role
      );
$$;

-- ------------------------------------------------------------------------------
-- 4. Grants e policies extras para o master enxergar/gerenciar tudo
-- ------------------------------------------------------------------------------

-- Master lê todos os vínculos (necessário para listar donos no painel).
drop policy if exists master_read_tenant_members on public.tenant_members;
create policy master_read_tenant_members on public.tenant_members
  for select to authenticated
  using (public.is_master());

-- Master pode transferir/adicionar/remover vínculos de dono.
grant insert, update, delete on public.tenant_members to authenticated;

drop policy if exists master_manage_tenant_members on public.tenant_members;
create policy master_manage_tenant_members on public.tenant_members
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Master lê todas as roles.
drop policy if exists master_read_user_roles on public.user_roles;
create policy master_read_user_roles on public.user_roles
  for select to authenticated
  using (public.is_master());

-- Master gerencia agendamentos de qualquer conta (inclusive editar/cancelar).
grant insert, update, delete on public.tenant_appointments to authenticated;

drop policy if exists master_manage_tenant_appointments on public.tenant_appointments;
create policy master_manage_tenant_appointments on public.tenant_appointments
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Master gerencia a base de clientes de qualquer conta.
grant insert, delete on public.tenant_clients to authenticated;

drop policy if exists master_manage_tenant_clients on public.tenant_clients;
create policy master_manage_tenant_clients on public.tenant_clients
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- ------------------------------------------------------------------------------
-- 5. RPCs do painel master
-- ------------------------------------------------------------------------------

-- Lista todas as contas com métricas agregadas.
create or replace function public.master_list_accounts()
returns table (
  tenant_id uuid,
  name text,
  slug text,
  segment text,
  plan text,
  subscription_status text,
  trial_ends_at timestamptz,
  created_at timestamptz,
  owner_email text,
  owner_name text,
  services_count bigint,
  professionals_count bigint,
  appointments_count bigint,
  clients_count bigint,
  revenue_total numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    t.id,
    t.name,
    t.slug,
    t.segment,
    t.plan,
    t.subscription_status,
    t.trial_ends_at,
    t.created_at,
    (
      select u.email::text
      from public.tenant_members m
      join auth.users u on u.id = m.user_id
      where m.tenant_id = t.id and m.role = 'owner'
      order by m.created_at
      limit 1
    ),
    (
      select coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.email::text
      )
      from public.tenant_members m
      join auth.users u on u.id = m.user_id
      where m.tenant_id = t.id and m.role = 'owner'
      order by m.created_at
      limit 1
    ),
    (select count(*) from public.tenant_services s where s.tenant_id = t.id),
    (select count(*) from public.tenant_professionals p where p.tenant_id = t.id),
    (select count(*) from public.tenant_appointments a where a.tenant_id = t.id),
    (select count(*) from public.tenant_clients c where c.tenant_id = t.id),
    (
      select coalesce(sum(a.price), 0)
      from public.tenant_appointments a
      where a.tenant_id = t.id and a.status <> 'cancelled'
    )
  from public.tenants t
  where public.is_master()
  order by t.created_at desc;
$$;

comment on function public.master_list_accounts() is
  'Painel master: todas as contas com dono e métricas. Retorna vazio para quem não é master.';

revoke all on function public.master_list_accounts() from public, anon;
grant execute on function public.master_list_accounts() to authenticated;

-- Lista usuários da plataforma.
create or replace function public.master_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_master boolean,
  tenant_count bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email::text),
    u.created_at,
    u.last_sign_in_at,
    exists (select 1 from public.master_admins ma where ma.user_id = u.id),
    (select count(*) from public.tenant_members m where m.user_id = u.id and m.role = 'owner')
  from auth.users u
  where public.is_master() and u.deleted_at is null
  order by u.created_at desc;
$$;

revoke all on function public.master_list_users() from public, anon;
grant execute on function public.master_list_users() to authenticated;

-- Altera plano/status/teste de uma conta.
create or replace function public.master_set_subscription(
  _tenant_id uuid,
  _plan text,
  _status text,
  _trial_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_master() then
    raise exception 'not_master' using errcode = '42501';
  end if;
  if _plan not in ('trial', 'basic', 'pro', 'enterprise') then
    raise exception 'invalid_plan';
  end if;
  if _status not in ('trial', 'active', 'expired', 'past_due', 'canceled') then
    raise exception 'invalid_status';
  end if;

  update public.tenants
     set plan = _plan,
         subscription_status = _status,
         trial_ends_at = coalesce(_trial_ends_at, trial_ends_at),
         updated_at = now()
   where id = _tenant_id;

  if not found then
    raise exception 'tenant_not_found';
  end if;
end;
$$;

revoke all on function public.master_set_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.master_set_subscription(uuid, text, text, timestamptz) to authenticated;

-- Transfere a posse de uma conta para outro e-mail já cadastrado.
create or replace function public.master_set_tenant_owner(_tenant_id uuid, _email text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid;
begin
  if not public.is_master() then
    raise exception 'not_master' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = _tenant_id) then
    raise exception 'tenant_not_found';
  end if;

  select id into v_user_id
    from auth.users
   where lower(email) = lower(trim(_email)) and deleted_at is null
   limit 1;

  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  update public.tenant_members
     set role = 'manager'
   where tenant_id = _tenant_id and user_id <> v_user_id and role = 'owner';

  insert into public.tenant_members (tenant_id, user_id, role)
  values (_tenant_id, v_user_id, 'owner')
  on conflict (tenant_id, user_id) do update set role = 'owner';
end;
$$;

revoke all on function public.master_set_tenant_owner(uuid, text) from public, anon;
grant execute on function public.master_set_tenant_owner(uuid, text) to authenticated;

-- Exclui uma conta e todos os dados vinculados (cascata).
create or replace function public.master_delete_tenant(_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_master() then
    raise exception 'not_master' using errcode = '42501';
  end if;

  delete from public.tenants where id = _tenant_id;

  if not found then
    raise exception 'tenant_not_found';
  end if;
end;
$$;

revoke all on function public.master_delete_tenant(uuid) from public, anon;
grant execute on function public.master_delete_tenant(uuid) to authenticated;

-- Concede/revoga o papel de master (nunca deixa a plataforma sem master).
create or replace function public.master_set_master(_user_id uuid, _enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_master() then
    raise exception 'not_master' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = _user_id and deleted_at is null) then
    raise exception 'user_not_found';
  end if;

  if _enabled then
    insert into public.master_admins (user_id) values (_user_id)
    on conflict (user_id) do nothing;

    insert into public.user_roles (user_id, role) values (_user_id, 'admin')
    on conflict (user_id, role) do nothing;
  else
    if (select count(*) from public.master_admins) <= 1
       and exists (select 1 from public.master_admins where user_id = _user_id) then
      raise exception 'last_master';
    end if;

    delete from public.master_admins where user_id = _user_id;
  end if;
end;
$$;

revoke all on function public.master_set_master(uuid, boolean) from public, anon;
grant execute on function public.master_set_master(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Vínculo automático da conta master
-- ------------------------------------------------------------------------------

-- Ao criar a conta master (inclusive em um projeto novo), já entra em
-- master_admins e user_roles.
create or replace function public.register_master_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if lower(new.email) = 'sauloelicio554@gmail.com' then
    insert into public.master_admins (user_id, note)
    values (new.id, 'super admin')
    on conflict (user_id) do nothing;

    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

comment on function public.register_master_user() is
  'Garante que a conta master da plataforma receba o papel de super admin automaticamente.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.register_master_user() to supabase_auth_admin;
  end if;
end;
$$;

drop trigger if exists on_auth_user_created_master on auth.users;
create trigger on_auth_user_created_master
  after insert on auth.users
  for each row
  execute function public.register_master_user();

-- Aplica o papel master à conta que já existe hoje.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
    from auth.users
   where lower(email) = 'sauloelicio554@gmail.com'
     and deleted_at is null
   limit 1;

  if v_user_id is not null then
    insert into public.master_admins (user_id, note)
    values (v_user_id, 'super admin')
    on conflict (user_id) do nothing;

    insert into public.user_roles (user_id, role)
    values (v_user_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
end;
$$;
