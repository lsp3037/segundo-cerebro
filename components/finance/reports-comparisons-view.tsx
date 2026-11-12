"use client";

import type { HouseholdData } from "@/lib/data/finance-family";
import { formatCentsToBrl } from "@/lib/money";

interface ReportsComparisonsViewProps {
  data: HouseholdData;
}

export function ReportsComparisonsView({ data }: ReportsComparisonsViewProps) {
  const savDelta = Math.round((data.kpis.savingsRatePercent - data.previousKpis.savingsRatePercent) * 10) / 10;
  const maxTrend = Math.max(...data.trend.flatMap((p) => [p.incomeCents, p.expenseCents]), 100000);
  const variableCents = data.kpis.expenseCents - data.kpis.fixedExpenseCents;

  return (
    <div className="space-y-5">
      {/* 3 KPIs Analíticos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Taxa de Poupança</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              KPI
            </span>
          </div>
          <div className={`mt-2.5 font-mono text-2xl font-bold tabular-nums ${data.kpis.savingsRatePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {data.kpis.savingsRatePercent}%
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Sobra: {formatCentsToBrl(data.kpis.projectedBalanceCents)}</span>
            {data.previousKpis.incomeCents > 0 && (
              <span className={savDelta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {savDelta >= 0 ? "+" : ""}{savDelta} p.p. MoM
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Comprometimento Fixo da Renda</span>
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px]">Fixo vs Var.</span>
          </div>
          <div className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-foreground">
            {data.kpis.fixedCommitmentPercent}%
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Com vencimento: {formatCentsToBrl(data.kpis.fixedExpenseCents)}</span>
            <span>Variáveis: {formatCentsToBrl(variableCents)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Custo Diário Médio (Burn Rate)</span>
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px]">Mês</span>
          </div>
          <div className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-foreground">
            {formatCentsToBrl(data.kpis.dailyBurnCents)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Média por dia corrido sobre as saídas</p>
        </div>
      </div>

      {/* Comparativo entre Períodos + Tendência 6 Meses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 lg:col-span-7">
          <div className="border-b border-border/50 pb-3">
            <h3 className="text-sm font-semibold text-foreground">Comparativo entre Períodos</h3>
            <p className="text-xs text-muted-foreground">Mês selecionado vs. mês anterior vs. média dos últimos 3 meses</p>
          </div>

          {data.comparison.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Sem dados suficientes para comparar ainda.</div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="px-2 py-2 text-right">Atual</th>
                    <th className="px-2 py-2 text-right">Anterior</th>
                    <th className="px-2 py-2 text-right">Média 3M</th>
                    <th className="pl-2 py-2 text-right">MoM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
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
                        <td className="px-2 py-2.5 text-right font-mono font-semibold tabular-nums">{formatCentsToBrl(row.currentCents)}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-muted-foreground tabular-nums">{formatCentsToBrl(row.previousCents)}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-muted-foreground tabular-nums">{formatCentsToBrl(row.average3Cents)}</td>
                        <td className="pl-2 py-2.5 text-right">
                          <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums ${badgeClass}`}>
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

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 lg:col-span-5">
          <div className="border-b border-border/50 pb-3">
            <h3 className="text-sm font-semibold text-foreground">Tendência 6 Meses (Entradas &times; Saídas)</h3>
            <p className="text-xs text-muted-foreground">Evolução mensal da sobra da casa</p>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2">
            {data.trend.map((pt, idx) => {
              const inH = Math.max(4, Math.round((pt.incomeCents / maxTrend) * 100));
              const outH = Math.max(4, Math.round((pt.expenseCents / maxTrend) * 100));
              const isSelected = idx === data.trend.length - 1;
              return (
                <div key={pt.month} className="flex flex-col items-center gap-1.5" title={`${pt.label}: +${formatCentsToBrl(pt.incomeCents)} / -${formatCentsToBrl(pt.expenseCents)}`}>
                  <div className={`flex h-36 w-full items-end justify-center gap-1 rounded-lg bg-muted/20 px-1 py-2 ${isSelected ? "border border-emerald-500/40" : ""}`}>
                    <div style={{ height: `${inH}%` }} className="w-3 rounded-t-sm bg-emerald-500/80" />
                    <div style={{ height: `${outH}%` }} className="w-3 rounded-t-sm bg-rose-500/80" />
                  </div>
                  <span className={`text-[11px] ${isSelected ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Entradas</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />Saídas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
