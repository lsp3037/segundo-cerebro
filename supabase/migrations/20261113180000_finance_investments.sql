-- Investimentos das Finanças (Pessoal): Cofrinho do Mercado Pago e parecidos
-- 1. Investimentos e o histórico de taxas (finance_investments)
-- 2. Movimentos: guardei, resgatei e acerto com o app (finance_investment_movements)
-- 3. Cópia local do CDI diário do Banco Central, série SGS 12 (finance_cdi_daily)
-- O rendimento não é gravado: é calculado dia a dia a partir dos movimentos, das taxas e do CDI.

-- 1. Investimentos
-- rate_changes: taxas em ordem de data; a de mesma data substitui a anterior.
--   CDI em faixas: {"from":"2026-11-13","mode":"cdi","tiers":[{"up_to_cents":1000000,"of_cdi_percent":120},{"up_to_cents":null,"of_cdi_percent":100}]}
--                  (faixas em ordem crescente; up_to_cents null = sem teto, só na última)
--   Taxa fixa:     {"from":"2026-11-13","mode":"annual","annual_percent":10}
--   Percentuais em decimal (120 = 120%), não em basis points. O formato é validado no zod.
create table if not exists public.finance_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  owner_label text,
  rate_changes jsonb not null default '[]'::jsonb check (jsonb_typeof(rate_changes) = 'array'),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Movimentos (aporte e resgate sempre positivos; o ajuste tem sinal e não pode ser zero)
create table if not exists public.finance_investment_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investment_id uuid not null references public.finance_investments (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'withdrawal', 'adjustment')),
  date date not null,
  amount_cents bigint not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint finance_investment_movements_amount_sign_check check (
    (kind = 'adjustment' and amount_cents <> 0)
    or (kind in ('deposit', 'withdrawal') and amount_cents > 0)
  )
);

-- A simulação lê os movimentos ativos de um investimento em ordem de data.
-- Como começa por investment_id, private.index_foreign_keys() não cria outro índice para a chave.
create index if not exists finance_investment_movements_investment_date_idx
  on public.finance_investment_movements (investment_id, date)
  where deleted_at is null;

-- 3. CDI diário (percentual ao dia, ex.: 0.05078800 = 0,050788% ao dia).
-- Tem user_id para seguir a regra de RLS do projeto: cada usuário guarda a sua cópia.
-- Sem updated_at: o upsert deve enviar fetched_at para registrar a nova busca.
create table if not exists public.finance_cdi_daily (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  daily_percent numeric(12, 8) not null check (daily_percent >= 0),
  fetched_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- 4. RLS e validações de segurança
select private.apply_owner_policy('public.finance_investments');
select private.apply_owner_policy('public.finance_investment_movements');
select private.apply_owner_policy('public.finance_cdi_daily');

select private.index_foreign_keys();
select private.assert_rls_enabled();
