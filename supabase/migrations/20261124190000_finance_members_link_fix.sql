-- Correção da 20261124180000: no primeiro login do membro, o vínculo era recusado porque a
-- verificação do Google olhava auth.identities, que o Supabase só preenche DEPOIS de criar a
-- conta (dentro da mesma transação). Agora aceita também raw_app_meta_data.provider = 'google',
-- que já vem preenchido na criação da conta (o mesmo dado que enforce_allowed_email usa).
-- Pode ser rodada mais de uma vez.

create or replace function private.finance_members_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));

  if exists (select 1 from auth.users u where u.id = new.user_id and lower(u.email) = new.email) then
    raise exception 'O dono não pode ser membro das próprias Finanças' using errcode = '22023';
  end if;

  if exists (select 1 from public.finance_members m where m.member_id = new.user_id) then
    raise exception 'Um membro não pode ser dono de Finanças' using errcode = '22023';
  end if;

  if new.member_id is null then
    select u.id into new.member_id
      from auth.users u
     where lower(u.email) = new.email
       and (
         coalesce(u.raw_app_meta_data ->> 'provider', '') = 'google'
         or exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
       )
     limit 1;
  elsif not exists (
    select 1
      from auth.users u
     where u.id = new.member_id
       and lower(u.email) = new.email
       and (
         coalesce(u.raw_app_meta_data ->> 'provider', '') = 'google'
         or exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
       )
  ) then
    raise exception 'member_id não corresponde a uma conta Google com esse e-mail' using errcode = '22023';
  end if;

  if new.member_id is not null
     and exists (select 1 from public.finance_members m where m.user_id = new.member_id) then
    raise exception 'Um dono não pode ser membro' using errcode = '22023';
  end if;

  return new;
end;
$$;

select private.assert_rls_enabled();
