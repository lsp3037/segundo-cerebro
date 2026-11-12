# Plano: Finanças Pessoal e Familiar ("Minhas Finanças" no Segundo Cérebro)

**Status:** Fase 1 (Design Visual e Calibração `T0` concluídos — aguardando aprovação para Fase 2)  
**Tipo de Projeto:** WEB (`Next.js 16.4.3` + `React 19` + `Supabase Postgres` + `Tailwind CSS v4` + `shadcn/ui`)  
**Escopo:** Evoluir o ledger `pessoal` do módulo `/financas` (e alertas em `/hoje`) para gestão financeira pessoal e familiar completa inspirada no App *Minhas Finanças* e calibrada pela planilha real da casa (`Entradas - Saídas = Saldo`, membros `Casa`, `Luan`, `Rayzza`, Dízimo automático `10%`, 4 cartões com dia fixo e controle Pago vs. Pendente), mantendo `trustcare` e Notebooks isolados.

---

## 0. Calibração `T0` (Planilha Real Luan & Rayzza)

Mapeado da planilha enviada:
- **Entradas:** `Salário Luan`, `Bolsa Residência`, `Trust Care`, `HSH` (total referência: `R$ 19.737,43`).
- **Regra Automática de Dízimo:** `10%` calculado dinamicamente sobre a soma das Entradas do mês (`R$ 1.973,74`), ficando `Pendente` até a baixa em 1 clique.
- **Membros / Centros de Custo (`member_label`):** `Casa` (Aluguel Solar das Flores, Energia Solar das Flores, Internet, UNIMED, Supermercado, Dízimo), `Luan` (Cartões Santander/Nubank/Bradesco, Celular Luan, Combustível Luan, Almoço Luan) e `Rayzza` (Cartão Rayzza, Celular Rayzza, Combustível Rayzza).
- **Status Visual (Verde vs. Branco na planilha):** `Pago` vs. `Pendente` (`Atrasado` derivado em Cuiabá time quando `due_date < hoje` e `status = 'pending'`).
- **4 Cartões Recorrentes:** Bradesco (venc. dia `1`), Santander (venc. dia `5`), Rayzza (venc. dia `16`), Nubank (venc. dia `17`).

---

## 1. Critérios de Sucesso

1. **Contas, Saldo Real e Faturas Separadas:** O saldo bancário real (Conta Corrente, Dinheiro, Reserva) nunca se mistura com limite de Cartão de Crédito nem é distorcido por transferências internas ou pagamento de fatura.
2. **Previsibilidade e Zero Atrasos:** Toda conta fixa ou parcelada (`1/12` .. `12/12`) possui `due_date`, `status` (`paid` | `pending` | `overdue`) e gera alertas visuais automáticos em `/financas` e `/hoje` (Vencidas, Hoje, Próximos 7 dias), com baixa/pagamento em 1 clique.
3. **Orçamento Familiar (Metas):** Cada categoria pessoal tem teto mensal opcional com barra de progresso (`% consumido`), alerta amarelo (>= 80%) e vermelho (> 100%).
4. **KPIs e Comparativos entre Períodos:** Cálculo automático de Taxa de Poupança, Comprometimento Fixo vs. Variável, Burn Rate diário/mensal, Saldo Projetado do Mês e comparativos MoM (Mês atual vs. Mês anterior), Média 3M/6M e evolução anual.
5. **Aderência à Planilha da Casa:** Mapeamento direto das colunas, categorias, membros/centros de custo e regras usadas hoje na planilha familiar do Luan (a ser calibrado assim que o exemplo for enviado) + importação de planilha/CSV/OFX sem duplicidade.
6. **Privacidade e Segurança (AGENTS.md):** Todas as novas tabelas com RLS (`private.apply_owner_policy` + `private.assert_rls_enabled()`), datas no fuso `America/Cuiaba`, valores em centavos (`bigint`), e `ai_enabled = false` preservado para Finanças.

---

## 2. Stack e Decisões de Arquitetura

