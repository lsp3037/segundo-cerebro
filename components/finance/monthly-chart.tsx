"use client";

import { useId, useState } from "react";
import { BarChart3Icon, TrendingUpIcon } from "lucide-react";

import type { MonthlyPoint } from "@/lib/data/finance";
import { formatCentsToBrl } from "@/lib/money";

interface MonthlyChartProps {
  data: MonthlyPoint[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  // Encontra o valor máximo para dimensionar a escala
  const maxVal = Math.max(
    ...data.flatMap((d) => [d.incomeCents, d.expenseCents]),
    100000 // mínimo R$ 1.000 para não quebrar escala vazia
  );

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <BarChart3Icon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tendência dos Últimos 6 Meses</h3>
            <p className="text-xs text-muted-foreground">Comparativo de entradas e saídas</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Entradas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-500" />
            <span className="text-muted-foreground">Saídas</span>
          </div>
        </div>
      </div>

      {/* Grid de Barras */}
      <div className="mt-4 grid grid-cols-6 gap-2 sm:gap-4">
        {data.map((point, index) => {
          const incomeHeight = maxVal > 0 ? Math.min(100, Math.round((point.incomeCents / maxVal) * 100)) : 0;
          const expenseHeight = maxVal > 0 ? Math.min(100, Math.round((point.expenseCents / maxVal) * 100)) : 0;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={point.month}
              className="group relative flex flex-col items-center"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip flutuante no hover */}
              {isHovered && (
                <div className="pointer-events-none absolute -top-24 z-20 w-44 rounded-lg border border-border bg-popover/95 p-2 shadow-lg backdrop-blur-md text-xs">
                  <div className="font-semibold text-popover-foreground">{point.label}</div>
                  <div className="mt-1 flex items-center justify-between text-emerald-400">
                    <span>Entradas:</span>
                    <span className="font-mono tabular-nums">{formatCentsToBrl(point.incomeCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-400">
                    <span>Saídas:</span>
                    <span className="font-mono tabular-nums">{formatCentsToBrl(point.expenseCents)}</span>
                  </div>
                  <div className="mt-1 border-t border-border/50 pt-1 flex items-center justify-between font-medium">
                    <span className="text-muted-foreground">Líquido:</span>
                    <span
                      className={`font-mono tabular-nums ${
                        point.balanceCents >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCentsToBrl(point.balanceCents)}
                    </span>
                  </div>
                </div>
              )}

              {/* Área das Barras */}
              <div className="flex h-36 w-full items-end justify-center gap-1.5 rounded-lg bg-muted/20 px-1.5 py-2 transition-colors group-hover:bg-muted/40">
                {/* Barra de Entradas */}
                <div className="relative flex h-full w-full max-w-[20px] items-end justify-center">
                  <div
                    style={{ height: `${Math.max(4, incomeHeight)}%` }}
                    className="w-full rounded-t-sm bg-emerald-500/80 transition-all duration-300 group-hover:bg-emerald-400"
                  />
                </div>

                {/* Barra de Saídas */}
                <div className="relative flex h-full w-full max-w-[20px] items-end justify-center">
                  <div
                    style={{ height: `${Math.max(4, expenseHeight)}%` }}
                    className="w-full rounded-t-sm bg-rose-500/80 transition-all duration-300 group-hover:bg-rose-400"
                  />
                </div>
              </div>

              {/* Rótulo do Mês */}
              <span className="mt-2 text-center font-mono text-xs text-muted-foreground group-hover:text-foreground">
                {point.label.split("/")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
