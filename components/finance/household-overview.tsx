"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ListChecksIcon,
} from "lucide-react";
import { toast } from "sonner";

import { syncMonthTithe } from "@/lib/actions/finance-family";
import type { FinanceSummary } from "@/lib/data/finance";
import type { HouseholdData, HouseholdTransaction } from "@/lib/data/finance-family";
import { addDays, formatRelativeDay, formatShortDate, todayIso } from "@/lib/dates";
import { percentOfCents } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { CategoryBreakdown } from "./category-breakdown";
import { FinanceKpiStrip } from "./finance-hierarchy";
import { EmptyMonth, GettingStarted, monthNameLong } from "./getting-started";
import { MonthlyChart } from "./monthly-chart";
import { PayCheck, usePayToggle } from "./pay-toggle";

interface HouseholdOverviewProps {
  data: HouseholdData;
  categoriesBreakdown: FinanceSummary["categoriesBreakdown"];
  onGoToPendingFluxo: () => void;
  onGoToAllFluxo: () => void;
  onOpenRecurringDialog: () => void;
  onEditTransaction: (tx: HouseholdTransaction) => void;
  month: string;
  memberFilter: string | null;
  onAddAccount: () => void;
  onNewIncome: () => void;
  onNewExpense: () => void;
  onImportOfx: () => void;
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
  onAddAccount,
  onNewIncome,
  onNewExpense,
  onImportOfx,
}: HouseholdOverviewProps) {
  const { isPaid, toggle } = usePayToggle();
  const [showPaid, setShowPaid] = useState(false);
  const [isSyncingTithe, startSyncTithe] = useTransition();

  // Mês sem nenhum lançamento: em vez de uma tela de zeros, mostra o caminho para começar.
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
  // Pendentes ordenadas por vencimento: a primeira é de fato a próxima a vencer.
  const pendingExpenses = expenses
    .filter((t) => t.billStatus !== "paid")
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  const paidExpenses = expenses.filter((t) => t.billStatus === "paid");
  const paidTotalCents = paidExpenses.reduce((acc, t) => acc + t.amount_cents, 0);
  const overdueCount = pendingExpenses.filter((t) => t.billStatus === "overdue").length;
  const nextDue = pendingExpenses.find((t) => t.due_date && t.billStatus !== "overdue");

  // Grupos por urgência. Cada conta pendente cai em exatamente um.
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

  // Dízimo (10%): cálculo sobre entradas do mês + status de quitação
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
  const tithePendingTx = titheTxs.find((t) => !isPaid(t));
  const titheRemainingCents = Math.max(0, titheExpectedCents - tithePaidCents);

  const handleSyncTithe = () => {
    startSyncTithe(async () => {
      const res = await syncMonthTithe(month);
      if (res.ok) toast.success("Dízimo (10%) atualizado no mês.");
      else toast.error(res.error);
    });
  };

  const projected = data.kpis.projectedBalanceCents;
  const answer =
    projected > 0
      ? {
          lead: `Saldo previsto de ${monthTitle}`,
          value: formatCentsToBrl(projected),
          badge: "Superávit",
          badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
          tone: "text-emerald-400",
        }
      : projected < 0
        ? {
            lead: `Saldo previsto de ${monthTitle}`,
            value: `-${formatCentsToBrl(-projected)}`,
            badge: "No vermelho",
            badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-400",
            tone: "text-rose-400",
          }
        : {
            lead: `Saldo previsto de ${monthTitle}`,
            value: formatCentsToBrl(0),
            badge: "Equilibrado",
            badgeClass: "border-border bg-muted/40 text-muted-foreground",
            tone: "text-foreground",
          };

  // "seg" sozinho é curto demais para ler de relance: vira "seg, 16 nov".
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
            className={`block truncate text-sm font-medium group-hover:underline ${
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
        <span className={`shrink-0 text-sm font-medium tabular-nums ${paid ? "text-muted-foreground" : "text-foreground"}`}>
          {formatCentsToBrl(tx.amount_cents)}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      {/* Convite para a planilha fixa enquanto ela não existe */}
      {data.recurringBills.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-[13px]">
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

      {/* 1. Saldo previsto do mês + faixa de KPIs (incluindo Dízimo 10% no início) */}
      <section aria-labelledby="month-answer" className="space-y-4">
        <div>
          <p id="month-answer" className="text-sm text-muted-foreground">
            {answer.lead}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            <p className={`text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${answer.tone}`}>
              {answer.value}
            </p>
            <span className={`rounded border px-2 py-0.5 text-xs font-medium ${answer.badgeClass}`}>
              {answer.badge}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
            Entradas {formatCentsToBrl(data.kpis.incomeCents)} · Saídas {formatCentsToBrl(data.kpis.expenseCents)}
            {data.kpis.incomeCents > 0 && <> · Taxa de poupança {data.kpis.savingsRatePercent}%</>}
          </p>
        </div>

        <FinanceKpiStrip
          columns={4}
          items={[
            {
              id: "kpi-income",
              label: "Total de Entradas",
              value: formatCentsToBrl(data.kpis.incomeCents),
              tone: data.kpis.incomeCents > 0 ? "positive" : "default",
              subtext:
                data.kpis.pendingIncomeCents > 0
                  ? `Recebido ${formatCentsToBrl(data.kpis.paidIncomeCents)} · A receber ${formatCentsToBrl(data.kpis.pendingIncomeCents)}`
                  : `${incomes.length} ${incomes.length === 1 ? "entrada lançada" : "entradas lançadas"}`,
            },
            {
              id: "kpi-expense",
              label: "Total de Saídas",
              value: formatCentsToBrl(data.kpis.expenseCents),
              tone: data.kpis.expenseCents > 0 ? "negative" : "default",
              subtext: `Pago ${formatCentsToBrl(data.kpis.paidExpenseCents)} · Pendente ${formatCentsToBrl(data.kpis.pendingExpenseCents)}`,
            },
            {
              id: "kpi-tithe",
              label: `Dízimo (${(titheBp / 100).toFixed(0)}%)`,
              value: formatCentsToBrl(titheExpectedCents),
              tone:
                titheExpectedCents === 0
                  ? "default"
                  : titheRemainingCents === 0
                    ? "positive"
                    : "warning",
              badge:
                titheExpectedCents === 0 ? null : titheRemainingCents === 0 ? (
                  <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
                    Quitado
                  </span>
                ) : (
                  <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-amber-400">
                    Falta {formatCentsToBrl(titheRemainingCents)}
                  </span>
                ),
              subtext:
                titheExpectedCents === 0
                  ? "Calculado a cada entrada"
                  : tithePaidCents > 0 && titheRemainingCents > 0
                    ? `Pago ${formatCentsToBrl(tithePaidCents)} de ${formatCentsToBrl(titheExpectedCents)}`
                    : `${(titheBp / 100).toFixed(0)}% sobre ${formatCentsToBrl(data.kpis.incomeCents)}`,
              action: tithePendingTx ? (
                <button
                  type="button"
                  onClick={() => toggle(tithePendingTx)}
                  className="cursor-pointer font-medium text-foreground underline underline-offset-2 hover:text-emerald-400"
                >
                  Marcar pago
                </button>
              ) : titheRemainingCents > 0 ? (
                <button
                  type="button"
                  disabled={isSyncingTithe}
                  onClick={handleSyncTithe}
                  className="cursor-pointer font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300 disabled:opacity-50"
                >
                  {isSyncingTithe ? "Gerando..." : "Gerar 10%"}
                </button>
              ) : undefined,
            },
            {
              id: "kpi-commitment",
              label: "Comprometimento fixo",
              value: `${data.kpis.fixedCommitmentPercent}%`,
              badge: (
                <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {formatCentsToBrl(data.kpis.dailyBurnCents)}/dia
                </span>
              ),
              subtext: `Fixas ${formatCentsToBrl(data.kpis.fixedExpenseCents)} · Poupança ${data.kpis.savingsRatePercent}%`,
            },
          ]}
        />
      </section>

      {/* 2. O que falta pagar */}
      {pendingExpenses.length > 0 ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm ${
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
      ) : (
        expenses.length > 0 && (
          <p className="rounded-lg border border-emerald-500/30 bg-card px-4 py-3 text-sm text-foreground">
            Tudo pago em {monthName}. <span className="text-muted-foreground">{paidExpenses.length} contas quitadas.</span>
          </p>
        )
      )}

      {/* 3. Contas por urgência + apoio */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section aria-labelledby="bills-title" className="rounded-lg border border-border bg-card px-4 pb-3 pt-4 lg:col-span-7">
          <h3 id="bills-title" className="text-sm font-medium text-foreground">
            Contas de {monthName}
          </h3>

          {expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum gasto lançado em {monthName} ainda.</p>
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
                <div className="mt-3 border-t border-border/60 pt-2">
                  <button
                    type="button"
                    aria-expanded={showPaid}
                    onClick={() => setShowPaid((v) => !v)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-4 text-emerald-500" />
                      {paidExpenses.length} {paidExpenses.length === 1 ? "já paga" : "já pagas"} ·{" "}
                      <span className="tabular-nums">{formatCentsToBrl(paidTotalCents)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {showPaid ? "esconder" : "mostrar"}
                      <ChevronDownIcon className={`size-3.5 transition-transform ${showPaid ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {showPaid && <ul className="divide-y divide-border/60">{paidExpenses.map(renderBill)}</ul>}
                </div>
              )}

              <div className="mt-2 border-t border-border/60 pt-2.5 text-right">
                <button
                  type="button"
                  onClick={onGoToAllFluxo}
                  className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Ver todos os lançamentos de {monthName} &rarr;
                </button>
              </div>
            </>
          )}
        </section>

        <div className="space-y-4 lg:col-span-5">
          <section aria-labelledby="incomes-title" className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="incomes-title" className="text-sm font-medium text-foreground">
                Entradas
              </h3>
              <span className="text-sm font-semibold tabular-nums text-emerald-400">
                {formatCentsToBrl(data.kpis.incomeCents)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Base do Dízimo (10%)</p>
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
                        <span className="shrink-0 tabular-nums text-emerald-400">{formatCentsToBrl(inc.amount_cents)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {creditCards.length > 0 && (
            <section aria-labelledby="cards-title" className="rounded-lg border border-border bg-card p-4">
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

          {data.members.length > 0 && (
            <section aria-labelledby="members-title" className="rounded-lg border border-border bg-card p-4">
              <h3 id="members-title" className="text-sm font-medium text-foreground">
                Gastos por pessoa
              </h3>
              <div className="mt-3 space-y-3">
                {data.members.map((m) => (
                  <div key={m.member} className="space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-foreground">{m.member}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCentsToBrl(m.expenseCents)} · {m.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        style={{ width: `${m.percent > 0 ? Math.min(100, Math.max(2, m.percent)) : 0}%` }}
                        className="h-full rounded-full bg-zinc-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 4. Gráficos do mês: evolução de 6 meses + distribuição por categoria */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MonthlyChart data={data.trend} currentMonth={month} />
        </div>
        <div className="lg:col-span-5">
          <CategoryBreakdown categoriesBreakdown={categoriesBreakdown} />
        </div>
      </div>
    </div>
  );
}
