"use client";

import { useMemo, useState } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, PieChartIcon } from "lucide-react";

import { formatCentsToBrl } from "@/lib/money";

interface CategoryBreakdownProps {
  categoriesBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    color: string | null;
    kind: "income" | "expense";
    totalCents: number;
    percentage: number;
  }>;
}

export function CategoryBreakdown({ categoriesBreakdown }: CategoryBreakdownProps) {
  const [kind, setKind] = useState<"expense" | "income">("expense");

  const list = useMemo(() => {
    return categoriesBreakdown.filter((c) => c.kind === kind);
  }, [categoriesBreakdown, kind]);

  const totalCents = useMemo(() => {
    return list.reduce((acc, c) => acc + c.totalCents, 0);
  }, [list]);

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <PieChartIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Distribuição por Categoria</h3>
            <p className="text-xs text-muted-foreground">Proporção dos recursos no período</p>
          </div>
        </div>

        {/* Toggle Despesas vs Receitas */}
        <div className="inline-flex rounded-lg bg-muted/40 p-0.5 border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => setKind("expense")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              kind === "expense"
                ? "bg-rose-500/20 text-rose-400 font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownRightIcon className="size-3" />
            Despesas
          </button>
          <button
            type="button"
            onClick={() => setKind("income")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              kind === "income"
                ? "bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpRightIcon className="size-3" />
            Receitas
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Nenhuma transação de {kind === "expense" ? "despesa" : "receita"} registrada neste período.
        </div>
      ) : (
        <div className="mt-4 space-y-3.5">
          {list.map((item) => {
            const barColor = item.color || (kind === "income" ? "#10b981" : "#f43f5e");

            return (
              <div key={item.categoryId ?? item.categoryName} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: barColor }} />
                    <span>{item.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-muted-foreground text-[11px]">{item.percentage}%</span>
                    <span className="font-semibold text-foreground">{formatCentsToBrl(item.totalCents)}</span>
                  </div>
                </div>

                {/* Barra de Progresso com Cor da Categoria */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(1, item.percentage))}%`,
                      backgroundColor: barColor,
                    }}
                    className="h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs font-semibold">
            <span className="text-muted-foreground">Total de {kind === "expense" ? "Despesas" : "Receitas"}:</span>
            <span
              className={`font-mono text-sm tabular-nums ${
                kind === "income" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatCentsToBrl(totalCents)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
