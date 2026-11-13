# Plano: aba Investimentos (Finanças › Pessoal)

Status: **revisão 2, aguardando aprovação do Luan** (nada foi alterado no código).
Elaborado em 2026-11-13 com `explorer-agent` (mapa do código) e `project-planner` (plano). A revisão 2 incorpora as respostas do Luan e o print das movimentações do Cofrinho.

## 0. O que mudou na revisão 2

- **Taxa em faixas:** 120% do CDI até R$ 10.000,00; 100% do CDI no que passar disso.
- **Só dias úteis** (confirmado pelo print: não há crédito em 7 e 8/11, sábado e domingo).
- **CDI automático do Banco Central.** O Luan não precisa saber o CDI. O app busca a taxa diária oficial (série pública 12 do Banco Central, sem enviar nenhum dado do Luan) e guarda uma cópia. Em 12/11/2026: **CDI de 13,65% ao ano, ou 0,050788% ao dia**.
- **Fórmula corrigida:** "% do CDI" vale sobre a **taxa do dia**, e não sobre a taxa do ano. 120% do CDI = 1,2 × 0,050788% = 0,0609456% ao dia.
- **Bruto:** o app mostra saldo e rendimentos antes do imposto. O imposto costuma ser descontado só no resgate, e o cálculo exato fica fora da v1.
- **Conferência com o print:** créditos de R$ 5,31 a R$ 5,33 por dia correspondem a um saldo de cerca de **R$ 8.713 a R$ 8.745** a 120% do CDI. Se o saldo do Cofrinho for próximo disso, a fórmula está certa.

## 1. Objetivo e o que o Luan vai ver

Uma nova aba **Investimentos**, dentro de Finanças › Pessoal, entre "Bancos e cartões" e "Análises". Ele cadastra o Cofrinho do Mercado Pago com quanto tem lá hoje. A taxa já vem pronta ("120% do CDI até R$ 10 mil, 100% no restante"), e o app busca o CDI sozinho. Todo dia útil o app calcula o rendimento, como o Mercado Pago faz. Ele vê o valor de hoje e quanto rendeu hoje, no mês e no total. Quando guarda ou tira dinheiro, registra "Guardei" ou "Resgatei". Se o número do app do Mercado Pago ficar diferente, usa "Acertar com o app".

**Achado:** o painel é montado em dois lugares, `app/(app)/financas/page.tsx` e `app/(app)/p/[folderId]/page.tsx` (caso `"finance"`). Os dois precisam carregar os dados de investimentos.

## 2. Decisões de produto

| Tema | Decisão |
|---|---|
| Taxa | Por faixas de saldo, em "% do CDI": padrão do Cofrinho = 120% até R$ 10.000,00 e 100% acima. Também aceita "taxa fixa ao ano" para outros investimentos. Faixas editáveis em "Mudar taxa". |
| CDI | Automático: série diária do Banco Central, guardada em tabela própria e atualizada ao abrir a aba (sem rotina agendada). Se a busca falhar, usa o último valor guardado e mostra "CDI de [data]". |
| Dias úteis | Só dias úteis. Um dia é útil se o Banco Central publicou CDI para ele. Para os dias ainda sem CDI publicado (hoje), vale segunda a sexta menos feriados nacionais. |
| Como o app credita | O Mercado Pago credita de madrugada, em cada dia útil, o rendimento do dia útil anterior (o crédito de segunda é o de sexta). "Rendeu hoje" no nosso app mostra esse crédito. |
| Bruto x líquido | Bruto, igual ao que o app mostra. Texto: "Valores antes do imposto, como no app do banco." |
| Escopo | Só Pessoal. Não aparece em Trust Care nem Consolidado e não soma nos totais do Resumo. |
| Aporte/resgate x lançamentos e bancos | Independentes. Não criam `transactions` e não mexem no saldo dos bancos (o rendimento como entrada inflaria a base do Dízimo; "Investimentos & Reserva" daria contagem dupla). Aviso curto na tela. |
| Filtro de pessoa | Cada investimento tem "Responsável" (`owner_label`). O filtro do topo vale aqui. |
| Taxa muda | Histórico com data de início; vale só dali em diante. Mudança do CDI é automática e não precisa de ação. |
| Primeiro crédito de um aporte | No primeiro dia útil depois do aporte. Constante única, a confirmar com um aporte real (etapa 6). |
| Data futura | Não aceita na v1. |

