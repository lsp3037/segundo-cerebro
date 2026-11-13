"use client";

import { useMemo, useState } from "react";

import type { MonthlyPoint } from "@/lib/data/finance";
import { formatPercentPtBr } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";

interface MonthlyChartProps {
  data: MonthlyPoint[];
  currentMonth?: string;
  onSelectMonth?: (month: string) => void;
}

export function MonthlyChart({ data, currentMonth, onSelectMonth }: MonthlyChartProps) {
  const defaultIdx = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const found = currentMonth ? data.findIndex((d) => d.month === currentMonth) : -1;
    return found >= 0 ? found : data.length - 1;
  }, [data, currentMonth]);

  const [inspectedIdx, setInspectedIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const activeIdx =
    inspectedIdx !== null && inspectedIdx < data.length ? inspectedIdx : defaultIdx;
  const activePoint = data[activeIdx] ?? data[data.length - 1];

  const peakCents = Math.max(...data.flatMap((d) => [d.incomeCents, d.expenseCents]));
  const scaleMaxCents = peakCents > 0 ? peakCents : 100000;
  const activeMonths = data.filter((d) => d.incomeCents > 0 || d.expenseCents > 0);
  const monthsWithData = activeMonths.length;

  const avgExpenseCents =
    monthsWithData > 0
      ? Math.round(activeMonths.reduce((acc, d) => acc + d.expenseCents, 0) / monthsWithData)
      : 0;
  const avgPct =
    avgExpenseCents > 0
      ? Math.max(6, Math.min(94, Math.round((avgExpenseCents / scaleMaxCents) * 100)))
      : 0;

  if (monthsWithData === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Últimos 6 meses</h3>
        <p className="mt-2 text-[13px] text-muted-foreground">
          O gráfico de entradas e saídas aparece assim que houver lançamentos no período.
        </p>
      </div>
    );
  }

  const activeSavingsRate =
    activePoint.incomeCents > 0
      ? Math.round(((activePoint.incomeCents - activePoint.expenseCents) / activePoint.incomeCents) * 1000) / 10
      : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Evolução dos últimos 6 meses</h3>
          <p className="text-xs text-muted-foreground">
            {monthsWithData === 1
              ? "Histórico inicial · novos meses entram conforme os lançamentos"
              : "Toque ou clique em um mês para comparar"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {avgExpenseCents > 0 && (
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 tabular-nums text-muted-foreground">
              Média saídas: {formatCentsToBrl(avgExpenseCents)}
            </span>
          )}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              Entradas
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-rose-500" />
              Saídas
            </span>
          </div>
        </div>
      </div>

      {/* Área das barras com linha tracejada de média de gastos posicionada sem colidir */}
      <div className="relative mt-1 pl-0 sm:pl-20">
        {avgExpenseCents > 0 && (
          <div
            style={{ bottom: `calc(${avgPct}% + 22px)` }}
            className="pointer-events-none absolute right-0 left-0 z-0 hidden border-t border-dashed border-border/80 sm:flex sm:items-center"
          >
            <span className="-translate-y-1/2 bg-card pr-2 text-[11px] tabular-nums text-muted-foreground">
              Média {formatCentsToBrl(avgExpenseCents)}
            </span>
          </div>
        )}

        <div className="relative z-10 grid grid-cols-6 gap-1.5 sm:gap-2.5">
          {data.map((point, index) => {
            const incomePct =
              point.incomeCents > 0
                ? Math.max(4, Math.min(100, Math.round((point.incomeCents / scaleMaxCents) * 100)))
                : 0;
            const expensePct =
              point.expenseCents > 0
                ? Math.max(4, Math.min(100, Math.round((point.expenseCents / scaleMaxCents) * 100)))
                : 0;
            const isSelected = activeIdx === index;
            const isCurrentRouteMonth = currentMonth === point.month;

            return (
              <button
                key={point.month}
                type="button"
                onMouseEnter={() => setInspectedIdx(index)}
                onFocus={() => setInspectedIdx(index)}
                onClick={() => {
                  setInspectedIdx(index);
                  if (onSelectMonth && point.month !== currentMonth && isSelected) {
                    onSelectMonth(point.month);
                  }
                }}
                onDoubleClick={() => onSelectMonth?.(point.month)}
                aria-pressed={isSelected}
                aria-label={`${point.label}: entradas ${formatCentsToBrl(point.incomeCents)}, saídas ${formatCentsToBrl(point.expenseCents)}`}
                className={`group flex cursor-pointer flex-col items-center rounded-lg border px-1 pt-2 pb-1.5 transition-colors ${
                  isSelected
                    ? "border-border bg-muted/40"
                    : "border-transparent bg-muted/10 hover:border-border/60 hover:bg-muted/25"
                }`}
              >
                <div className="flex h-24 w-full items-end justify-center gap-1 sm:gap-1.5">
                  <div
                    style={{ height: `${incomePct}%` }}
                    className={`w-2.5 rounded-t-[3px] transition-[height,background-color] duration-300 ease-out sm:w-3.5 ${
                      isSelected ? "bg-emerald-500" : "bg-emerald-500/75 group-hover:bg-emerald-400"
                    }`}
                  />
                  <div
                    style={{ height: `${expensePct}%` }}
                    className={`w-2.5 rounded-t-[3px] transition-[height,background-color] duration-300 ease-out sm:w-3.5 ${
                      isSelected ? "bg-rose-500" : "bg-rose-500/75 group-hover:bg-rose-400"
                    }`}
                  />
                </div>

                <span
                  className={`mt-1.5 text-center text-xs tabular-nums ${
                    isSelected || isCurrentRouteMonth
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {point.label.split("/")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Faixa fixa de leitura (funciona igualmente em desktop, teclado e celular) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/25 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-semibold text-foreground">{activePoint.label}:</span>
          <span className="text-muted-foreground">
            Entradas <span className="font-medium tabular-nums text-emerald-400">{formatCentsToBrl(activePoint.incomeCents)}</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Saídas <span className="font-medium tabular-nums text-rose-400">{formatCentsToBrl(activePoint.expenseCents)}</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`font-semibold tabular-nums ${
              activePoint.balanceCents >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            Saldo {formatCentsToBrl(activePoint.balanceCents)}
            {activePoint.incomeCents > 0 ? ` (${formatPercentPtBr(activeSavingsRate)}%)` : ""}
          </span>
          {onSelectMonth && activePoint.month !== currentMonth && (
            <button
              type="button"
              onClick={() => onSelectMonth(activePoint.month)}
              className="cursor-pointer rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              Abrir mês
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
