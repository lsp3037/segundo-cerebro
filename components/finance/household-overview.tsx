"use client";

import { useTransition } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CreditCardIcon,
  ListChecksIcon,
  ScaleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { toggleTransactionPaid } from "@/lib/actions/finance-family";
import type { HouseholdData, HouseholdTransaction } from "@/lib/data/finance-family";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";

interface HouseholdOverviewProps {
  data: HouseholdData;
  onGoToPendingFluxo: () => void;
  onOpenRecurringDialog: () => void;
  onEditTransaction: (tx: HouseholdTransaction) => void;
}

export function HouseholdOverview({
  data,
  onGoToPendingFluxo,
  onOpenRecurringDialog,
  onEditTransaction,
}: HouseholdOverviewProps) {
  const [isPending, startTransition] = useTransition();

  const expenses = data.transactions.filter((t) => t.kind === "expense");
  const incomes = data.transactions.filter((t) => t.kind === "income");
  const pendingExpenses = expenses.filter((t) => t.billStatus !== "paid");
  const overdueCount = pendingExpenses.filter((t) => t.billStatus === "overdue").length;

  const creditCards = data.accounts.filter((a) => a.type === "credit_card");
  const cardsTotalCents = creditCards.reduce((acc, c) => acc + c.monthInvoiceCents, 0);
  const cardsPercent = data.kpis.expenseCents > 0 ? Math.round((cardsTotalCents / data.kpis.expenseCents) * 1000) / 10 : 0;

  // Ordena contas do mês: atrasadas/pendentes primeiro, depois maiores valores pagos
  const sortedBills = [...expenses].sort((a, b) => {
    const aPend = a.billStatus !== "paid" ? 0 : 1;
    const bPend = b.billStatus !== "paid" ? 0 : 1;
    if (aPend !== bPend) return aPend - bPend;
    return (a.due_date ?? a.date).localeCompare(b.due_date ?? b.date);
  });

  const handleTogglePay = (tx: HouseholdTransaction) => {
    startTransition(async () => {
      const res = await toggleTransactionPaid(tx.id);
      if (res.ok) {
        toast.success(res.data.status === "paid" ? `"${tx.description}" marcado como pago!` : `"${tx.description}" reaberto como pendente.`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Banner de Atenção para Vencimentos e Pendentes */}
      {pendingExpenses.length > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            overdueCount > 0
              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
              : "border-amber-500/35 bg-amber-500/10 text-amber-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                overdueCount > 0 ? "bg-rose-500/25 text-rose-300" : "bg-amber-500/25 text-amber-300"
              }`}
            >
              <AlertTriangleIcon className="size-3" />
              {overdueCount > 0 ? `${overdueCount} atrasada(s)` : "Atenção"}
            </span>
            <span>
              <strong>{pendingExpenses.length} {pendingExpenses.length === 1 ? "conta pendente" : "contas pendentes"}</strong> no mês somando{" "}
              <strong className="font-mono tabular-nums text-amber-300">
                {formatCentsToBrl(data.kpis.pendingExpenseCents)}
              </strong>
              {pendingExpenses[0]?.due_date && (
                <> — próxima: <strong>{pendingExpenses[0].description}</strong> ({pendingExpenses[0].due_date.slice(8)}/{pendingExpenses[0].due_date.slice(5, 7)})</>
              )}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={onGoToPendingFluxo} className="h-7 gap-1 text-xs">
            Ver pendentes
            <ArrowRightIcon className="size-3" />
          </Button>
        </div>
      )}

      {/* Onboarding rápido caso ainda não tenha configurado contas fixas */}
      {data.recurringBills.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ListChecksIcon className="size-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Configure a planilha fixa da casa uma única vez: </span>
              <span className="text-muted-foreground">
                carregue o modelo com suas entradas, os 4 cartões, contas da casa e o Dízimo automático (10%).
              </span>
            </div>
          </div>
          <Button size="sm" onClick={onOpenRecurringDialog} className="h-7 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">
            Configurar Contas Fixas
          </Button>
        </div>
      )}

      {/* 4 Cards KPI Executivos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Entradas do Mês</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              {incomes.length} {incomes.length === 1 ? "fonte" : "fontes"}
            </span>
          </div>
          <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
            {formatCentsToBrl(data.kpis.incomeCents)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Recebido: {formatCentsToBrl(data.kpis.paidIncomeCents)}</span>
            <span>Previsto: {formatCentsToBrl(data.kpis.pendingIncomeCents)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Saídas Totais (Previsto + Pago)</span>
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
              {expenses.length} {expenses.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-rose-400 tabular-nums">
            {formatCentsToBrl(data.kpis.expenseCents)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Pago: <strong className="font-mono text-foreground">{formatCentsToBrl(data.kpis.paidExpenseCents)}</strong></span>
            <span className="text-amber-400">Falta: <strong className="font-mono">{formatCentsToBrl(data.kpis.pendingExpenseCents)}</strong></span>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            data.kpis.projectedBalanceCents >= 0
              ? "border-emerald-500/35 bg-emerald-950/15"
              : "border-rose-500/35 bg-rose-950/15"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Saldo Projetado do Mês</span>
            <ScaleIcon className={`size-4 ${data.kpis.projectedBalanceCents >= 0 ? "text-emerald-400" : "text-rose-400"}`} />
          </div>
          <div
            className={`mt-2.5 font-mono text-2xl font-bold tracking-tight tabular-nums ${
              data.kpis.projectedBalanceCents >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {data.kpis.projectedBalanceCents >= 0 ? "+ " : ""}
            {formatCentsToBrl(data.kpis.projectedBalanceCents)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Taxa de Poupança:{" "}
              <strong className={data.kpis.savingsRatePercent >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {data.kpis.savingsRatePercent}%
              </strong>
            </span>
            <span>Fixas: {data.kpis.fixedCommitmentPercent}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Cartões de Crédito (Mês)</span>
            <CreditCardIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatCentsToBrl(cardsTotalCents)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{cardsPercent}% das saídas</span>
            <span>{creditCards.length} {creditCards.length === 1 ? "cartão" : "cartões"}</span>
          </div>
        </div>
      </div>

      {/* Corpo Principal: Baixa Rápida + Entradas / Distribuição por Pessoa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Esquerda (7 cols): Contas do Mês & Baixa Rápida */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Contas do Mês &amp; Baixa Rápida</h3>
              <p className="text-xs text-muted-foreground">
                Clique em Pagar para dar baixa no mês em 1 clique
              </p>
            </div>
            {pendingExpenses.length > 0 && (
              <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                {pendingExpenses.length} pendentes
              </span>
            )}
          </div>

          {sortedBills.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Nenhuma saída registrada neste mês ainda.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {sortedBills.slice(0, 8).map((tx) => {
                const isPaid = tx.billStatus === "paid";
                const isOverdue = tx.billStatus === "overdue";
                const dueLabel = tx.due_date ? `Vence dia ${tx.due_date.slice(8)}/${tx.due_date.slice(5, 7)}` : "Sem dia fixo";

                return (
                  <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="min-w-0 flex-1 text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground group-hover:text-primary">
                          {tx.description}
                        </span>
                        {isOverdue && (
                          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                            Atrasado
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {tx.member_label ?? "Casa"} · {tx.categoryName ?? "Geral"} · {dueLabel}
                      </div>
                    </button>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`font-mono font-semibold tabular-nums ${isPaid ? "text-muted-foreground" : "text-foreground"}`}>
                        {formatCentsToBrl(tx.amount_cents)}
                      </span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleTogglePay(tx)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          isPaid
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-emerald-950"
                        }`}
                      >
                        <CheckIcon className="size-3" />
                        {isPaid ? "Pago" : "Pagar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sortedBills.length > 8 && (
            <div className="mt-3 border-t border-border/40 pt-2.5 text-right">
              <button type="button" onClick={onGoToPendingFluxo} className="text-xs font-medium text-primary hover:underline">
                Ver todas as {sortedBills.length} contas do mês &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Direita (5 cols): Entradas da Casa + Distribuição por Pessoa */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Entradas da Casa</h3>
                <p className="text-xs text-muted-foreground">Base para cálculo automático de 10% (Dízimo)</p>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                {formatCentsToBrl(data.kpis.incomeCents)}
              </span>
            </div>

            {incomes.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Nenhuma entrada registrada neste mês.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {incomes.map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => onEditTransaction(inc)}
                    className="flex w-full items-center justify-between py-2.5 text-left text-xs hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowUpRightIcon className="size-3.5 text-emerald-400" />
                      <span className="font-medium text-foreground">{inc.description}</span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                      {formatCentsToBrl(inc.amount_cents)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="border-b border-border/50 pb-3">
              <h3 className="text-sm font-semibold text-foreground">Distribuição por Pessoa</h3>
              <p className="text-xs text-muted-foreground">Total de saídas por responsável no mês</p>
            </div>

            {data.members.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Sem saídas no mês.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {data.members.map((m, idx) => {
                  const color = idx === 0 ? "#10b981" : idx === 1 ? "#3b82f6" : "#f59e0b";
                  return (
                    <div key={m.member} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{m.member}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {formatCentsToBrl(m.expenseCents)} ({m.percent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          style={{ width: `${Math.min(100, Math.max(2, m.percent))}%`, backgroundColor: color }}
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
