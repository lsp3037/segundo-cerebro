"use client";

import { useState } from "react";

import type { MonthlyPoint } from "@/lib/data/finance";
import { formatCentsToBrl } from "@/lib/money";

interface MonthlyChartProps {
  data: MonthlyPoint[];
  currentMonth?: string;
}

export function MonthlyChart({ data, currentMonth }: MonthlyChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const peakCents = Math.max(...data.flatMap((d) => [d.incomeCents, d.expenseCents]));
  const scaleMaxCents = peakCents > 0 ? peakCents : 100000;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Tendência dos últimos 6 meses
          </h3>
          <p className="text-xs text-muted-foreground">
            Comparativo mensal de entradas e saídas
            {peakCents > 0 ? ` · Topo ${formatCentsToBrl(peakCents)}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Entradas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            <span className="text-muted-foreground">Saídas</span>
          </div>
        </div>
      </div>

      {/* Grid de Barras com linha de base honesta */}
      <div className="mt-4 grid grid-cols-6 gap-2 sm:gap-4">
        {data.map((point, index) => {
          const incomePct =
            point.incomeCents > 0
              ? Math.max(3, Math.min(100, Math.round((point.incomeCents / scaleMaxCents) * 100)))
              : 0;
          const expensePct =
            point.expenseCents > 0
              ? Math.max(3, Math.min(100, Math.round((point.expenseCents / scaleMaxCents) * 100)))
              : 0;
          const isHovered = hoveredIndex === index;
          const isSelectedMonth = currentMonth
            ? point.month === currentMonth
            : index === data.length - 1;

          return (
            <div
              key={point.month}
              className="group relative flex flex-col items-center"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {isHovered && (
                <div className="pointer-events-none absolute -top-24 z-20 w-44 rounded-md border border-border bg-popover p-2.5 text-xs shadow-lg">
                  <div className="font-medium text-popover-foreground">{point.label}</div>
                  <div className="mt-1 flex items-center justify-between text-emerald-400">
                    <span>Entradas:</span>
                    <span className="tabular-nums">{formatCentsToBrl(point.incomeCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-400">
                    <span>Saídas:</span>
                    <span className="tabular-nums">{formatCentsToBrl(point.expenseCents)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1 font-medium">
                    <span className="text-muted-foreground">Líquido:</span>
                    <span
                      className={`tabular-nums ${
                        point.balanceCents >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCentsToBrl(point.balanceCents)}
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`flex h-36 w-full items-end justify-center gap-1.5 rounded-md border-b border-border bg-muted/15 px-1.5 pt-2 transition-colors group-hover:bg-muted/30 ${
                  isSelectedMonth ? "ring-1 ring-inset ring-foreground/20" : ""
                }`}
              >
                <div className="relative flex h-full w-full max-w-[18px] items-end justify-center">
                  <div
                    style={{ height: `${incomePct}%` }}
                    className="w-full rounded-t-[2px] bg-emerald-500/85 transition-colors group-hover:bg-emerald-400"
                  />
                </div>

                <div className="relative flex h-full w-full max-w-[18px] items-end justify-center">
                  <div
                    style={{ height: `${expensePct}%` }}
                    className="w-full rounded-t-[2px] bg-rose-500/85 transition-colors group-hover:bg-rose-400"
                  />
                </div>
              </div>

              <span
                className={`mt-2 text-center text-[11px] tabular-nums ${
                  isSelectedMonth
                    ? "font-medium text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {point.label.split("/")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