## 3. Modelo de dados

Migration: `supabase/migrations/20261113180000_finance_investments.sql` (maior que `20261113120000`).

**`public.finance_investments`**
- `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`
- `name text not null` (1 a 100), `owner_label text` (validado no zod)
- `rate_changes jsonb not null default '[]'`, `check (jsonb_typeof(rate_changes) = 'array')`
  - CDI em faixas: `{"from":"2026-11-13","mode":"cdi","tiers":[{"up_to_cents":1000000,"of_cdi_percent":120},{"up_to_cents":null,"of_cdi_percent":100}]}`. `null` = sem teto. As faixas são em ordem crescente e a última não tem teto.
  - Fixa: `{"from":"...","mode":"annual","annual_percent":10}`
  - Percentuais em decimal, não basis points.
- `notes text`, `sort_order int not null default 0`, `created_at`, `updated_at`, `deleted_at`

**`public.finance_investment_movements`**
- `id`, `user_id`, `investment_id uuid not null references finance_investments(id) on delete cascade`
- `kind text not null check (kind in ('deposit','withdrawal','adjustment'))`, `date date not null`, `amount_cents bigint not null`, `note text`, `created_at`, `updated_at`, `deleted_at`
- `check ((kind = 'adjustment' and amount_cents <> 0) or (kind in ('deposit','withdrawal') and amount_cents > 0))`
- Índice parcial em `(investment_id, date) where deleted_at is null`

**`public.finance_cdi_daily`** (cópia local da série do Banco Central)
- `user_id uuid not null default auth.uid() ...`, `date date not null`, `daily_percent numeric(12,8) not null check (daily_percent >= 0)`, `fetched_at timestamptz not null default now()`
- `primary key (user_id, date)`. Tem `user_id` para seguir a regra de RLS do projeto; cada usuário guarda sua cópia.

**Fechamento:** `apply_owner_policy` nas três tabelas, `private.index_foreign_keys()`, `private.assert_rls_enabled()`. Depois, regenerar `lib/supabase/database.types.ts`.

## 4. Regra de cálculo do rendimento

**Taxa de um dia útil `d`** (dia em que o crédito aparece no app):
- `ref(d)` = dia útil anterior a `d`; `c` = CDI diário de `ref(d)` em fração (0,050788% → 0,00050788). Se `ref(d)` ainda não foi publicado, usa o último CDI guardado.
- Modo CDI em faixas, com saldo `B` no começo de `d`:
  `y_d = Σ faixas [ parte de B dentro da faixa × (of_cdi_percent / 100) × c ]`
  Ex.: com B = R$ 15.000, a primeira faixa pega R$ 10.000 a 120% e a segunda os R$ 5.000 restantes a 100%.
- Modo fixo: `y_d = B × ((1 + a/100)^(1/252) − 1)`.
- A faixa vigente é a última entrada de `rate_changes` com `from <= d` (ou a primeira, se `d` for anterior a todas).

**Simulação:** do primeiro movimento até hoje (Cuiabá), saldo `B` em centavos sem arredondar. Em cada dia `d`:
1. Se `d` é útil: `B = B + y_d`.
2. Depois aplica os movimentos de `d` (aportes antes de resgates; ajuste com sinal). Por isso um aporte começa a render no próximo dia útil.

