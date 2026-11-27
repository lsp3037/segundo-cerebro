"use client";

import { useTransition } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  ExternalLinkIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { payPersonalBillAction } from "@/lib/actions/finance-api";
import type { UpcomingBill } from "@/lib/data/finance-family";
import { formatPercentPtBr } from "@/lib/finance/household";
import type { PersonalFinanceSummary } from "@/lib/integrations/finance-api";
import { formatCentsToBrl } from "@/lib/money";
import { monthNameLong } from "./getting-started";

interface PersonalSummaryPanelProps {
  month: string;
  summary: PersonalFinanceSummary;
  appUrl: string | null;
}

export function PersonalSummaryPanel({ month, summary, appUrl }: PersonalSummaryPanelProps) {
  const [isPending, startTransition] = useTransition();

  const handlePay = (bill: UpcomingBill) => {
    startTransition(async () => {
      const res = await payPersonalBillAction(bill.id, true);
      if (res.ok) toast.success(`"${bill.description}" pago!`);
      else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <WalletIcon className="size-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Finanças Pessoais · {monthNameLong(month)}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Resumo sincronizado com o app dedicado <strong className="text-foreground">Minhas Finanças</strong>.
          </p>
        </div>

        {appUrl && (
          <Button asChild size="sm" className="gap-1.5 bg-foreground text-background hover:bg-foreground/90">
            <a href={appUrl} target="_blank" rel="noopener noreferrer">
              <span>Abrir Minhas Finanças</span>
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </Button>
        )}
      </div>

      {summary.status === "not_configured" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Configure <code className="font-mono text-xs">FINANCE_API_URL</code> e{" "}
          <code className="font-mono text-xs">FINANCE_API_KEY</code> no ambiente para exibir o resumo pessoal aqui.
        </div>
      )}

      {summary.status === "error" && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {summary.message}
        </div>
      )}

      {summary.status === "ok" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Saldo previsto do mês</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  summary.kpis.projectedBalanceCents >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCentsToBrl(summary.kpis.projectedBalanceCents)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Poupança prevista: {formatPercentPtBr(summary.kpis.savingsRatePercent)}%
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUpIcon className="size-3.5 text-emerald-400" />
                <span>Entradas</span>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-400 tabular-nums">
                {formatCentsToBrl(summary.kpis.incomeCents)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Recebido {formatCentsToBrl(summary.kpis.paidIncomeCents)} · A receber{" "}
                {formatCentsToBrl(summary.kpis.pendingIncomeCents)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingDownIcon className="size-3.5 text-rose-400" />
                <span>Saídas</span>
              </div>
              <p className="mt-1 text-xl font-bold text-rose-400 tabular-nums">
                {formatCentsToBrl(summary.kpis.expenseCents)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Pago {formatCentsToBrl(summary.kpis.paidExpenseCents)} · Falta{" "}
                {formatCentsToBrl(summary.kpis.pendingExpenseCents)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {summary.upcoming.some((b) => b.billStatus === "overdue") ? (
                  <AlertTriangleIcon className="size-4 text-rose-400" />
                ) : (
                  <CheckCircle2Icon className="size-4 text-emerald-400" />
                )}
                <h3 className="text-sm font-semibold text-foreground">Contas pendentes (atrasadas e próximos 30 dias)</h3>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {summary.upcoming.length} {summary.upcoming.length === 1 ? "conta" : "contas"}
              </span>
            </div>

            {summary.upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conta pendente nos próximos 30 dias.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {summary.upcoming.map((b) => {
                  const isOverdue = b.billStatus === "overdue";
                  const dLabel = b.due_date ? `${b.due_date.slice(8)}/${b.due_date.slice(5, 7)}` : "Sem dia";
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{b.description}</p>
                        <p className={`text-xs ${isOverdue ? "font-medium text-rose-400" : "text-muted-foreground"}`}>
                          {isOverdue ? `Atrasada (${dLabel})` : `Vence ${dLabel}`}
                          {b.member_label ? ` · ${b.member_label}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCentsToBrl(b.amount_cents)}
                      </span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handlePay(b)}
                        title="Marcar como pago"
                        aria-label={`Marcar "${b.description}" como paga`}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-emerald-950 disabled:opacity-50"
                      >
                        <CheckIcon className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
