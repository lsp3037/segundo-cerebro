"use client";

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ListChecksIcon,
} from "lucide-react";

import type { HouseholdData, HouseholdTransaction } from "@/lib/data/finance-family";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { FinanceHero, FinanceKpiStrip, signedResult } from "./finance-hierarchy";
import { PayCheck, usePayToggle } from "./pay-toggle";

interface HouseholdOverviewProps {
  data: HouseholdData;
  onGoToPendingFluxo: () => void;
  onGoToAllFluxo: () => void;
  onOpenRecurringDialog: () => void;
  onEditTransaction: (tx: HouseholdTransaction) => void;
}

export function HouseholdOverview({
  data,
  onGoToPendingFluxo,
  onGoToAllFluxo,
  onOpenRecurringDialog,
  onEditTransaction,
}: HouseholdOverviewProps) {
  const { isPaid, toggle } = usePayToggle();

  const expenses = data.transactions.filter((t) => t.kind === "expense");
  const incomes = data.transactions.filter((t) => t.kind === "income");
  const dueKey = (t: HouseholdTransaction) => t.due_date ?? t.date;
  // Pendentes ordenadas por vencimento: a primeira é de fato a próxima a vencer.
  const pendingExpenses = expenses
    .filter((t) => t.billStatus !== "paid")
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  const overdueCount = pendingExpenses.filter((t) => t.billStatus === "overdue").length;

  const creditCards = data.accounts.filter((a) => a.type === "credit_card");
  const cardsTotalCents = creditCards.reduce((acc, c) => acc + c.monthInvoiceCents, 0);
  const cardsPercent = data.kpis.expenseCents > 0 ? Math.round((cardsTotalCents / data.kpis.expenseCents) * 1000) / 10 : 0;

  // Ordena contas do mês: atrasadas/pendentes primeiro, depois maiores valores pagos
  const sortedBills = [...expenses].sort((a, b) => {
    const aPend = a.billStatus !== "paid" ? 0 : 1;
    const bPend = b.billStatus !== "paid" ? 0 : 1;
    if (aPend !== bPend) return aPend - bPend;
    return dueKey(a).localeCompare(dueKey(b));
  });

  return (
    <div className="space-y-5">
      {/* Faixa sutil de pendências no mês */}
      {pendingExpenses.length > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5 text-xs ${
            overdueCount > 0 ? "border-rose-500/40" : "border-amber-500/35"
          }`}
        >
          <div className="flex items-center gap-2.5 text-foreground">
            <AlertTriangleIcon
              className={`size-3.5 shrink-0 ${overdueCount > 0 ? "text-rose-400" : "text-amber-400"}`}
            />
            <span>
              <strong>
                {pendingExpenses.length}{" "}
                {pendingExpenses.length === 1 ? "conta pendente" : "contas pendentes"}
              </strong>{" "}
              {overdueCount > 0 && (
                <span className="text-rose-400">({overdueCount} atrasada{overdueCount > 1 ? "s" : ""}) </span>
              )}
              somando{" "}
              <strong className="tabular-nums text-amber-400">
                {formatCentsToBrl(data.kpis.pendingExpenseCents)}
              </strong>
              {pendingExpenses[0]?.due_date && (
                <span className="text-muted-foreground">
                  {" "}
                  · próxima: {pendingExpenses[0].description} ({pendingExpenses[0].due_date.slice(8)}/{pendingExpenses[0].due_date.slice(5, 7)})
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={onGoToPendingFluxo}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-foreground hover:underline"
          >
            Ver pendentes
            <ArrowRightIcon className="size-3" />
          </button>
        </div>
      )}

      {/* Onboarding rápido quando ainda não há contas fixas */}
      {data.recurringBills.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <span className="font-medium text-foreground">Planilha fixa da casa: </span>
              <span className="text-muted-foreground">
                carregue o modelo com entradas, cartões, contas fixas e Dízimo automático (10%).
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenRecurringDialog} className="h-7 text-xs">
            Configurar contas fixas
          </Button>
        </div>
      )}

      {/* Nível 1: Resposta principal do mês */}
      <FinanceHero
        eyebrow="Saldo projetado do mês"
        value={signedResult(data.kpis.projectedBalanceCents).value}
        tone={signedResult(data.kpis.projectedBalanceCents).tone}
        subtitle={
          <span className="tabular-nums">
            Entradas {formatCentsToBrl(data.kpis.incomeCents)} − Saídas {formatCentsToBrl(data.kpis.expenseCents)} · Poupança{" "}
            <strong className={data.kpis.savingsRatePercent >= 0 ? "font-medium text-emerald-400" : "font-medium text-rose-400"}>
              {data.kpis.savingsRatePercent}%
            </strong>{" "}
            · Comprometimento fixo {data.kpis.fixedCommitmentPercent}%
          </span>
        }
      />

      {/* Nível 2: Faixa dividida de KPIs */}
      <FinanceKpiStrip
        columns={3}
        items={[
          {
            id: "incomes",
            label: "Entradas",
            value: formatCentsToBrl(data.kpis.incomeCents),
            tone: data.kpis.incomeCents > 0 ? "positive" : "default",
            badge: (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {incomes.length} {incomes.length === 1 ? "fonte" : "fontes"}
              </span>
            ),
            subtext: (
              <span className="tabular-nums">
                Recebido {formatCentsToBrl(data.kpis.paidIncomeCents)} · Previsto {formatCentsToBrl(data.kpis.pendingIncomeCents)}
              </span>
            ),
          },
          {
            id: "expenses",
            label: "Saídas totais",
            value: formatCentsToBrl(data.kpis.expenseCents),
            tone: data.kpis.expenseCents > 0 ? "negative" : "default",
            badge: (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {expenses.length} {expenses.length === 1 ? "item" : "itens"}
              </span>
            ),
            subtext: (
              <span className="tabular-nums">
                Pago {formatCentsToBrl(data.kpis.paidExpenseCents)} · Falta{" "}
                <span className={data.kpis.pendingExpenseCents > 0 ? "text-amber-400" : ""}>
                  {formatCentsToBrl(data.kpis.pendingExpenseCents)}
                </span>
              </span>
            ),
          },
          {
            id: "cards",
            label: "Cartões de crédito",
            value: formatCentsToBrl(cardsTotalCents),
            badge: (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {creditCards.length} {creditCards.length === 1 ? "cartão" : "cartões"}
              </span>
            ),
            subtext: `${cardsPercent}% das saídas do mês`,
          },
        ]}
      />

      {/* Nível 3: Superfície operacional — Baixa Rápida + Entradas / Pessoa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Contas do mês &amp; baixa rápida</h3>
              <p className="text-xs text-muted-foreground">
                Atrasadas e pendentes primeiro, por vencimento
              </p>
            </div>
            {pendingExpenses.length > 0 && (
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-400">
                {pendingExpenses.length} {pendingExpenses.length === 1 ? "pendente" : "pendentes"}
              </span>
            )}
          </div>

          {sortedBills.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Nenhuma saída registrada neste mês ainda.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {sortedBills.slice(0, 8).map((tx) => {
                const paid = isPaid(tx);
                const isOverdue = !paid && tx.billStatus === "overdue";
                const dueLabel = tx.due_date ? `Vence dia ${tx.due_date.slice(8)}/${tx.due_date.slice(5, 7)}` : "Sem dia fixo";

                return (
                  <div key={tx.id} className="flex items-center gap-2 py-1.5 text-xs">
                    <PayCheck
                      paid={paid}
                      label={tx.description}
                      onToggle={() => toggle(tx)}
                      className="-ml-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="group min-w-0 flex-1 cursor-pointer py-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate font-medium group-hover:underline ${
                            paid ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {tx.description}
                        </span>
                        {isOverdue && (
                          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                            Atrasado
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {tx.member_label ?? "Casa"} · {tx.categoryName ?? "Geral"} · {paid ? "Paga" : dueLabel}
                      </div>
                    </button>

                    <span className={`shrink-0 font-medium tabular-nums ${paid ? "text-muted-foreground" : "text-foreground"}`}>
                      {formatCentsToBrl(tx.amount_cents)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {sortedBills.length > 8 && (
            <div className="mt-3 border-t border-border/60 pt-2.5 text-right">
              <button type="button" onClick={onGoToAllFluxo} className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                Ver todas as {sortedBills.length} contas do mês &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Direita (5 cols): Entradas da Casa + Distribuição por Pessoa */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Entradas da casa</h3>
                <p className="text-xs text-muted-foreground">Base para cálculo de Dízimo (10%)</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-emerald-400">
                {formatCentsToBrl(data.kpis.incomeCents)}
              </span>
            </div>

            {incomes.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Nenhuma entrada registrada neste mês.</div>
            ) : (
              <div className="divide-y divide-border/60">
                {incomes.map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => onEditTransaction(inc)}
                    className="flex w-full cursor-pointer items-center justify-between py-2.5 text-left text-xs transition-colors hover:bg-muted/20"
                  >
                    <span className="truncate font-medium text-foreground">{inc.description}</span>
                    <span className="shrink-0 font-medium tabular-nums text-emerald-400">
                      {formatCentsToBrl(inc.amount_cents)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="border-b border-border/70 pb-3">
              <h3 className="text-sm font-medium text-foreground">Distribuição por pessoa</h3>
              <p className="text-xs text-muted-foreground">Saídas por responsável no mês</p>
            </div>

            {data.members.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Sem saídas no mês.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {data.members.map((m, idx) => {
                  const color = idx === 0 ? "#10b981" : idx === 1 ? "#a1a1aa" : "#71717a";
                  const barWidth = m.percent > 0 ? Math.min(100, Math.max(2, m.percent)) : 0;
                  return (
                    <div key={m.member} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{m.member}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatCentsToBrl(m.expenseCents)} ({m.percent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          style={{ width: `${barWidth}%`, backgroundColor: color }}
                          className="h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