**Arredondamento:** só na exibição (`Math.round` em centavos). Nunca acumular valores arredondados.
- Valor hoje = `round(B)`; rendeu hoje = `round(y_hoje)` (0 se hoje não é útil, com "Hoje não rende (fim de semana/feriado)").
- Rendimento do mês = soma dos `y_d` no mês até hoje, mais os ajustes do mês. Rendimento total = soma de todos os `y_d`, mais todos os ajustes.
- "Próximo crédito" ≈ `round(y)` do próximo dia útil com o saldo atual.
- Conferência: valor hoje = aportado − resgatado + rendimento total.

**Exemplos conferíveis** (CDI de 0,050788% ao dia; 120% → 0,0609456% ao dia)
1. R$ 1.000,00 → **R$ 0,61** por dia útil.
2. R$ 8.730,00 → **R$ 5,32** (bate com o print).
3. R$ 15.000,00 → R$ 6,09 (R$ 10.000 a 120%) + R$ 2,54 (R$ 5.000 a 100%) = **R$ 8,63**.
4. Aporte de R$ 1.000,00 na sexta 13/11/2026. Sábado 14 e domingo 15 não rendem. Créditos: 16/11 R$ 0,61; 17, 18 e 19/11 ≈ R$ 0,61 cada. Na quinta 19/11 o valor é **R$ 1.002,44**. A sexta 20/11 é feriado, sem crédito. Segunda 23/11: **R$ 1.003,05**. Variante: resgate de R$ 500,00 na quinta 19/11 → em 23/11 o valor é **R$ 502,75**, com rendimento total de R$ 2,75 (502,75 + 500 − 1000 = 2,75).

**Casos-limite:** aporte em fim de semana ou feriado começa no próximo dia útil. Saldo que cruza R$ 10 mil muda de faixa no mesmo dia. Resgate maior que o saldo da data é rejeitado ("Você só tem R$ X nesse dia"), e "Resgatar tudo" preenche o valor atual. Editar, excluir ou restaurar um movimento que deixe o saldo negativo em alguma data é bloqueado, com o dia indicado. Data futura é rejeitada (`todayIso()`). Mudança de taxa vale de `from` em diante, e a mesma data substitui a entrada anterior. Na virada do mês, o rendimento do mês soma só os dias dentro dele. Investimento sem movimento vale zero. Se o Banco Central estiver fora do ar, o cálculo usa o último CDI guardado e a tela avisa a data.

## 5. Camada de código

Padrões: `getCurrentUser`, zod `safeParse`, `.eq("user_id")`, `fail("... PT-BR")`, `revalidatePath("/", "layout")`, `ok(data)`.

**Novos**
- `lib/finance/business-days.ts` (puro): `brazilHolidays(year)`, `isBusinessDay(iso)`, `previousBusinessDay(iso)`, `nextBusinessDay(iso)`. Só vale para os dias sem CDI publicado.
- `lib/finance/investments.ts` (puro): `RateEntry`/`parseRateChanges`, `COFRINHO_DEFAULT_TIERS`, `tieredDailyYield(balance, tiers, cdiDaily)`, `simulateInvestment({ movements, rates, cdiByDate, asOf, month })`, `firstOverdrawnDate(...)`.
- `lib/data/finance-cdi.ts` (`server-only`): `getCdiSeries(fromIso)`. Lê `finance_cdi_daily`; se faltar algum dia útil até ontem, busca no Banco Central (`api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=...&dataFinal=...`), com tempo limite curto, e grava com upsert. Em caso de falha, devolve o que tem e `stale: true`. A requisição é um GET público só com datas. Nenhum dado do Luan sai, e nada vai para IA.
- `lib/data/finance-investments.ts` (`server-only`): `getInvestmentsData({ member, month })` devolve `{ investments, totals, cdi: { lastDate, annualPercent, stale }, error? }`. Em erro devolve `error: true` sem quebrar a página.
- `lib/actions/finance-investments.ts` (`"use server"`, **só exportar funções assíncronas**): `saveInvestment` (cria também o aporte inicial), `deleteInvestment`, `saveInvestmentMovement`, `deleteInvestmentMovement` (validam o saldo), `saveInvestmentRate`, `deleteInvestmentRate`, `reconcileInvestment`.
- `components/finance/investments-view.tsx` (client) e, se crescer, `investment-dialog.tsx` e `investment-movement-dialog.tsx`.

