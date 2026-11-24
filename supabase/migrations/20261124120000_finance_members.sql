-- Acesso de membros (esposa) às Finanças do dono (Luan).
-- Plano: docs/plano-acesso-financas-esposa.md (aprovado em 2026-11-24).
-- Revisada por auditoria de segurança antes de aplicar (2026-11-24).
--
-- Regras:
--   * O membro vê e edita TODO o livro Pessoal do dono (lançamentos, categorias, regras de importação,
--     bancos e cartões, contas fixas, metas, formas de pagamento, investimentos e cópia do CDI).
--   * O membro NÃO vê nada do livro Trust Care (lançamentos, categorias e regras com ledger = 'trustcare')
--     nem Notebooks, e não usa nenhuma outra tabela do app (nem cria dados próprios fora de Finanças).
--   * Tudo que o membro grava fica com user_id = dono (gatilho + política restritiva).
--   * O primeiro login de um membro só cria o perfil: nada de áreas, pastas ou categorias próprias.
--   * Membros só são cadastrados pelo SQL Editor (o app e o navegador não podem gravar em finance_members).
--
-- Nada muda para o dono: as políticas novas só valem para quem é membro ativo.
-- Pode ser rodada mais de uma vez.
--
-- ATENÇÃO para tabelas NOVAS de Finanças: dar a elas as três peças (política de membro, política
-- restritiva "membro: só grava no dono" e gatilho finance_member_set_owner). Tabelas novas FORA de
-- Finanças: dar a política restritiva "membro: fora de Finanças".

-- ---------------------------------------------------------------------------
-- 1. Tabela de membros. user_id = dono (segue a convenção do projeto).
-- ---------------------------------------------------------------------------
create table if not exists public.finance_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  member_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_members_email_key unique (email),
  constraint finance_members_not_self check (member_id is null or member_id <> user_id)
);

comment on table public.finance_members is
  'Quem pode usar as Finanças (só o livro Pessoal) de um dono. user_id = dono; member_id = conta do membro. '
  'Cadastro só pelo SQL Editor.';

-- Uma conta só pode ser membro de um dono (deixa finance_member_owner() determinística).
create unique index if not exists finance_members_member_id_key
  on public.finance_members (member_id) where member_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'finance_members' and policyname = 'dono acessa'
  ) then
    perform private.apply_owner_policy('public.finance_members');
  end if;
end;
$$;

-- Ninguém grava em finance_members pelo app/navegador: só o SQL Editor (postgres).
revoke insert, update, delete on public.finance_members from authenticated;

-- O membro enxerga o próprio vínculo (o app usa para saber que é membro). Não pode alterá-lo.
drop policy if exists "membro lê o próprio vínculo" on public.finance_members;
create policy "membro lê o próprio vínculo" on public.finance_members
  for select to authenticated
  using (member_id = (select auth.uid()) and active);

-- Normaliza o e-mail, liga o vínculo à conta do membro (por e-mail) e barra combinações inválidas.
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
    select u.id into new.member_id from auth.users u where lower(u.email) = new.email limit 1;
  elsif not exists (select 1 from auth.users u where u.id = new.member_id and lower(u.email) = new.email) then
    raise exception 'member_id não corresponde ao e-mail' using errcode = '22023';
  end if;

  if new.member_id is not null
     and exists (select 1 from public.finance_members m where m.user_id = new.member_id) then
    raise exception 'Um dono não pode ser membro' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_members_link on public.finance_members;
create trigger finance_members_link
  before insert or update of email, member_id, user_id on public.finance_members
  for each row execute function private.finance_members_link();

-- ---------------------------------------------------------------------------
-- 2. Dono das Finanças de quem está logado (null quando não é membro ativo).
--    security definer: lê finance_members sem depender do RLS; só devolve um uuid.
-- ---------------------------------------------------------------------------
create or replace function public.finance_member_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
    from public.finance_members m
   where m.member_id = (select auth.uid())
     and m.active
   limit 1
$$;

revoke all on function public.finance_member_owner() from public, anon;
grant execute on function public.finance_member_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Políticas extras de Finanças (permissivas: somam com "dono acessa").
-- ---------------------------------------------------------------------------

-- 3a. Tabelas com livro: só o Pessoal, na leitura e na gravação (não dá para mudar para Trust Care).
--     Em transactions o membro também não liga lançamentos a notebooks (Trust Care).
do $$
declare
  t text;
  extra text;
begin
  foreach t in array array['transactions', 'finance_categories', 'finance_rules'] loop
    extra := case when t = 'transactions' then ' and notebook_id is null' else '' end;
    execute format('drop policy if exists "membro: livro pessoal do dono" on public.%I', t);
    execute format(
      'create policy "membro: livro pessoal do dono" on public.%I for all to authenticated '
      'using (ledger = ''pessoal'' and user_id = (select public.finance_member_owner())) '
      'with check (ledger = ''pessoal'' and user_id = (select public.finance_member_owner())%s)',
      t, extra
    );
  end loop;
end;
$$;

-- 3b. Tabelas só do Pessoal (sem coluna de livro): tudo do dono.
do $$
declare
  t text;
