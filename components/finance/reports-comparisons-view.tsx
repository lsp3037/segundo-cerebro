"use client";

import { FlameIcon, PercentIcon, RepeatIcon } from "lucide-react";

import type { FinanceSummary } from "@/lib/data/finance";
import type { HouseholdData } from "@/lib/data/finance-family";
import { formatPercentPtBr } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";
import { CategoryBreakdown } from "./category-breakdown";
import { FinanceKpiStrip } from "./finance-hierarchy";
import { MonthlyChart } from "./monthly-chart";
import { AnimatedBrl, AnimatedPercent } from "./transitions";

interface ReportsComparisonsViewProps {
  data: HouseholdData;
  categoriesBreakdown: FinanceSummary["categoriesBreakdown"];
  currentMonth: string;
  onSelectMonth?: (month: string) => void;
}

export function ReportsComparisonsView({
  data,
  categoriesBreakdown,
  currentMonth,
  onSelectMonth,
}: ReportsComparisonsViewProps) {
  const savDelta = Math.round((data.kpis.savingsRatePercent - data.previousKpis.savingsRatePercent) * 10) / 10;
  const variableCents = Math.max(0, data.kpis.expenseCents - data.kpis.fixedExpenseCents);

  return (
    <div className="space-y-5">
      <FinanceKpiStrip
        columns={3}
        items={[
          {
            id: "savings-rate",
            label: "Taxa de poupança",
            icon: <PercentIcon className="size-3.5 text-emerald-400" />,
            value: <AnimatedPercent value={data.kpis.savingsRatePercent} resetKey={currentMonth} />,
            tone: data.kpis.savingsRatePercent > 0 ? "positive" : data.kpis.savingsRatePercent < 0 ? "negative" : "default",
            subtext:
              data.previousKpis.incomeCents > 0 ? (
                <span className={savDelta > 0 ? "text-emerald-400" : savDelta < 0 ? "text-rose-400" : ""}>
                  {savDelta === 0
                    ? "igual ao mês passado"
                    : `${formatPercentPtBr(Math.abs(savDelta))} p.p. a ${savDelta > 0 ? "mais" : "menos"} que no mês passado`}
                </span>
              ) : (
                `Saldo previsto: ${formatCentsToBrl(data.kpis.projectedBalanceCents)}`
              ),
          },
          {
            id: "fixed-commitment",
            label: "Contas fixas levam",
            icon: <RepeatIcon className="size-3.5 text-muted-foreground" />,
            value: <AnimatedPercent value={data.kpis.fixedCommitmentPercent} resetKey={currentMonth} />,
            subtext: `da renda · fixas ${formatCentsToBrl(data.kpis.fixedExpenseCents)}, variáveis ${formatCentsToBrl(variableCents)}`,
          },
          {
            id: "burn-rate",
            label: "Gasto por dia",
            icon: <FlameIcon className="size-3.5 text-amber-400" />,
            value: <AnimatedBrl cents={data.kpis.dailyBurnCents} resetKey={currentMonth} />,
            subtext: "média diária das saídas no mês",
          },
        ]}
      />

      {/* Comparativo intermensal profundo + Tendência 6 Meses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-7">
          <div className="border-b border-border/70 pb-3">
            <h3 className="text-sm font-medium text-foreground">Gastos por categoria, mês a mês</h3>
            <p className="text-xs text-muted-foreground">Este mês comparado com o mês passado e com a média dos últimos 3 meses</p>
          </div>

          {data.comparison.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted-foreground">Ainda não há meses suficientes para comparar.</div>
          ) : (
            <>
              {/* Visualização compacta em cards para mobile */}
              <div className="mt-2 divide-y divide-border/60 sm:hidden">
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
                    <div key={row.categoryId ?? row.categoryName} className="space-y-1 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">{row.categoryName}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {formatCentsToBrl(row.currentCents)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span className="tabular-nums">
                          Ant: {formatCentsToBrl(row.previousCents)} · Méd 3M: {formatCentsToBrl(row.average3Cents)}
                        </span>
                        <span className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[11px] tabular-nums ${badgeClass}`}>
                          {ch === null ? "—" : ch === 0 ? "igual" : `${ch > 0 ? "↑" : "↓"} ${formatPercentPtBr(Math.abs(ch))}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela completa no desktop */}
              <div className="mt-2 hidden overflow-x-auto sm:block">
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
                        <tr key={row.categoryId ?? row.categoryName} className="transition-colors hover:bg-muted/20">
                          <td className="py-2.5 pr-3 font-medium text-foreground">{row.categoryName}</td>
                          <td className="px-2 py-2.5 text-right font-medium tabular-nums">{formatCentsToBrl(row.currentCents)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{formatCentsToBrl(row.previousCents)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{formatCentsToBrl(row.average3Cents)}</td>
                          <td className="pl-2 py-2.5 text-right">
                            <span className={`inline-block rounded border px-1.5 py-0.5 text-xs tabular-nums ${badgeClass}`}>
                              {ch === null ? "—" : ch === 0 ? "igual" : `${ch > 0 ? "↑" : "↓"} ${formatPercentPtBr(Math.abs(ch))}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <MonthlyChart data={data.trend} currentMonth={currentMonth} onSelectMonth={onSelectMonth} />
          <CategoryBreakdown categoriesBreakdown={categoriesBreakdown} />
        </div>
      </div>
    </div>
  );
}
