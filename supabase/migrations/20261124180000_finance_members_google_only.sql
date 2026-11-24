-- Membros das Finanças só entram pelo Google.
-- Motivo: o login por e-mail continua ligado no Supabase (o dono usa o link por e-mail) e,
-- sem confirmação de e-mail, alguém que soubesse o e-mail do membro poderia criar uma conta
-- com senha antes dele e ganhar o acesso. Com esta regra, a conta do membro só é aceita e
-- ligada quando vem do Google (que comprova a posse do e-mail).
-- O dono não é afetado: o caminho dele continua sendo a lista private.allowed_emails.
-- Pode ser rodada mais de uma vez.

-- 1. Cadastro: e-mail de membro só pode criar conta pelo Google.
create or replace function private.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not (
       exists (select 1 from private.allowed_emails where email = lower(new.email))
       or (
         coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google'
         and exists (
           select 1
             from public.finance_members m
             join auth.users o on o.id = m.user_id
             join private.allowed_emails a on a.email = lower(o.email)
            where m.email = lower(new.email)
              and m.active
         )
       )
     ) then
    raise exception 'E-mail não autorizado' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2. Primeiro login: só liga o vínculo se a conta veio do Google.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    update public.finance_members
       set member_id = new.id,
           updated_at = now()
     where email = lower(new.email)
       and active
       and member_id is null;

    if found then
      insert into public.profiles (user_id) values (new.id) on conflict do nothing;
      return new;
    end if;
  end if;

  perform private.seed_user(new.id);
  return new;
end;
$$;

-- 3. Cadastro do membro no SQL Editor: só liga a uma conta que já exista se ela tiver login Google.
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
       and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
     limit 1;
  elsif not exists (
    select 1
      from auth.users u
     where u.id = new.member_id
       and lower(u.email) = new.email
       and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
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
