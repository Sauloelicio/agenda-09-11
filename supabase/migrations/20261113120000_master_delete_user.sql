-- ==============================================================================
-- MASTER: EXCLUIR USUÁRIOS
--
-- Permite que o super admin (master) apague definitivamente uma conta de
-- usuário da plataforma pelo Painel Master.
--
-- Regras de segurança:
--   * somente master pode executar;
--   * o master não pode excluir a própria conta;
--   * contas master precisam perder o papel master antes de serem excluídas;
--   * contas (tenants) em que o usuário é o único dono são apagadas junto,
--     com todos os dados em cascata;
--   * se a conta tiver outro dono, apenas o vínculo do usuário é removido.
--
-- Idempotente: pode ser aplicada mais de uma vez.
-- ==============================================================================

create or replace function public.master_delete_user(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_deleted_tenants integer := 0;
begin
  if not public.is_master() then
    raise exception 'not_master' using errcode = '42501';
  end if;

  if _user_id = auth.uid() then
    raise exception 'cannot_delete_self' using errcode = '42501';
  end if;

  if exists (select 1 from public.master_admins where user_id = _user_id) then
    raise exception 'cannot_delete_master' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users where id = _user_id and deleted_at is null
  ) then
    raise exception 'user_not_found';
  end if;

  -- Contas em que o usuário é o único dono: apaga a conta inteira.
  with owned as (
    select m.tenant_id
      from public.tenant_members m
     where m.user_id = _user_id
       and m.role = 'owner'
       and not exists (
         select 1
           from public.tenant_members other
          where other.tenant_id = m.tenant_id
            and other.user_id <> _user_id
            and other.role = 'owner'
       )
  ), deleted as (
    delete from public.tenants t
     using owned o
     where t.id = o.tenant_id
    returning t.id
  )
  select count(*) into v_deleted_tenants from deleted;

  -- Remove o usuário do Auth. Vínculos (tenant_members, user_roles,
  -- master_admins, sessões e identidades) saem em cascata.
  delete from auth.users where id = _user_id;

  return jsonb_build_object('deleted_tenants', v_deleted_tenants);
end;
$$;

comment on function public.master_delete_user(uuid) is
  'Painel master: exclui um usuário e as contas em que ele é o único dono.';

revoke all on function public.master_delete_user(uuid) from public, anon;
grant execute on function public.master_delete_user(uuid) to authenticated;
