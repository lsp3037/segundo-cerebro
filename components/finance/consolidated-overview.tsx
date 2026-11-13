"use client";

import type { FinanceSummary } from "@/lib/data/finance";
import { formatCentsToBrl } from "@/lib/money";
import { FinanceHero, FinanceKpiStrip, signedResult } from "./finance-hierarchy";
import { MonthlyChart } from "./monthly-chart";
import { AnimatedBrl } from "./transitions";

interface ConsolidatedOverviewProps {
  summary: FinanceSummary;
  currentMonth: string;
}

export function ConsolidatedOverview({
  summary,
  currentMonth,
}: ConsolidatedOverviewProps) {
  const { pessoal, trustcare } = summary.ledgerSplit;
  const totalPendingCents =
    pessoal.pendingExpenseCents + trustcare.pendingExpenseCents;

  return (
    <div className="space-y-5">
      <FinanceHero
        eyebrow="Pessoal + Trust Care: resultado do mês"
        value={<AnimatedBrl cents={summary.netBalanceCents} signed resetKey={currentMonth} />}
        tone={signedResult(summary.netBalanceCents).tone}
        subtitle={
          <span className="tabular-nums">
            Entradas {formatCentsToBrl(summary.totalIncomeCents)} − Saídas{" "}
            {formatCentsToBrl(summary.totalExpenseCents)} ·{" "}
            {summary.transactionCount}{" "}
            {summary.transactionCount === 1 ? "lançamento" : "lançamentos"}
            {totalPendingCents > 0 && (
              <> · Pendente {formatCentsToBrl(totalPendingCents)}</>
            )}
          </span>
        }
      />

      <FinanceKpiStrip
        columns={2}
        items={[
          {
            id: "pessoal",
            label: "Pessoal",
            value: <AnimatedBrl cents={pessoal.netCents} signed resetKey={currentMonth} />,
            tone: signedResult(pessoal.netCents).tone,
            badge: (
              <span className="text-xs tabular-nums text-muted-foreground">
                {pessoal.transactionCount} itens
              </span>
            ),
            subtext: (
              <span className="tabular-nums">
                Entradas{" "}
                <strong className="font-medium text-foreground">
                  {formatCentsToBrl(pessoal.incomeCents)}
                </strong>{" "}
                · Saídas{" "}
                <strong className="font-medium text-foreground">
                  {formatCentsToBrl(pessoal.expenseCents)}
                </strong>
                {pessoal.pendingExpenseCents > 0 && (
                  <>
                    {" "}
                    · Pend.{" "}
                    <strong className="font-medium text-amber-400">
                      {formatCentsToBrl(pessoal.pendingExpenseCents)}
                    </strong>
                  </>
                )}
              </span>
            ),
          },
          {
            id: "trustcare",
            label: "Trust Care",
            value: <AnimatedBrl cents={trustcare.netCents} signed resetKey={currentMonth} />,
            tone: signedResult(trustcare.netCents).tone,
            badge: (
              <span className="text-xs tabular-nums text-muted-foreground">
                {trustcare.transactionCount} itens
              </span>
            ),
            subtext: (
              <span className="tabular-nums">
                Entradas{" "}
                <strong className="font-medium text-foreground">
                  {formatCentsToBrl(trustcare.incomeCents)}
                </strong>{" "}
                · Saídas{" "}
                <strong className="font-medium text-foreground">
                  {formatCentsToBrl(trustcare.expenseCents)}
                </strong>
                {trustcare.pendingExpenseCents > 0 && (
                  <>
                    {" "}
                    · Pend.{" "}
                    <strong className="font-medium text-amber-400">
                      {formatCentsToBrl(trustcare.pendingExpenseCents)}
                    </strong>
                  </>
                )}
              </span>
            ),
          },
        ]}
      />

      <MonthlyChart data={summary.monthlyTrend} currentMonth={currentMonth} />
    </div>
  );
}
