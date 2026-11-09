-- Fase 5: Finanças e Controle de Notebooks da Trust Care
-- 1. Campos estruturados para notebooks de revenda (vitrine, venda, comprador e garantia)
-- 2. Anti-duplicação de extrato bancário (bank_fitid) em transactions
-- 3. Tabela de regras de auto-categorização de extrato bancário (finance_rules)

-- 1. Enriquecimento da tabela de notebooks de revenda
alter table public.notebooks
  add column if not exists asking_price_cents bigint check (asking_price_cents >= 0),
  add column if not exists buyer_name text,
  add column if not exists buyer_contact text,
  add column if not exists warranty_days int not null default 90 check (warranty_days >= 0),
  add column if not exists sold_at date,
  add column if not exists machine_fee_cents bigint not null default 0 check (machine_fee_cents >= 0);

create index if not exists notebooks_status_sold_idx
  on public.notebooks (user_id, status, sold_at)
  where deleted_at is null;

-- 2. Identificador único do banco (FITID do OFX) para idempotência e anti-duplicação
alter table public.transactions
  add column if not exists bank_fitid text;

create unique index if not exists transactions_user_bank_fitid_idx
  on public.transactions (user_id, bank_fitid)
  where bank_fitid is not null and deleted_at is null;

-- 3. Regras de auto-categorização do extrato bancário
create table if not exists public.finance_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern text not null,
  category_id uuid references public.finance_categories (id) on delete cascade,
  ledger text not null check (ledger in ('pessoal', 'trustcare')),
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_rules_user_pattern_ledger_idx
  on public.finance_rules (user_id, lower(pattern), ledger);

-- 4. RLS e validações de segurança
select private.apply_owner_policy('public.finance_rules');

select private.index_foreign_keys();
select private.assert_rls_enabled();