**Alterados:** `lib/actions/finance-restore.ts` (kinds `investment` e `investment_movement`; restaurar um movimento revalida o saldo), `components/finance/meta.ts` (aba em `LEDGER_TABS.pessoal`, entre `contas` e `relatorios`), `components/finance/finance-dashboard.tsx` (prop `investmentsData`, bloco da aba, botão "Novo investimento"), as duas páginas (carregar só quando `tab=investimentos` e o ledger for `pessoal`) e `database.types.ts`. Antes de codar, ler os guias em `node_modules/next/dist/docs/`: server actions, `searchParams` assíncrono e `fetch` com cache e escrita durante a renderização.

## 6. UI da aba

Nada abaixo de 12px, sem rótulos em maiúsculas e sem siglas além de "CDI" (explicado como "taxa de referência dos bancos"). Cartões locais no padrão `rounded-lg border bg-card p-4`, com `AnimatedBrl`.

- **Topo:** "Valor hoje" com "Você colocou R$ X no total"; os cartões "Rendeu hoje", "Rendimento em [mês]" e "Rendimento total"; a linha "CDI de hoje: 13,65% ao ano (Banco Central, [data])"; os avisos "Valores antes do imposto, como no app do banco." e "Guardar e resgatar aqui não mexe nos lançamentos nem no saldo dos bancos."
- **Cartão do investimento:** nome, responsável, taxa ("120% do CDI até R$ 10.000, 100% acima"), valor hoje, "Rendeu hoje: +R$ 5,32" ou "Hoje não rende (fim de semana/feriado)", "Próximo crédito: cerca de R$ 5,32", e o rendimento do mês e o total. Botões "Guardei" e "Resgatei", mais o menu "Mais" (Acertar com o app, Mudar taxa, Editar, Remover).
- **Histórico** recolhível: data, tipo (Guardou/Resgatou/Ajuste), valor e observação, com editar e excluir (com "Desfazer" por 10 s). Inclui o "Histórico de taxas".
- **Diálogos:** "Novo investimento" (nome, responsável, "Quanto você tem lá hoje?", "Desde que dia?", taxa já preenchida com o padrão do Cofrinho e editável); "Guardei/Resgatei" (com "Resgatar tudo"); "Acertar com o app" ("Nós estimamos R$ X, vou ajustar +R$ 0,12"); "Mudar taxa" (faixas e data de início).
- **Estados:** vazio (caixa tracejada com "Cadastrar investimento"), erro, filtro sem resultado e "CDI desatualizado".
- No celular, os botões quebram linha e cada item do histórico ocupa duas linhas.

## 7. Etapas

Commit em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Após cada etapa verificada: `npx tsc --noEmit`, conferir no navegador (porta 3333, sem `next build`) e `git push origin main`.

