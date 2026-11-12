-- Finanças Pessoal & Familiar
-- 1. Contas bancárias, reserva e cartões de crédito (finance_accounts)
-- 2. Contas fixas da casa, modelo de cada mês (finance_recurring_bills)
-- 3. Metas mensais por categoria (finance_budgets)
-- 4. Status pago/pendente, vencimento, pessoa e parcelas em transactions

-- 1. Contas e cartões
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'cash', 'credit_card')),
  owner_label text,
  opening_balance_cents bigint not null default 0,
  credit_limit_cents bigint check (credit_limit_cents >= 0),
  due_day int check (due_day between 1 and 31),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Contas fixas (cada mês gera um lançamento pendente a partir delas)
create table if not exists public.finance_recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('income', 'expense')),
  description text not null,
  amount_mode text not null default 'fixed' check (amount_mode in ('fixed', 'percent_of_income')),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  percent_bp int check (percent_bp between 1 and 10000),
  due_day int check (due_day between 1 and 31),
  category_id uuid references public.finance_categories (id) on delete set null,
  account_id uuid references public.finance_accounts (id) on delete set null,
  member_label text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (amount_mode = 'fixed' or (percent_bp is not null and kind = 'expense'))
);

-- 3. Metas mensais por categoria (valem para todos os meses)
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- 4. Lançamentos: pago/pendente, vencimento, pessoa, conta e parcelas
alter table public.transactions
  add column if not exists status text not null default 'paid' check (status in ('paid', 'pending')),
  add column if not exists due_date date,
  add column if not exists paid_at date,
  add column if not exists account_id uuid references public.finance_accounts (id) on delete set null,
  add column if not exists member_label text,
  add column if not exists recurring_bill_id uuid references public.finance_recurring_bills (id) on delete set null,
  add column if not exists installment_group_id uuid,
  add column if not exists installment_index int,
  add column if not exists installment_total int;

alter table public.transactions
  drop constraint if exists transactions_installment_check;
alter table public.transactions
  add constraint transactions_installment_check check (
    (installment_group_id is null and installment_index is null and installment_total is null)
    or (installment_total between 2 and 120 and installment_index between 1 and installment_total)
  );

-- Uma conta fixa gera no máximo um lançamento por mês (inclusive se foi excluído,
-- para não ser recriado sozinho).
create unique index if not exists transactions_recurring_month_idx
  on public.transactions (recurring_bill_id, date_trunc('month', date::timestamp))
  where recurring_bill_id is not null;

create index if not exists transactions_pending_due_idx
  on public.transactions (user_id, due_date)
  where status = 'pending' and deleted_at is null;

-- 5. RLS e validações de segurança
select private.apply_owner_policy('public.finance_accounts');
select private.apply_owner_policy('public.finance_recurring_bills');
select private.apply_owner_policy('public.finance_budgets');

select private.index_foreign_keys();
select private.assert_rls_enabled();
