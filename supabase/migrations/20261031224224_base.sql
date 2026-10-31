-- Fundação: extensões, funções utilitárias, schema privado, áreas, pastas e perfil.
-- Convenção: toda tabela do schema public tem user_id (dono) e RLS "só o dono".

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

-- Schema "private": não é exposto pela API, só o banco e o servidor usam.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Novas tabelas do public não ficam liberadas automaticamente para o navegador.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- unaccent não é "imutável", e colunas geradas exigem isso: este invólucro resolve.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Garante que nenhuma tabela do public fique sem RLS. Chamada no fim de cada migration.
create or replace function private.assert_rls_enabled()
returns void
language plpgsql
set search_path = ''
as $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ')
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity;

  if missing is not null then
    raise exception 'Tabelas sem RLS: %', missing;
  end if;
end;
$$;

-- Aplica o pacote padrão a uma tabela: RLS "só o dono", grants, índice em user_id
-- e gatilho de updated_at (se a coluna existir).
create or replace function private.apply_owner_policy(tbl regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  tname text := (select relname from pg_class where oid = tbl);
begin
  execute format('alter table %s enable row level security', tbl);
  execute format('revoke all on %s from anon', tbl);
  execute format('grant select, insert, update, delete on %s to authenticated', tbl);
  execute format(
    'create policy "dono acessa" on %s for all to authenticated '
    'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
    tbl
  );
  if not exists (
    select 1
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = tbl and a.attname = 'user_id'
  ) then
    execute format('create index %I on %s (user_id)', tname || '_user_id_idx', tbl);
  end if;

  if exists (
    select 1 from pg_attribute
     where attrelid = tbl and attname = 'updated_at' and not attisdropped
  ) then
    execute format(
      'create trigger set_updated_at before update on %s '
      'for each row execute function private.set_updated_at()',
      tbl
    );
  end if;
end;
$$;

-- Cria índices para todas as chaves estrangeiras de uma coluna só que ainda não têm índice.
create or replace function private.index_foreign_keys()
returns void
language plpgsql
set search_path = ''
as $$
declare
  fk record;
begin
  for fk in
    select con.conrelid::regclass as tbl,
           cls.relname as tname,
           att.attname as col
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace n on n.oid = cls.relnamespace
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     where con.contype = 'f'
       and n.nspname = 'public'
       and array_length(con.conkey, 1) = 1
       and not exists (
         select 1 from pg_index i
          where i.indrelid = con.conrelid and i.indkey[0] = con.conkey[1]
       )
  loop
    execute format('create index if not exists %I on %s (%I)', fk.tname || '_' || fk.col || '_idx', fk.tbl, fk.col);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil, áreas e pastas
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Cuiaba',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 1 and 60),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text,
  sort_order int not null default 0,
  collapsed boolean not null default false,
  -- Trava de IA: quando false, nada desta área é enviado ao provedor de IA.
  ai_enabled boolean not null default true,
  show_lgpd_notice boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  module text not null check (module in (
    'tasks', 'notes', 'meetings', 'routine', 'learning', 'ideas',
    'shortcuts', 'content_ideas', 'publications', 'service_flows',
    'reply_assistant', 'finance'
  )),
  icon text,
  -- Configuração própria do módulo, ex.: {"ledger": "pessoal"} nas pastas de Finanças.
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (parent_id is distinct from id)
);

select private.apply_owner_policy('public.profiles');
select private.apply_owner_policy('public.areas');
select private.apply_owner_policy('public.folders');

create index folders_tree_idx on public.folders (area_id, parent_id, sort_order) where deleted_at is null;
