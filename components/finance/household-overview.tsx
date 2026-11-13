"use client";

import { useState, useTransition, type CSSProperties } from "react";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  HeartHandshakeIcon,
  ListChecksIcon,
  RepeatIcon,
} from "lucide-react";
import { toast } from "sonner";

import { syncMonthTithe } from "@/lib/actions/finance-family";
import type { FinanceSummary } from "@/lib/data/finance";
import type { HouseholdData, HouseholdTransaction } from "@/lib/data/finance-family";
import { addDays, formatRelativeDay, formatShortDate, todayIso } from "@/lib/dates";
import { formatPercentPtBr, percentChange, percentOfCents } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { CategoryBreakdown } from "./category-breakdown";
import { EmptyMonth, GettingStarted, monthNameLong } from "./getting-started";
import { MonthlyChart } from "./monthly-chart";
import { PayCheck, usePayToggle } from "./pay-toggle";
import { AnimatedBrl, AnimatedPercent, SuccessCheckIcon } from "./transitions";

interface HouseholdOverviewProps {
  data: HouseholdData;
  categoriesBreakdown: FinanceSummary["categoriesBreakdown"];
  onGoToPendingFluxo: () => void;
  onGoToAllFluxo: () => void;
  onOpenRecurringDialog: () => void;
  onEditTransaction: (tx: HouseholdTransaction) => void;
  month: string;
  memberFilter: string | null;
  onSelectMonth?: (month: string) => void;
  onSelectMember?: (member: string | null) => void;
  onAddAccount: () => void;
  onNewIncome: () => void;
  onNewExpense: () => void;
  onImportOfx: () => void;
}

const MEMBER_BAR_COLORS: Record<string, string> = {
  Casa: "bg-emerald-500",
  Luan: "bg-sky-400",
  Rayzza: "bg-amber-400",
};

