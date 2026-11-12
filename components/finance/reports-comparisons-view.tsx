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
            label: "Da renda, sobrou",
            value: `${data.kpis.savingsRatePercent}%`,
            tone: data.kpis.savingsRatePercent > 0 ? "positive" : data.kpis.savingsRatePercent < 0 ? "negative" : "default",
            subtext:
              data.previousKpis.incomeCents > 0 ? (
                <span className={savDelta > 0 ? "text-emerald-400" : savDelta < 0 ? "text-rose-400" : ""}>
                  {savDelta === 0
                    ? "igual ao mês passado"
                    : `${Math.abs(savDelta)} ${Math.abs(savDelta) === 1 ? "ponto" : "pontos"} a ${savDelta > 0 ? "mais" : "menos"} que no mês passado`}
                </span>
              ) : (
                `Sobra prevista: ${formatCentsToBrl(data.kpis.projectedBalanceCents)}`
              ),
          },
          {
            id: "fixed-commitment",
            label: "Contas fixas levam",
            value: `${data.kpis.fixedCommitmentPercent}%`,
            subtext: `da renda · fixas ${formatCentsToBrl(data.kpis.fixedExpenseCents)}, do dia a dia ${formatCentsToBrl(variableCents)}`,
          },
          {
            id: "burn-rate",
            label: "Gasto por dia",
            value: formatCentsToBrl(data.kpis.dailyBurnCents),
            subtext: "média dos gastos do mês",
          },
        ]}
      />

      {/* Comparativo entre Períodos + Tendência 6 Meses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-7">
          <div className="border-b border-border/70 pb-3">
            <h3 className="text-sm font-medium text-foreground">Gastos por categoria, mês a mês</h3>
            <p className="text-xs text-muted-foreground">Este mês comparado com o mês passado e com a média dos últimos 3</p>
          </div>

          {data.comparison.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted-foreground">Ainda não há meses suficientes para comparar.</div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 text-xs font-medium text-muted-foreground">
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="px-2 py-2 text-right">Este mês</th>
                    <th className="px-2 py-2 text-right">Mês passado</th>
                    <th className="px-2 py-2 text-right">Média de 3 meses</th>
                    <th className="pl-2 py-2 text-right">Mudou</th>
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
                          <span className={`inline-block rounded border px-1.5 py-0.5 text-xs tabular-nums ${badgeClass}`}>
                            {ch === null ? "—" : ch === 0 ? "igual" : `${ch > 0 ? "↑" : "↓"} ${Math.abs(ch)}%`}
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
