"use client";

import { useMemo, useState } from "react";

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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Distribuição por categoria
          </h3>
          <p className="text-xs text-muted-foreground">
            Participação no total do mês selecionado
          </p>
        </div>

        <div className="inline-flex h-8 items-center rounded-md border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setKind("expense")}
            className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
              kind === "expense"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Despesas
          </button>
          <button
            type="button"
            onClick={() => setKind("income")}
            className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
              kind === "income"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Receitas
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">
          Nenhuma transação de {kind === "expense" ? "despesa" : "receita"} registrada neste período.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {list.map((item) => {
            const barColor = item.color || (kind === "income" ? "#10b981" : "#f43f5e");
            const widthPct = item.percentage > 0 ? Math.min(100, Math.max(1, item.percentage)) : 0;

            return (
              <div key={item.categoryId ?? item.categoryName} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: barColor }} />
                    <span>{item.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-[11px] text-muted-foreground">{item.percentage}%</span>
                    <span className="font-medium text-foreground">{formatCentsToBrl(item.totalCents)}</span>
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: barColor,
                    }}
                    className="h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs font-medium">
            <span className="text-muted-foreground">
              Total de {kind === "expense" ? "despesas" : "receitas"}
            </span>
            <span
              className={`tabular-nums ${
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