function DeltaPill({
  current,
  previous,
  invertGood = false,
}: {
  current: number;
  previous: number;
  invertGood?: boolean;
}) {
  const ch = percentChange(current, previous);
  if (ch === null) {
    return (
      <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        sem base ant.
      </span>
    );
  }
  if (ch === 0) {
    return (
      <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        0% vs. ant.
      </span>
    );
  }
  const positiveGood = invertGood ? ch < 0 : ch > 0;
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
        positiveGood
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-rose-500/15 text-rose-400"
      }`}
    >
      {ch > 0 ? "+" : "−"}
      {formatPercentPtBr(Math.abs(ch))}% vs. ant.
    </span>
  );
}

export function HouseholdOverview({
  data,
  categoriesBreakdown,
  onGoToPendingFluxo,
  onGoToAllFluxo,
  onOpenRecurringDialog,
  onEditTransaction,
  month,
  memberFilter,
  onSelectMonth,
  onSelectMember,
  onAddAccount,
  onNewIncome,
  onNewExpense,
  onImportOfx,
}: HouseholdOverviewProps) {
  const { isPaid, toggle } = usePayToggle();
  const [showPaid, setShowPaid] = useState(false);
  const [titheJustGenerated, setTitheJustGenerated] = useState(false);
  const [isSyncingTithe, startSyncTithe] = useTransition();

  if (data.transactions.length === 0) {
    const monthName = monthNameLong(month);
    if (memberFilter) {
      return (
        <EmptyMonth message={`Nada lançado para ${memberFilter} em ${monthName}.`}>
          <Button size="sm" onClick={onNewExpense}>
            Lançar gasto
          </Button>
        </EmptyMonth>
      );
    }
    return (
      <GettingStarted
        title={`Vamos montar ${monthName}`}
        description="São três passos rápidos. Os números e gráficos aparecem aqui assim que o primeiro lançamento existir."
        steps={[
          {
            id: "fixas",
            title: "Contas fixas da casa",
            description: "Aluguel, energia, internet, plano de saúde e Dízimo (10%) já vêm prontos para ajustar.",
            done: data.recurringBills.length > 0,
            actionLabel: "Usar modelo",
            onAction: onOpenRecurringDialog,
          },
          {
            id: "bancos",
            title: "Bancos e cartões",
            description: "Onde o dinheiro fica e quais cartões a casa usa.",
            done: data.accounts.length > 0,
            actionLabel: "Adicionar",
            onAction: onAddAccount,
          },
          {
            id: "entrada",
            title: `Primeira entrada de ${monthName}`,
            description: "Salário ou outra renda: é a base do Dízimo (10%) e do saldo do mês.",
            done: false,
            actionLabel: "Lançar entrada",
            onAction: onNewIncome,
          },
        ]}
        footer={
          <>
            Já tem o extrato do banco?{" "}
            <button type="button" onClick={onImportOfx} className="cursor-pointer font-medium text-foreground underline underline-offset-2">
              Importar arquivo .OFX
            </button>
          </>
        }
      />
    );
  }

  const today = todayIso();
  const weekEnd = addDays(today, 7);
  const monthName = monthNameLong(month);
  const monthTitle = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const expenses = data.transactions.filter((t) => t.kind === "expense");
  const incomes = data.transactions.filter((t) => t.kind === "income");
  const dueKey = (t: HouseholdTransaction) => t.due_date ?? t.date;
  const pendingExpenses = expenses
    .filter((t) => t.billStatus !== "paid")
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  const paidExpenses = expenses.filter((t) => t.billStatus === "paid");
  const paidTotalCents = paidExpenses.reduce((acc, t) => acc + t.amount_cents, 0);
  const overdueCount = pendingExpenses.filter((t) => t.billStatus === "overdue").length;
  const nextDue = pendingExpenses.find((t) => t.due_date && t.billStatus !== "overdue");

  const groups: Array<{ id: string; title: string; tone: string; items: HouseholdTransaction[] }> = [
    { id: "atrasadas", title: overdueCount === 1 ? "Atrasada" : "Atrasadas", tone: "text-rose-400", items: [] },
    { id: "semana", title: "Vence nos próximos 7 dias", tone: "text-amber-400", items: [] },
    { id: "depois", title: "Vence mais tarde", tone: "text-muted-foreground", items: [] },
    { id: "sem-data", title: "Sem vencimento", tone: "text-muted-foreground", items: [] },
  ];
  for (const tx of pendingExpenses) {
    if (tx.billStatus === "overdue") groups[0].items.push(tx);
    else if (!tx.due_date) groups[3].items.push(tx);
    else if (tx.due_date <= weekEnd) groups[1].items.push(tx);
    else groups[2].items.push(tx);
  }

  const creditCards = data.accounts.filter((a) => a.type === "credit_card" && a.monthInvoiceCents > 0);

  // Dízimo (10%): cálculo sobre entradas do mês + status de quitação e impacto no saldo livre
  const percentBills = data.recurringBills.filter((b) => b.amount_mode === "percent_of_income" && b.percent_bp);
  const titheBp = percentBills[0]?.percent_bp ?? 1000;
  const titheBillIds = new Set(percentBills.map((b) => b.id));
  const titheExpectedCents = percentOfCents(data.kpis.incomeCents, titheBp);
  const titheTxs = expenses.filter(
    (t) =>
      (t.recurring_bill_id && titheBillIds.has(t.recurring_bill_id)) ||
      /^d[íi]zimo/i.test(t.description) ||
      (t.categoryName?.toLowerCase().includes("dízimo") ?? false),
  );
  const tithePaidCents = titheTxs.filter((t) => isPaid(t)).reduce((acc, t) => acc + t.amount_cents, 0);
  const tithePendingTxs = titheTxs.filter((t) => !isPaid(t));
  const tithePendingSumCents = tithePendingTxs.reduce((acc, t) => acc + t.amount_cents, 0);
  const tithePendingTx = tithePendingTxs[0];
  const titheRemainingCents = Math.max(0, titheExpectedCents - tithePaidCents);
  const titheUnbookedCents = Math.max(0, titheRemainingCents - tithePendingSumCents);

  const handleSyncTithe = () => {
    startSyncTithe(async () => {
      const res = await syncMonthTithe(month);
      if (res.ok) {
        setTitheJustGenerated(true);
        toast.success("Dízimo (10%) lançado no mês.");
      } else {
        toast.error(res.error);
      }
    });
  };

  const projectedGrossCents = data.kpis.projectedBalanceCents;
  const netAfterUnbookedTitheCents = projectedGrossCents - titheUnbookedCents;
  const hasUnbookedTithe = titheUnbookedCents > 0;
  const heroCents = hasUnbookedTithe ? netAfterUnbookedTitheCents : projectedGrossCents;
  const netSavingsPct =
    data.kpis.incomeCents > 0
      ? Math.round((heroCents / data.kpis.incomeCents) * 1000) / 10
      : 0;

  // Barra visual de destino das entradas (Saídas já lançadas sem duplicar Dízimo pendente, Dízimo reservado, Livre)
  const incomeBase = Math.max(data.kpis.incomeCents, 1);
  const expenseSharePct = Math.min(100, Math.round((data.kpis.expenseCents / incomeBase) * 1000) / 10);
  const titheSharePct = hasUnbookedTithe
    ? Math.min(Math.max(0, 100 - expenseSharePct), Math.round((titheUnbookedCents / incomeBase) * 1000) / 10)
    : 0;
  const freeSharePct = Math.max(0, Math.round((100 - expenseSharePct - titheSharePct) * 10) / 10);

  const variableExpenseCents = Math.max(0, data.kpis.expenseCents - data.kpis.fixedExpenseCents);
  const variableSharePct =
    data.kpis.expenseCents > 0
      ? Math.round((variableExpenseCents / data.kpis.expenseCents) * 1000) / 10
      : 0;

  const relativeDay = (iso: string) => {
    const rel = formatRelativeDay(iso, today);
    return /^[a-zà-ú]{3}$/i.test(rel) ? `${rel}, ${formatShortDate(iso)}` : rel;
  };

  const dueText = (tx: HouseholdTransaction) => {
    if (!tx.due_date) return "sem vencimento";
    const rel = relativeDay(tx.due_date);
    return tx.billStatus === "overdue" ? `venceu ${rel}` : `vence ${rel}`;
  };

  const renderBill = (tx: HouseholdTransaction) => {
    const paid = isPaid(tx);
    return (
      <li key={tx.id} className="flex items-center gap-2 py-1">
        <PayCheck paid={paid} label={tx.description} onToggle={() => toggle(tx)} className="-ml-1.5" />
        <button
          type="button"
          onClick={() => onEditTransaction(tx)}
          className="group min-w-0 flex-1 cursor-pointer py-1 text-left"
        >
          <span
            className={`block truncate text-[13px] font-medium group-hover:underline ${
              paid ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground"
            }`}
          >
            {tx.description}
          </span>
          <span className="block text-xs text-muted-foreground">
            {paid ? "paga" : dueText(tx)} · {tx.categoryName ?? "Geral"}
            {tx.member_label && tx.member_label !== "Casa" ? ` · ${tx.member_label}` : ""}
          </span>
        </button>
        <span className={`shrink-0 text-[13px] font-medium tabular-nums ${paid ? "text-muted-foreground" : "text-foreground"}`}>
          {formatCentsToBrl(tx.amount_cents)}
        </span>
      </li>
    );
  };

  const heroTone = heroCents > 0 ? "text-emerald-400" : heroCents < 0 ? "text-rose-400" : "text-foreground";
  const heroBadge =
    heroCents > 0
      ? {
          text: hasUnbookedTithe ? "Superávit líquido" : "Superávit",
          cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        }
      : heroCents < 0
        ? {
            text: hasUnbookedTithe ? "No vermelho após Dízimo" : "No vermelho",
            cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
          }
        : { text: "Equilibrado", cls: "border-border bg-muted/40 text-muted-foreground" };

  return (
    <div className="space-y-4">
      {data.recurringBills.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px]">
          <div className="flex items-center gap-2.5">
            <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">Contas fixas da casa:</span> use o modelo com aluguel, energia,
              cartões e Dízimo (10%) para o mês se montar sozinho.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenRecurringDialog}>
            Usar modelo
          </Button>
        </div>
      )}

      {/* 1. Hero Executivo: Saldo livre pós-Dízimo + destino visual das entradas (estilo cartões Trust Care) */}
      <section
        aria-labelledby="month-answer"
        style={{ "--stagger-i": 0 } as CSSProperties}
        className="t-cascade-item t-kpi-card grid grid-cols-1 items-center gap-4 rounded-xl border border-border bg-gradient-to-b from-emerald-500/[0.04] to-card p-4 lg:grid-cols-12"
      >
        <div className="min-w-0 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <p id="month-answer" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {hasUnbookedTithe
                ? `Saldo livre previsto de ${monthTitle} (após Dízimo)`
                : `Saldo previsto de ${monthTitle}`}
            </p>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${heroBadge.cls}`}>
              {heroBadge.text}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            <AnimatedBrl
              cents={heroCents}
              resetKey={month}
              className={`text-3xl font-bold tracking-tight sm:text-4xl ${heroTone}`}
            />
            <DeltaPill current={projectedGrossCents} previous={data.previousKpis.projectedBalanceCents} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground tabular-nums">
            {hasUnbookedTithe && (
              <>
                <span>
                  Previsto bruto:{" "}
                  <strong className="font-semibold text-foreground">
                    <AnimatedBrl cents={projectedGrossCents} resetKey={month} durationMs={480} />
                  </strong>
                </span>
                <span>
                  Dízimo a lançar:{" "}
                  <strong className="font-semibold text-amber-400">
                    −<AnimatedBrl cents={titheUnbookedCents} resetKey={month} durationMs={480} />
                  </strong>
                </span>
              </>
            )}
            {data.kpis.incomeCents > 0 && (
              <span>
                Poupança {hasUnbookedTithe ? "líquida" : "prevista"}:{" "}
                <strong className="font-semibold text-foreground">
                  <AnimatedPercent value={netSavingsPct} resetKey={month} durationMs={480} />
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Barra proporcional de destino das entradas */}
        <div className="border-t border-border/70 pt-3 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Destino das entradas</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatPercentPtBr(data.kpis.savingsRatePercent)}% antes do dízimo a lançar
            </span>
          </div>
          <div
            className="mt-2 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted/50"
            role="img"
            aria-label={`Saídas ${formatPercentPtBr(expenseSharePct)}%, Dízimo a lançar ${formatPercentPtBr(titheSharePct)}%, Livre ${formatPercentPtBr(freeSharePct)}%`}
          >
            {expenseSharePct > 0 && (
              <div style={{ width: `${expenseSharePct}%` }} className="t-bar-morph h-full bg-rose-500" />
            )}
            {titheSharePct > 0 && (
              <div style={{ width: `${titheSharePct}%` }} className="t-bar-morph h-full bg-amber-400" />
            )}
            {freeSharePct > 0 && (
              <div style={{ width: `${freeSharePct}%` }} className="t-bar-morph h-full bg-emerald-500" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" />
              Saídas {formatPercentPtBr(expenseSharePct)}%
            </span>
            {titheSharePct > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-400" />
                Dízimo {formatPercentPtBr(titheSharePct)}%
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Livre {formatPercentPtBr(freeSharePct)}%
            </span>
          </div>
        </div>
      </section>

      {/* 2. Faixa de 4 KPIs estilo Trust Care (rótulo caixa alta + ícone + contagem animada) */}
      <section aria-label="Indicadores principais do mês" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article
          style={{ "--stagger-i": 1 } as CSSProperties}
          className="t-cascade-item t-kpi-card flex flex-col justify-between gap-2.5 rounded-xl border border-border bg-card p-3.5 hover:border-emerald-500/25"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex size-4 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
                <ArrowUpRightIcon className="size-3" />
              </span>
              Entradas
            </span>
            <DeltaPill current={data.kpis.incomeCents} previous={data.previousKpis.incomeCents} />
          </div>
          <AnimatedBrl
            cents={data.kpis.incomeCents}
            resetKey={month}
            className={`text-2xl font-bold tracking-tight ${
              data.kpis.incomeCents > 0 ? "text-emerald-400" : "text-foreground"
            }`}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {data.kpis.pendingIncomeCents > 0
                ? `Recebido ${formatCentsToBrl(data.kpis.paidIncomeCents)}`
                : `${incomes.length} ${incomes.length === 1 ? "recebimento" : "recebimentos"}`}
            </span>
            <span className={data.kpis.pendingIncomeCents > 0 ? "text-amber-400" : "text-emerald-400"}>
              {data.kpis.pendingIncomeCents > 0
                ? `A receber ${formatCentsToBrl(data.kpis.pendingIncomeCents)}`
                : "100% recebido"}
            </span>
          </div>
        </article>

        <article
          style={{ "--stagger-i": 2 } as CSSProperties}
          className="t-cascade-item t-kpi-card flex flex-col justify-between gap-2.5 rounded-xl border border-border bg-card p-3.5 hover:border-rose-500/25"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex size-4 items-center justify-center rounded bg-rose-500/15 text-rose-400">
                <ArrowDownRightIcon className="size-3" />
              </span>
              Saídas
            </span>
            <DeltaPill current={data.kpis.expenseCents} previous={data.previousKpis.expenseCents} invertGood />
          </div>
          <AnimatedBrl
            cents={data.kpis.expenseCents}
            resetKey={month}
            className={`text-2xl font-bold tracking-tight ${
              data.kpis.expenseCents > 0 ? "text-rose-400" : "text-foreground"
            }`}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>
              Pago {formatCentsToBrl(data.kpis.paidExpenseCents)}
              {data.kpis.pendingExpenseCents > 0 ? ` · Falta ${formatCentsToBrl(data.kpis.pendingExpenseCents)}` : ""}
            </span>
            <span className="shrink-0 font-medium text-foreground/85">{formatCentsToBrl(data.kpis.dailyBurnCents)}/dia</span>
          </div>
        </article>

        <article
          style={{ "--stagger-i": 3 } as CSSProperties}
          className={`t-cascade-item t-kpi-card flex flex-col justify-between gap-2.5 rounded-xl border bg-card p-3.5 ${
            titheRemainingCents > 0
              ? "border-amber-500/35 bg-gradient-to-b from-amber-500/[0.04] to-card hover:border-amber-500/50"
              : "border-border hover:border-border/95"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex size-4 items-center justify-center rounded bg-amber-500/15 text-amber-400">
                <HeartHandshakeIcon className="size-3" />
              </span>
              Dízimo ({(titheBp / 100).toFixed(0)}%)
            </span>
            {titheExpectedCents > 0 &&
              (titheRemainingCents === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <SuccessCheckIcon active={titheJustGenerated || tithePaidCents > 0} className="size-3" />
                  Quitado
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-400">
                  Falta {formatCentsToBrl(titheRemainingCents)}
                </span>
              ))}
          </div>
          <AnimatedBrl
            cents={titheExpectedCents}
            resetKey={month}
            className={`text-2xl font-bold tracking-tight ${
              titheRemainingCents === 0 && titheExpectedCents > 0 ? "text-emerald-400" : "text-amber-400"
            }`}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate tabular-nums">
              {tithePaidCents > 0 && titheRemainingCents > 0
                ? `Pago ${formatCentsToBrl(tithePaidCents)}`
                : `Base ${formatCentsToBrl(data.kpis.incomeCents)}`}
            </span>
            {tithePendingTx ? (
              <button
                type="button"
                onClick={() => toggle(tithePendingTx)}
                className="shrink-0 cursor-pointer rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Marcar pago
              </button>
            ) : titheRemainingCents > 0 ? (
              <button
                type="button"
                disabled={isSyncingTithe}
                onClick={handleSyncTithe}
                className="shrink-0 cursor-pointer rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
              >
                {isSyncingTithe ? "Gerando..." : "Lançar 10% agora"}
              </button>
            ) : (
              <span className="text-emerald-400">Em dia</span>
            )}
          </div>
        </article>

        <article
          style={{ "--stagger-i": 4 } as CSSProperties}
          className="t-cascade-item t-kpi-card flex flex-col justify-between gap-2.5 rounded-xl border border-border bg-card p-3.5 hover:border-border/95"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex size-4 items-center justify-center rounded bg-muted text-foreground/80">
                <RepeatIcon className="size-3" />
              </span>
              Fixas
            </span>
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {formatPercentPtBr(data.kpis.fixedShareOfExpensesPercent)}% das saídas
            </span>
          </div>
          <AnimatedBrl
            cents={data.kpis.fixedExpenseCents}
            resetKey={month}
            className="text-2xl font-bold tracking-tight text-foreground"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span className="truncate">
              Variáveis {formatCentsToBrl(variableExpenseCents)} ({formatPercentPtBr(variableSharePct)}%)
            </span>
            {data.kpis.fixedExpenseCents === 0 && data.kpis.expenseCents > 0 ? (
              <button
                type="button"
                onClick={onOpenRecurringDialog}
                className="shrink-0 cursor-pointer font-medium text-foreground underline underline-offset-2"
              >
                Configurar
              </button>
            ) : (
              <span className="shrink-0">{formatPercentPtBr(data.kpis.fixedCommitmentPercent)}% da renda</span>
            )}
          </div>
        </article>
      </section>

      {/* Alerta só aparece quando realmente falta pagar contas (elimina redundância com card de Contas) */}
      {pendingExpenses.length > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-2.5 text-sm ${
            overdueCount > 0 ? "border-rose-500/40" : "border-amber-500/35"
          }`}
        >
          <span className="flex items-center gap-2.5 text-foreground">
            <AlertTriangleIcon className={`size-4 shrink-0 ${overdueCount > 0 ? "text-rose-400" : "text-amber-400"}`} />
            <span>
              <strong className="font-semibold">
                Falta pagar <span className="tabular-nums">{formatCentsToBrl(data.kpis.pendingExpenseCents)}</span>
              </strong>{" "}
              em {pendingExpenses.length} {pendingExpenses.length === 1 ? "conta" : "contas"}
              {overdueCount > 0 && (
                <span className="text-rose-400">
                  {" "}
                  · {overdueCount} {overdueCount === 1 ? "atrasada" : "atrasadas"}
                </span>
              )}
              {nextDue?.due_date && (
                <span className="text-muted-foreground">
                  {" "}
                  · próxima: {nextDue.description}, {relativeDay(nextDue.due_date)}
                </span>
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={onGoToPendingFluxo}
            className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-foreground hover:underline"
          >
            Ver em Lançamentos
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
      )}

      {/* 3. Indicadores visuais acima da dobra (Esquerda) + Operacional compacto (Direita) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div
          style={{ "--stagger-i": 5 } as CSSProperties}
          className="t-cascade-item space-y-4 lg:col-span-7 xl:col-span-8"
        >
          <MonthlyChart data={data.trend} currentMonth={month} onSelectMonth={onSelectMonth} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <CategoryBreakdown categoriesBreakdown={categoriesBreakdown} compact />
            </div>

            {data.members.length > 0 && (
              <section aria-labelledby="members-title" className="rounded-xl border border-border bg-card p-4 xl:col-span-5">
                <div className="flex items-center justify-between gap-2 pb-3">
                  <h3 id="members-title" className="text-sm font-medium text-foreground">
                    Gastos por pessoa
                  </h3>
                  {onSelectMember && (
                    <span className="text-xs text-muted-foreground">Clique para filtrar</span>
                  )}
                </div>
                <div className="space-y-3">
                  {data.members.map((m) => {
                    const active = memberFilter === m.member;
                    const barCls = MEMBER_BAR_COLORS[m.member] ?? "bg-zinc-400";
                    return (
                      <button
                        key={m.member}
                        type="button"
                        onClick={() => onSelectMember?.(active ? null : m.member)}
                        className={`block w-full cursor-pointer space-y-1.5 rounded-lg p-1.5 text-left transition-colors ${
                          active ? "bg-muted/60 ring-1 ring-border" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{m.member}</span>
                          <span className="tabular-nums text-muted-foreground">
                            <strong className="font-medium text-foreground">{formatCentsToBrl(m.expenseCents)}</strong> · {formatPercentPtBr(m.percent)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                          <div
                            style={{ width: `${m.percent > 0 ? Math.min(100, Math.max(2, m.percent)) : 0}%` }}
                            className={`t-bar-morph h-full rounded-full ${barCls}`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Coluna Direita: Contas (com Accordion #21) + Entradas + Cartões */}
        <div
          style={{ "--stagger-i": 6 } as CSSProperties}
          className="t-cascade-item space-y-4 lg:col-span-5 xl:col-span-4"
        >
          <section aria-labelledby="bills-title" className="rounded-xl border border-border bg-card px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 id="bills-title" className="text-sm font-medium text-foreground">
                Contas de {monthName}
              </h3>
              {expenses.length > 0 && pendingExpenses.length === 0 && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  {paidExpenses.length} quitadas
                </span>
              )}
            </div>

            {expenses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum gasto lançado em {monthName} ainda.</p>
            ) : (
              <>
                {groups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <div key={g.id} className="mt-3">
                      <h4 className={`text-xs font-semibold ${g.tone}`}>{g.title}</h4>
                      <ul className="divide-y divide-border/60">{g.items.map(renderBill)}</ul>
                    </div>
                  ))}

                {paidExpenses.length > 0 && (
                  <div className="t-acc mt-3 border-t border-border/60 pt-2.5" data-open={String(showPaid)}>
                    <button
                      type="button"
                      aria-expanded={showPaid}
                      onClick={() => setShowPaid((v) => !v)}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2Icon className="size-4 text-emerald-500" />
                        <span>
                          {paidExpenses.length} {paidExpenses.length === 1 ? "já paga" : "já pagas"} ·{" "}
                          <strong className="font-medium tabular-nums text-foreground">{formatCentsToBrl(paidTotalCents)}</strong>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs">
                        {showPaid ? "esconder" : "mostrar"}
                        <span className="t-acc-chevron" aria-hidden="true">
                          <ChevronDownIcon className="size-3.5" />
                        </span>
                      </span>
                    </button>
                    <div className="t-acc-panel">
                      <div className="t-acc-panel-inner">
                        <ul className="divide-y divide-border/60 pt-2">{paidExpenses.map(renderBill)}</ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 border-t border-border/60 pt-2.5 text-right">
                  <button
                    type="button"
                    onClick={onGoToAllFluxo}
                    className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Ver todos os lançamentos de {monthName} &rarr;
                  </button>
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="incomes-title" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="incomes-title" className="text-sm font-medium text-foreground">
                Entradas (Base Dízimo)
              </h3>
              <span className="text-sm font-semibold tabular-nums text-emerald-400">
                {formatCentsToBrl(data.kpis.incomeCents)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {incomes.length} {incomes.length === 1 ? "fonte no mês" : "fontes no mês"}
            </p>
            {incomes.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-muted-foreground">Nenhuma entrada em {monthName}.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60">
                {incomes.map((inc) => {
                  const incTithe = percentOfCents(inc.amount_cents, titheBp);
                  return (
                    <li key={inc.id}>
                      <button
                        type="button"
                        onClick={() => onEditTransaction(inc)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 py-2 text-left text-[13px] hover:underline"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-foreground">
                            {inc.description}
                            {inc.billStatus !== "paid" && <span className="text-amber-400"> · a receber</span>}
                          </span>
                          <span className="block text-xs tabular-nums text-muted-foreground">
                            Dízimo ({(titheBp / 100).toFixed(0)}%): {formatCentsToBrl(incTithe)}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-medium text-emerald-400">{formatCentsToBrl(inc.amount_cents)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {creditCards.length > 0 && (
            <section aria-labelledby="cards-title" className="rounded-xl border border-border bg-card p-4">
              <h3 id="cards-title" className="text-sm font-medium text-foreground">
                Cartões em {monthName}
              </h3>
              <ul className="mt-2 divide-y divide-border/60">
                {creditCards.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span className="truncate text-foreground">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-foreground">{formatCentsToBrl(c.monthInvoiceCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
