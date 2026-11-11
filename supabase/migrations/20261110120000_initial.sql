create type public.app_role as enum ('admin');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.grant_first_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.grant_first_admin();

create or replace function public.admin_exists() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where role='admin') $$;
grant execute on function public.admin_exists() to anon, authenticated;

create table public.services (id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now());
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public read services" on public.services for select using (true);
create policy "admin write services" on public.services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.blocked_dates (id uuid primary key default gen_random_uuid(), date date not null unique, created_at timestamptz not null default now());
grant select on public.blocked_dates to anon, authenticated;
grant insert, update, delete on public.blocked_dates to authenticated;
grant all on public.blocked_dates to service_role;
alter table public.blocked_dates enable row level security;
create policy "public read blocked" on public.blocked_dates for select using (true);
create policy "admin write blocked" on public.blocked_dates for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.services(name, sort_order) values ('Unha postiças realista',1),('Gel na tips',2),('Fibra de vidro',3),('Molde F1',4),('Cílios',5),('Sobrancelhas',6);