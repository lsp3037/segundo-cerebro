-- Ícone escolhido para cada categoria de Finanças (Lançamentos, Orçamento, Importação).
-- A coluna guarda a chave do ícone (ex.: "zap", "house"); a lista de chaves válidas é
-- validada no app (lib/finance/category-icons.ts). Vazio = o app deduz pelo nome da categoria.
alter table public.finance_categories
  add column if not exists icon text;

comment on column public.finance_categories.icon is
  'Chave do ícone da categoria (lista curada no app). Nulo = ícone deduzido pelo nome.';

-- RLS já está ativa nesta tabela; só confirma.
select private.assert_rls_enabled();