begin
  foreach t in array array[
    'payment_methods',
    'finance_accounts',
    'finance_investments',
    'finance_investment_movements',
    'finance_cdi_daily'
  ] loop
    execute format('drop policy if exists "membro: finanças do dono" on public.%I', t);
    execute format(
      'create policy "membro: finanças do dono" on public.%I for all to authenticated '
      'using (user_id = (select public.finance_member_owner())) '
      'with check (user_id = (select public.finance_member_owner()))',
      t
    );
  end loop;
end;
$$;

-- 3c. Metas e contas fixas: do dono, e só com categoria que o membro enxerga (categorias do Pessoal).
do $$
declare
  t text;
  cond text := 'user_id = (select public.finance_member_owner()) and (category_id is null or exists '
               '(select 1 from public.finance_categories c where c.id = category_id))';
begin
  foreach t in array array['finance_recurring_bills', 'finance_budgets'] loop
    execute format('drop policy if exists "membro: finanças do dono" on public.%I', t);
    execute format(
      'create policy "membro: finanças do dono" on public.%I for all to authenticated '
      'using (%s) with check (%s)',
      t, cond, cond
    );
  end loop;
end;
$$;

-- 3d. Restritiva: para o membro, toda gravação tem de ficar com user_id = dono
--     (impede "puxar" linhas para a conta do membro trocando o user_id).
do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions', 'finance_categories', 'finance_rules', 'payment_methods', 'finance_accounts',
    'finance_recurring_bills', 'finance_budgets', 'finance_investments',
    'finance_investment_movements', 'finance_cdi_daily'
  ] loop
    execute format('drop policy if exists "membro: só grava no dono" on public.%I', t);
    execute format(
      'create policy "membro: só grava no dono" on public.%I as restrictive for all to authenticated '
      'using (true) '
      'with check ((select public.finance_member_owner()) is null '
      'or user_id = (select public.finance_member_owner()))',
      t
    );
  end loop;
end;
$$;

-- 3e. Restritiva: membro não apaga de vez itens que o Trust Care também pode usar (as chaves
--     estrangeiras ignoram o RLS). O app só faz exclusão lógica (deleted_at) nessas tabelas.
do $$
declare
  t text;
begin
  foreach t in array array['payment_methods', 'finance_accounts', 'finance_categories'] loop
    execute format('drop policy if exists "membro: não apaga de vez" on public.%I', t);
    execute format(
      'create policy "membro: não apaga de vez" on public.%I as restrictive for delete to authenticated '
      'using ((select public.finance_member_owner()) is null)',
      t
    );
  end loop;
end;
$$;

-- 3f. Restritiva: membro não usa nenhuma outra tabela do app (nem cria dados próprios),
--     exceto o próprio perfil e o próprio vínculo.
do $$
declare
  t text;
begin
  for t in
    select p.tablename
      from pg_policies p
     where p.schemaname = 'public'
       and p.policyname = 'dono acessa'
       and p.tablename not in (
         'profiles', 'finance_members', 'transactions', 'finance_categories', 'finance_rules',
         'payment_methods', 'finance_accounts', 'finance_recurring_bills', 'finance_budgets',
         'finance_investments', 'finance_investment_movements', 'finance_cdi_daily'
       )
  loop
    execute format('drop policy if exists "membro: fora de Finanças" on public.%I', t);
    execute format(
      'create policy "membro: fora de Finanças" on public.%I as restrictive for all to authenticated '
      'using ((select public.finance_member_owner()) is null) '
      'with check ((select public.finance_member_owner()) is null)',
      t
    );
  end loop;
end;
$$;

-- Anexos (Storage): membro não envia nem lê arquivos.
drop policy if exists "membro: sem anexos" on storage.objects;
create policy "membro: sem anexos" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'attachments' or (select public.finance_member_owner()) is null)
  with check (bucket_id <> 'attachments' or (select public.finance_member_owner()) is null);

-- ---------------------------------------------------------------------------
-- 4. Gatilho: o que o membro grava passa a ser do dono.
--    Roda antes do RLS conferir a gravação (WITH CHECK vem depois dos gatilhos BEFORE).
-- ---------------------------------------------------------------------------
create or replace function private.finance_member_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select m.user_id into owner
    from public.finance_members m
   where m.member_id = auth.uid()
     and m.active
   limit 1;

  if owner is not null and (new.user_id is null or new.user_id = auth.uid()) then
    new.user_id := owner;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions', 'finance_categories', 'finance_rules', 'payment_methods', 'finance_accounts',
    'finance_recurring_bills', 'finance_budgets', 'finance_investments',
    'finance_investment_movements', 'finance_cdi_daily'
  ] loop
    execute format('drop trigger if exists finance_member_set_owner on public.%I', t);
    execute format(
      'create trigger finance_member_set_owner before insert on public.%I '
      'for each row execute function private.finance_member_set_owner()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Login: membro ativo de um dono autorizado pode criar conta; não ganha áreas, pastas nem categorias.
-- ---------------------------------------------------------------------------
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
       or exists (
         select 1
           from public.finance_members m
           join auth.users o on o.id = m.user_id
           join private.allowed_emails a on a.email = lower(o.email)
          where m.email = lower(new.email)
            and m.active
       )
     ) then
    raise exception 'E-mail não autorizado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Membro das Finanças: liga o vínculo e cria só o perfil.
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

  perform private.seed_user(new.id);
  return new;
end;
$$;

select private.index_foreign_keys();
select private.assert_rls_enabled();
