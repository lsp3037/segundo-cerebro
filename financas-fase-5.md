# Plano de Implementação — Módulo de Finanças (Fase 5)
> **Projeto:** Segundo Cérebro • Luan (Cuiabá-MT)  
> **Slug do Plano:** `financas-fase-5`  
> **Modo de Orquestração:** Planejamento Concluído (Aguardando Aprovação)  
> **Diretrizes de Design Integradas:** `/impeccable` + `/ui-ux-pro-max` + `/oil-ui` + `/design-taste-frontend`  
> **Data:** 2026-11-05

---

## 1. Visão Geral e Objetivos do Produto

O módulo de **Finanças** centraliza e organiza o fluxo financeiro das duas frentes econômicas do Luan, sem atrito e com precisão cirúrgica:

1. **Finanças Pessoais (`pessoal`)**:
   - Controle simplificado de entradas (salário SES-MT, bolsa/mestrado, rendimentos) e saídas (custos fixos, rotina, compras).
   - Categorias personalizadas e métodos de pagamento (PIX, Crédito, Débito, Boleto, Dinheiro).
2. **Finanças da Trust Care (`trustcare`)**:
   - Receitas de serviços técnicos e manutenções de computadores.
   - Despesas operacionais e custos com peças/insumos (pastas térmicas, conectores, ferramentas).
   - **Revenda de Notebooks (Lucro por Equipamento)**: Rastreamento individual do lucro de cada notebook comprado, recuperado na bancada e revendido (Compra + Peças/Reparo vs. Venda).
3. **Resumo Mensal Consolidado (Dashboard Executivo)**:
   - Indicadores-chave: Total de Entradas, Total de Saídas, Saldo Líquido e Margem Operacional.
   - Visão segregada ou unificada (*Pessoal*, *Trust Care* ou *Visão Geral*).
   - Gráfico de tendência mensal e distribuição por categoria.

---

## 2. Princípios e Restrições Não Negociáveis

| Princípio | Regra de Implementação |
|---|---|
| **Segurança e Privacidade da IA** | A área de Finanças nasce com **`ai_enabled = false`**. Nenhum dado financeiro ou de transação é enviado para provedores de IA. Validação estrita por `assertAreaAllowsAi`. |
| **Dinheiro em Centavos** | Todo valor monetário é armazenado como número inteiro em centavos (`amount_cents bigint`). R$ 150,50 vira `15050`. Funções de formatação e parsing em `lib/money.ts`. |
| **Horário de Cuiabá** | Todas as datas seguem o fuso oficial de Cuiabá (UTC-4) via `lib/dates.ts`. |
| **RLS Estrito** | Toda tabela possui Row Level Security ativo com `private.apply_owner_policy('public.tabela')` e verificação final `private.assert_rls_enabled()`. |
| **Lixeira Segura** | Transações e notebooks excluídos utilizam `deleted_at timestamptz` (soft delete), permitindo restauração sem perda acidental. |

---

## 3. Diretrizes de Design & Usabilidade Integradas

As 4 metodologias de design exigidas foram sintetizadas para este painel:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DIRETRIZES DE DESIGN SYSTEM                          │
├────────────────────┬───────────────────────────────────────────────────┤
│ 🎯 /impeccable     │ Modo OPERATE: Restrição, clareza scan-first, sem  │
│                    │ ornamentos vazios. Teclas de atalho para input.   │
├────────────────────┼───────────────────────────────────────────────────┤
│ 💎 /ui-ux-pro-max  │ Paleta fintech sólida: verde esmeralda (entradas),│
│                    │ cinza ardósia e carmesim discreto (saídas).       │
│                    │ Contrastes WCAG AAA e tipografia tabular alinhada.│
├────────────────────┼───────────────────────────────────────────────────┤
│ 🧼 /oil-ui         │ Fim do "ruído de caixilhos": ausência de caixas   │
│                    │ duplicadas. 2-3 linhas âncora de alinhamento.     │
│                    │ Empty states com botões de ação integrados.       │
├────────────────────┼───────────────────────────────────────────────────┤
│ ⚡ /design-taste   │ Padrão App-Screen: bordas sutis, tipografia       │
│                    │ expressiva nos saldos, tabelas densas e respiráveis│
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 4. Matriz de Agentes e Orquestração