- **Frontend / UI:** Next.js App Router (`app/(app)/financas/page.tsx`), Server Components para carga inicial, Client Components modulados em `components/finance/`, gráficos SVG/CSS responsivos seguindo o padrão atual (`monthly-chart.tsx`) sem dependências pesadas desnecessárias.
- **Backend / Persistência:** Supabase Postgres via Server Actions (`lib/actions/finance.ts`, `lib/actions/finance-accounts.ts`), leitura agregada em `lib/data/finance*.ts`, validação Zod, tipos regenerados em `lib/supabase/database.types.ts`.
- **Regras de Domínio Críticas:**
  - `kind`: `'income' | 'expense' | 'transfer'` (transferência entre contas e pagamento de fatura não entram como receita nem despesa nos relatórios de resultado/KPI).
  - `status`: `'paid' | 'pending'` (`overdue` é derivado em runtime comparando `due_date < todayIso()` em Cuiabá).
  - `nature` (ou flag na categoria): `'fixed' | 'variable'` para KPI de comprometimento fixo da casa.
  - `member_label` (opcional em `transactions`): identificação de quem realizou/assumiu o gasto na casa (ex.: Luan, Esposa, Casa), se confirmado na planilha do Luan.

---

## 3. Estrutura de Arquivos (Planejada)

```text
supabase/migrations/
  └── 20261113000000_finance_family_minhas_financas.sql   # Contas, cartões/faturas, orçamentos, vencimentos e parcelas

lib/
  ├── supabase/database.types.ts                          # Tipos atualizados pós-migração
  ├── finance/
  │   ├── kpis.ts                                         # Funções puras: Poupança, Burn Rate, Projetado, MoM, Fixo vs Variável
  │   ├── installments.ts                                 # Geração de parcelas (1/N..N/N) e recorrências mensais
  │   └── spreadsheet-mapper.ts                           # Adaptador para importar/conciliar planilha da casa (após exemplo do Luan)
  ├── data/
  │   ├── finance.ts                                      # Estendido com filtro de status, contas, faturas e vencimentos
  │   └── finance-reports.ts                              # Agregações: comparativos MoM, 3M/6M/12M, Orçado vs Realizado
  └── actions/
      ├── finance.ts                                      # Baixa rápida (marcar como pago), parcelas, recorrência e transferências
      ├── finance-accounts.ts                             # CRUD de contas bancárias, reserva e cartões de crédito
      └── finance-budgets.ts                              # CRUD de metas/orçamentos mensais por categoria

components/finance/
  ├── finance-dashboard.tsx                               # Shell com sub-abas: Visão Geral, Contas & Cartões, Orçamentos, Relatórios, Fluxo, Notebooks
  ├── due-alerts-banner.tsx                               # Alertas de vencimentos (Atrasados, Hoje, 7 dias) + botão "Pagar agora"
  ├── kpi-strip.tsx                                       # KPIs: Saldo em Contas, Saldo Projetado, Taxa de Poupança, Comprometimento Fixo
  ├── accounts-cards-view.tsx                             # Carteiras bancárias + Cartões de crédito (fatura aberta/fechada e limite)
  ├── budgets-view.tsx                                    # Orçado vs Realizado por categoria com semáforo e edição inline de meta
  ├── reports-comparisons-view.tsx                        # Comparativos Mês vs Anterior vs Média 3M/6M, Fixo vs Variável, Evolução 12M
  ├── upcoming-bills-list.tsx                             # Agenda de contas a pagar/receber com baixa em 1 clique
  └── transaction-dialog.tsx                              # Atualizado com Conta/Cartão, Vencimento, Status (Pago/Pendente), Parcelas e Recorrência

app/(app)/hoje/
  └── page.tsx                                            # Novo card lateral discreto "Contas da Semana" com vencimentos próximos
```

---

## 4. Plano de Tarefas (Fases e Agentes)

