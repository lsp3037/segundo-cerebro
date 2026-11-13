-- Recorrentes das Finanças: período de validade, reajuste de valor e meses pulados.
-- Em finance_recurring_bills (contas e entradas fixas):
--   start_month / end_month  mês em que começa e em que termina ("AAAA-MM"); vazio = sem limite
--   amount_changes           reajustes: [{"from":"2026-12","amount_cents":210000}, ...]
--   skipped_months           meses em que o item não vence (ex.: {"2026-12"})

alter table public.finance_recurring_bills
  add column if not exists start_month text check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  add column if not exists end_month text check (end_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  add column if not exists amount_changes jsonb not null default '[]'::jsonb,
  add column if not exists skipped_months text[] not null default '{}';

alter table public.finance_recurring_bills
  drop constraint if exists finance_recurring_bills_period_check;
alter table public.finance_recurring_bills
  add constraint finance_recurring_bills_period_check
  check (start_month is null or end_month is null or start_month <= end_month);

select private.assert_rls_enabled();