1. **Regras de cálculo, sem tela.** `business-days.ts` e `investments.ts`. Verificar com um script descartável fora do repositório contra os exemplos da seção 4 (R$ 0,61; R$ 5,32; R$ 8,63; R$ 1.002,44; R$ 1.003,05; R$ 502,75) e contra os feriados de 2026. Commit: `feat(investimentos): regras de calculo do rendimento por faixa do CDI`. Sem ação externa.
2. **Banco e tipos.** Migration com as três tabelas e `database.types.ts`. **Ação do Luan, uma só:** abrir o SQL Editor do Supabase do Segundo Cérebro, colar o arquivo e clicar em Run. É obrigatória antes de publicar a etapa 3. Commit: `feat(investimentos): tabelas de investimentos, movimentos e CDI com RLS`.
3. **CDI automático, aba, leitura e cadastro.** `finance-cdi.ts`, `getInvestmentsData`, `saveInvestment`/`deleteInvestment`, a restauração, a aba nas duas páginas e "Novo investimento".
   - Verificar: a linha do CDI mostra 13,65% ao ano.
   - Cadastrar "[teste] Cofrinho" com R$ 8.730,00: "Próximo crédito" deve dar cerca de R$ 5,32.
   - Trocar para Trust Care e voltar. Testar o filtro de pessoa. Remover e desfazer.
   - Abrir também via `/p/[folderId]` e no celular (390×844).
   - Simular o Banco Central fora do ar: deve aparecer o aviso de CDI desatualizado, sem erro na página.
   - Commit: `feat(investimentos): aba Investimentos com CDI automatico e cadastro`.
4. **Guardei, Resgatei e Acertar com o app.** Verificar o exemplo 4 com datas passadas, o resgate maior que o saldo, a exclusão que deixaria saldo negativo, "Resgatar tudo", o ajuste e o "Desfazer". Commit: `feat(investimentos): guardar, resgatar, acertar com o app e historico`.
5. **Mudar taxa e histórico de taxas.** Verificar que antes da data a taxa não muda e depois sim, que uma mudança na mesma data substitui a anterior, e que a remoção pode ser desfeita. Testar também um saldo acima de R$ 10 mil. Commit: `feat(investimentos): mudar a taxa e ver o historico`.
6. **Acabamento e docs.** Textos, celular e tamanho mínimo de 12px; docs da seção 9. Conferência real: cadastrar o Cofrinho com o saldo do dia, comparar o crédito do dia seguinte com o app do Mercado Pago e confirmar em que dia um aporte novo começa a render. Commit: `docs(investimentos): plano, operacao e produto`.

## 8. Riscos e fora da v1

**Riscos**
- A API do Banco Central pode ficar fora do ar ou mudar. Mitigação: cópia local, aviso de "CDI de [data]" e cálculo com o último valor.
- O Mercado Pago pode arredondar cada crédito diário. O print mostra pequenas variações (5,31 / 5,33 / 5,32). A diferença acumulada é de centavos e "Acertar com o app" corrige.
- O Mercado Pago pode mudar as faixas (por exemplo, o teto de R$ 10 mil). Isso se resolve em "Mudar taxa".
- Feriados estaduais e municipais não entram, mas só afetam o dia de hoje, porque o passado segue o CDI publicado.
- Publicar a etapa 3 antes da migration. Mitigação: a etapa 2 é obrigatória e o erro é tratado.
- `"use server"` deve exportar só funções, e há duas páginas montando o painel.

**Fora da v1:** imposto exato (tabela regressiva e IOF); outros tipos (CDB, Tesouro, ações, fundos); ligar aportes e resgates ao saldo dos bancos; gráfico e projeção; patrimônio no Resumo; avisos no sino; investimentos em Trust Care ou Consolidado; aporte agendado.

## 9. Docs a atualizar

- `docs/PLANO.md`: na §2.5, as três tabelas novas. Nova seção "16. Investimentos", com a regra de cálculo por faixa, o CDI do Banco Central, as decisões e a nota de que nada vai para IA.
- `docs/OPERACAO.md`: um bloco "Investimentos" nos testes, com a migration `20261113180000_finance_investments.sql` e os dados de teste com prefixo `[teste]`. Nos problemas, "Rendimento diferente do app do banco" → "Acertar com o app" ou "Mudar taxa", e "CDI desatualizado" → o Banco Central está fora do ar e o app usa o último valor.
- `docs/PRD.md`: §7.12 com o item "Investimentos"; §9 com a decisão de 2026-11-13; §10 com a pendência do imposto exato.