| Etapa | Foco | Agentes Responsáveis | Skills Ativas |
|:---:|---|---|---|
| **Etapa 1** | Arquitetura de Dados & Seeds | `database-architect`, `security-auditor` | `@database-design`, `@vulnerability-scanner` |
| **Etapa 2** | Camada Backend (Actions & Queries) | `backend-specialist` | `@api-patterns`, `@clean-code` |
| **Etapa 3** | Interface do Dashboard & Transações | `frontend-specialist` | `@impeccable`, `@ui-ux-pro-max`, `@oil-ui` |
| **Etapa 4** | Revenda de Notebooks & Lucro Unitário | `frontend-specialist`, `backend-specialist` | `@design-taste-frontend`, `@clean-code` |
| **Etapa 5** | Auditoria de Segurança, Testes & Polish | `test-engineer`, `security-auditor` | `@code-review-checklist`, `@lint-and-validate` |

---

## 5. Estrutura Técnica e Arquivos

### 5.1 Banco de Dados (Supabase)
As tabelas já existem no schema (`supabase/migrations/20261031224329_modules.sql`):
- `public.finance_categories` (id, user_id, ledger, kind, name, color, sort_order)
- `public.payment_methods` (id, user_id, name, type, active)
- `public.notebooks` (id, user_id, brand, model, specs, status, notes)
- `public.transactions` (id, user_id, ledger, kind, amount_cents, date, category_id, payment_method_id, description, notebook_id)
- `public.notebook_profit` (view com faturamento, custo e lucro calculado)

*Ação necessária na Etapa 1:* Migration de seed com categorias essenciais padrão (Alimentação, Moradia, Salário, Peças, Serviços, etc.) e formas de pagamento (PIX, Cartão, Dinheiro).

### 5.2 Backend (`lib/`)
- `lib/money.ts`: Utilitários de conversão BRL ↔ centavos com máscara segura de digitação.
- `lib/data/finance.ts`: Leituras otimizadas com agregações de saldo, lista de lançamentos paginados/filtrados e resumo de notebooks.
- `lib/actions/finance.ts`: Server Actions com validação Zod para criar/editar/excluir transações, categorias e notebooks.

### 5.3 Frontend (`components/finance/` e `app/`)
- `app/(app)/financas/page.tsx`: Substituição do `TabPage` placeholder pela interface completa do painel financeiro.
- `components/finance/finance-dashboard.tsx`: Orquestrador principal da tela com seletor de ledger (*Visão Geral*, *Pessoal*, *Trust Care*) e mês/ano.
- `components/finance/metrics-cards.tsx`: 4 cards no estilo Stripe/Linear (Entradas, Saídas, Saldo Líquido e Margem).
- `components/finance/transactions-table.tsx`: Tabela de transações com busca, filtro de categoria/tipo, ordenação e ações rápidas.
- `components/finance/transaction-dialog.tsx`: Diálogo para lançamento rápido de entrada/saída com formatação automática de centavos.
- `components/finance/notebooks-tracker.tsx`: Tabela/cards de notebooks da Trust Care mostrando Preço de Compra + Custos de Reparo vs. Venda e Lucro líquido em tempo real.
- `components/finance/monthly-chart.tsx`: Gráfico sóbrio em barras/linhas para visualização do fluxo de caixa mês a mês.

---

## 6. Etapas Detalhadas e Prazos

### 🔹 ETAPA 1: Fundação de Dados e Categorias Iniciais
- **Duração estimada:** 1 dia (Ciclo 1)
- **Agentes:** `database-architect`, `security-auditor`
- **Tarefas:**
  1. Criar migration `supabase/migrations/20261105160000_finance_seed.sql` com categorias padrão para Pessoal e Trust Care, além dos métodos de pagamento.
  2. Adicionar índices otimizados para consultas de relatórios mensais.
  3. Regenerar tipos TypeScript em `lib/supabase/database.types.ts`.
  4. Auditar políticas RLS para garantir isolamento por `user_id`.

