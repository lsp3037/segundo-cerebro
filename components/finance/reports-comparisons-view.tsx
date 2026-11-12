"use client";

import type { FinanceSummary } from "@/lib/data/finance";
import type { HouseholdData } from "@/lib/data/finance-family";
import { formatCentsToBrl } from "@/lib/money";
import { CategoryBreakdown } from "./category-breakdown";
import { FinanceKpiStrip } from "./finance-hierarchy";
import { MonthlyChart } from "./monthly-chart";

interface ReportsComparisonsViewProps {
  data: HouseholdData;
  categoriesBreakdown: FinanceSummary["categoriesBreakdown"];
  currentMonth: string;
}

export function ReportsComparisonsView({
  data,
  categoriesBreakdown,
  currentMonth,
}: ReportsComparisonsViewProps) {
  const savDelta = Math.round((data.kpis.savingsRatePercent - data.previousKpis.savingsRatePercent) * 10) / 10;
  const variableCents = data.kpis.expenseCents - data.kpis.fixedExpenseCents;

  return (
    <div className="space-y-5">
      <FinanceKpiStrip
        columns={3}
        items={[
          {
            id: "savings-rate",
            label: "Taxa de poupança",
            value: `${data.kpis.savingsRatePercent}%`,
            tone: data.kpis.savingsRatePercent >= 0 ? "positive" : "negative",
            badge:
              data.previousKpis.incomeCents > 0 ? (
                <span className={`text-[11px] tabular-nums ${savDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {savDelta >= 0 ? "+" : ""}{savDelta} p.p. MoM
                </span>
              ) : undefined,
            subtext: `Sobra projetada: ${formatCentsToBrl(data.kpis.projectedBalanceCents)}`,
          },
          {
            id: "fixed-commitment",
            label: "Comprometimento fixo",
            value: `${data.kpis.fixedCommitmentPercent}%`,
            subtext: `Fixas ${formatCentsToBrl(data.kpis.fixedExpenseCents)} · Var. ${formatCentsToBrl(variableCents)}`,
          },
          {
            id: "burn-rate",
            label: "Custo diário médio",
            value: formatCentsToBrl(data.kpis.dailyBurnCents),
            subtext: "Média diária sobre as saídas do mês",
          },
        ]}
      />

      {/* Comparativo entre Períodos + Tendência 6 Meses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-7">
          <div className="border-b border-border/70 pb-3">
            <h3 className="text-sm font-medium text-foreground">Comparativo entre períodos</h3>
            <p className="text-xs text-muted-foreground">Mês selecionado vs. mês anterior vs. média de 3 meses</p>
          </div>

          {data.comparison.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Sem dados suficientes para comparar ainda.</div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] font-medium text-muted-foreground">
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="px-2 py-2 text-right">Atual</th>
                    <th className="px-2 py-2 text-right">Anterior</th>
                    <th className="px-2 py-2 text-right">Média 3M</th>
                    <th className="pl-2 py-2 text-right">MoM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.comparison.map((row) => {
                    const ch = row.changePercent;
                    const badgeClass =
                      ch === null
                        ? "border-border bg-muted/40 text-muted-foreground"
                        : ch <= 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : ch >= 15
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400";

                    return (
                      <tr key={row.categoryId ?? row.categoryName}>
                        <td className="py-2.5 pr-3 font-medium text-foreground">{row.categoryName}</td>
                        <td className="px-2 py-2.5 text-right font-medium tabular-nums">{formatCentsToBrl(row.currentCents)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{formatCentsToBrl(row.previousCents)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{formatCentsToBrl(row.average3Cents)}</td>
                        <td className="pl-2 py-2.5 text-right">
                          <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] tabular-nums ${badgeClass}`}>
                            {ch === null ? "—" : `${ch > 0 ? "+" : ""}${ch}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <MonthlyChart data={data.trend} currentMonth={currentMonth} />
        </div>
      </div>

      <CategoryBreakdown categoriesBreakdown={categoriesBreakdown} />
    </div>
  );
}