| # | Tarefa | Agente + Skill | INPUT → OUTPUT → VERIFY |
|---|---|---|---|
| **T0** | **Calibração com Planilha Familiar** *(Pré-Fase 2)* | `@orchestrator` + `@domain-modeling` | **INPUT:** Planilha atual da casa enviada pelo Luan → **OUTPUT:** Mapeamento de colunas, categorias, membros/tags e KPIs extras em `docs/PLANO.md` e `GLOSSARY.md` → **VERIFY:** Checklist 1:1 validado com Luan antes da migration. |
| **T1** | **Schema Postgres + RLS (Contas, Cartões, Metas, Vencimentos/Parcelas)** | `@database-architect` + `@database-design` | **INPUT:** `supabase/migrations/20261031224329_modules.sql` → **OUTPUT:** Nova migration com `finance_accounts`, `finance_budgets`, campos `account_id`, `transfer_account_id`, `due_date`, `paid_at`, `status`, `installment_group_id`, `installment_index`, `installment_total`, `recurrence_rule`, `member_label` em `transactions`, + `private.apply_owner_policy` e `private.assert_rls_enabled()` → **VERIFY:** Luan executa SQL no Supabase Dashboard sem erro; `database.types.ts` regenerado. |
| **T2** | **Motor Puro de KPIs, Parcelas e Recorrências** | `@backend-specialist` + `@tdd-workflow` | **INPUT:** Regras de negócio (Cuiabá time, centavos, exclusão de `transfer` em receitas/despesas) → **OUTPUT:** `lib/finance/kpis.ts` e `lib/finance/installments.ts` → **VERIFY:** Testes unitários via `node --experimental-strip-types` cobrindo faturas, parcelas em virada de ano, MoM % e saldo projetado. |
| **T3** | **Queries de Relatórios, Comparativos e Alertas** | `@backend-specialist` + `@clean-code` | **INPUT:** `lib/data/finance.ts` → **OUTPUT:** `lib/data/finance-reports.ts` + atualização de `getFinanceSummary` e `getUpcomingBills` → **VERIFY:** `npx tsc --noEmit` passa; queries respeitam filtro por ledger/conta/mês. |
| **T4** | **Server Actions (Contas, Cartões, Metas, Baixa em 1 Clique, Transferência)** | `@backend-specialist` + `@security-auditor` | **INPUT:** `lib/actions/finance.ts` → **OUTPUT:** `finance-accounts.ts`, `finance-budgets.ts`, `markTransactionPaid`, criação de compra parcelada e transferência dupla segura → **VERIFY:** Validação Zod + ownership/RLS + `npx tsc --noEmit`. |
| **T5** | **UI: Cockpit Pessoal, Alertas e Agenda de Vencimentos** | `@frontend-specialist` + `@oil-ui` | **INPUT:** Wireframes aprovados pelo Luan → **OUTPUT:** `due-alerts-banner.tsx`, `kpi-strip.tsx`, `upcoming-bills-list.tsx` e novo Card em `app/(app)/hoje/page.tsx` → **VERIFY:** Renderização em `localhost:3333/financas` e `/hoje` sem erros de hidratação. |
| **T6** | **UI: Contas, Cartões/Faturas, Orçamentos e Relatórios Comparativos** | `@frontend-specialist` + `@oil-ui` | **INPUT:** Dados de `T3`/`T4` → **OUTPUT:** `accounts-cards-view.tsx`, `budgets-view.tsx`, `reports-comparisons-view.tsx` + atualização do `transaction-dialog.tsx` e `finance-dashboard.tsx` → **VERIFY:** Fluxo completo em browser desktop (`1440x900`) e mobile (`390x844`). |
| **T7** | **Importador da Planilha da Casa (CSV/XLSX) + Docs** | `@backend-specialist` + `@frontend-specialist` | **INPUT:** Padrão da planilha de `T0` → **OUTPUT:** `spreadsheet-mapper.ts` + modal de importação com deduplicação → **VERIFY:** Importação de amostra da planilha bate centavo a centavo com os totais originais; `docs/PRD.md`, `docs/PLANO.md` e `docs/OPERACAO.md` atualizados. |

---

## 5. Phase X: Verificação Final

- [ ] `npx tsc --noEmit` (zero erros de TypeScript após edição final)
- [ ] Segurança & RLS: confirmar `select private.assert_rls_enabled();` na migration e nenhum vazamento de dados de Finanças para IA (`assertAreaAllowsAi`)
- [ ] Integridade financeira: transferências e pagamento de fatura não inflam Receitas/Despesas nos relatórios
- [ ] Conferência manual em `http://localhost:3333/financas` e `http://localhost:3333/hoje` após o servidor subir
- [ ] Commits atômicos por sub-etapa na branch da funcionalidade