### 🔹 ETAPA 2: Camada de Negócio e Validações Seguras
- **Duração estimada:** 1 dia (Ciclo 2)
- **Agentes:** `backend-specialist`
- **Tarefas:**
  1. Criar `lib/money.ts` com funções `centsToBrl(cents)`, `brlToCents(str)` e formatações matemáticas.
  2. Implementar `lib/data/finance.ts` com funções `getFinanceSummary()`, `getTransactions()`, `getNotebooksProfit()`, `getFinanceCategories()`.
  3. Implementar Server Actions em `lib/actions/finance.ts`:
     - `createTransaction`, `updateTransaction`, `trashTransaction`
     - `createNotebook`, `updateNotebook`, `trashNotebook`
     - `createCategory`, `updateCategory`
  4. Validar que nenhuma rota financeira possui brecha para IA (`ai_enabled = false`).

### 🔹 ETAPA 3: Interface do Dashboard e Lançamentos
- **Duração estimada:** 1 a 2 dias (Ciclo 3)
- **Agentes:** `frontend-specialist` (com `@impeccable`, `@ui-ux-pro-max`, `@oil-ui`)
- **Tarefas:**
  1. Construir `components/finance/finance-dashboard.tsx` com alternador entre *Pessoal*, *Trust Care* e *Todos*.
  2. Implementar `metrics-cards.tsx` com cards de Saldo, Entradas e Saídas com micro-gráficos ou indicadores visuais.
  3. Criar `transactions-table.tsx` com paginação, filtro de período e status de pagamento.
  4. Desenvolver `transaction-dialog.tsx` com foco rápido, atalho de teclado e digitação natural de valores.
  5. Adicionar empty states acolhedores com CTA primário "Novo lançamento".

### 🔹 ETAPA 4: Módulo de Revenda de Notebooks (Trust Care)
- **Duração estimada:** 1 dia (Ciclo 4)
- **Agentes:** `frontend-specialist`, `backend-specialist` (com `@design-taste-frontend`)
- **Tarefas:**
  1. Desenvolver `notebooks-tracker.tsx` dedicado à compra e revenda de notebooks da Trust Care.
  2. Card de cada notebook mostrando status (*Comprado*, *Em Reparo/Upgrade*, *À Venda*, *Vendido*).
  3. Cálculo automático: ao lançar uma transação de peça vinculada ao notebook (ex: SSD ou bateria), o custo é somado automaticamente ao equipamento.
  4. Cálculo do lucro real no momento da venda.

### 🔹 ETAPA 5: Auditoria, Testes e Verificação de Qualidade
- **Duração estimada:** 1 dia (Ciclo 5)
- **Agentes:** `test-engineer`, `security-auditor`
- **Tarefas:**
  1. Executar testes de compilação rigorosos com `npx tsc --noEmit`.
  2. Validar cálculos de centavos (evitando erros de ponto flutuante).
  3. Verificar comportamento responsivo em telas desktop, tablet e mobile.
  4. Commit semântico e documentação no `AI Brain/`.

---

## 7. Critérios de Aceite (Definição de Pronto)

1. [ ] O Luan consegue alternar instantaneamente entre finanças Pessoais e da Trust Care.
2. [ ] É possível cadastrar uma entrada ou saída em menos de 10 segundos, com valores formatados em R$.
3. [ ] Os notebooks comprados para revenda exibem o custo acumulado de peças e o lucro líquido real obtido na venda.
4. [ ] O dashboard mensal exibe o saldo do mês com clareza visual e sem excesso de caixas.
5. [ ] Nenhum dado financeiro vaza para a IA (`ai_enabled` permanece travado).
6. [ ] TypeScript compila com 0 erros e o app roda liso na porta 3333.
