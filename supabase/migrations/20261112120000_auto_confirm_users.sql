-- ==============================================================================
-- Cadastro sem confirmação de e-mail
--
-- Todo usuário criado em auth.users já nasce com email_confirmed_at
-- preenchido. Com isso:
--   * o GoTrue não envia e-mail de confirmação;
--   * o signup devolve sessão e o usuário entra direto no sistema;
--   * contas antigas que ficaram pendentes são confirmadas agora.
--
-- O ajuste preferencial continua sendo desligar "Confirm email" no painel
-- (Authentication > Sign In / Providers > Email). Este trigger garante o
-- mesmo comportamento em nível de banco, inclusive para cadastros feitos
-- pela Admin API e por integrações.
-- ==============================================================================

create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  -- confirmed_at é coluna gerada (LEAST(email_confirmed_at, phone_confirmed_at)),
  -- portanto só email_confirmed_at precisa ser definido.
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

comment on function public.auto_confirm_new_user() is
  'Marca o usuário como confirmado no INSERT: remove a exigência de confirmação de e-mail no cadastro.';

drop trigger if exists on_auth_user_created_auto_confirm on auth.users;
create trigger on_auth_user_created_auto_confirm
  before insert on auth.users
  for each row
  execute function public.auto_confirm_new_user();

-- O GoTrue grava em auth.users como supabase_auth_admin.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.auto_confirm_new_user() to supabase_auth_admin;
  end if;
end;
$$;

-- Confirma as contas que ficaram pendentes antes desta migration.
update auth.users
   set email_confirmed_at = now()
 where email_confirmed_at is null
   and deleted_at is null;
