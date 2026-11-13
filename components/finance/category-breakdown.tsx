"use client";

import { useMemo, useState } from "react";

import { formatCentsToBrl } from "@/lib/money";
import { SoftText } from "./transitions";

interface CategoryBreakdownProps {
  categoriesBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    color: string | null;
    kind: "income" | "expense";
    totalCents: number;
    percentage: number;
  }>;
  compact?: boolean;
}

const FALLBACK_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#f43f5e", "#a1a1aa", "#14b8a6"];

function compactBrl(cents: number): string {
  const val = cents / 100;
  if (val >= 1000) {
    return `R$ ${(val / 1000).toFixed(1).replace(".", ",")}k`;
  }
  return formatCentsToBrl(cents);
}

/** Constrói setores de anel SVG com vãos paralelos e cantos suavizados (transitions-dev #35). */
function donutArcPath(
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  a0: number,
  a1: number,
  gap: number,
  cr: number,
): string {
  const Ro = ro - cr;
  const Ri = ri + cr;
  if (Ro <= Ri) return "";
  const h = gap / 2 + cr;
  const dO = Math.asin(Math.min(1, h / Ro));
  const dI = Math.asin(Math.min(1, h / Ri));
  const o0 = a0 + dO;
  const o1 = a1 - dO;
  const i0 = a0 + dI;
  const i1 = a1 - dI;
  if (o1 - o0 <= 0.01 || i1 - i0 <= 0.01) return "";
  const pt = (r: number, a: number) =>
    `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  const large = o1 - o0 > Math.PI ? 1 : 0;
  return `M ${pt(Ro, o0)} A ${Ro} ${Ro} 0 ${large} 1 ${pt(Ro, o1)} L ${pt(Ri, i1)} A ${Ri} ${Ri} 0 ${large} 0 ${pt(Ri, i0)} Z`;
}

export function CategoryBreakdown({ categoriesBreakdown, compact = false }: CategoryBreakdownProps) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const list = useMemo(() => {
    return categoriesBreakdown.filter((c) => c.kind === kind);
  }, [categoriesBreakdown, kind]);

  const totalCents = useMemo(() => {
    return list.reduce((acc, c) => acc + c.totalCents, 0);
  }, [list]);

  // Agrupa além das 5 primeiras categorias no donut para manter legibilidade visual
  const donutSlices = useMemo(() => {
    if (list.length === 0 || totalCents <= 0) return [];
    const top = list.slice(0, 5);
    const rest = list.slice(5);
    const slices = top.map((item, idx) => ({
      key: item.categoryId ?? item.categoryName,
      name: item.categoryName,
      totalCents: item.totalCents,
      percentage: item.percentage,
      color: item.color || (kind === "income" ? "#10b981" : FALLBACK_COLORS[idx % FALLBACK_COLORS.length]),
    }));
    if (rest.length > 0) {
      const restCents = rest.reduce((acc, c) => acc + c.totalCents, 0);
      slices.push({
        key: "outros",
        name: "Outras",
        totalCents: restCents,
        percentage: Math.round((restCents / totalCents) * 100),
        color: "#71717a",
      });
    }

    let angle = 0;
    const isSingle = slices.length === 1;
    return slices.map((s) => {
      const sweep = (s.totalCents / totalCents) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      return {
        ...s,
        path: isSingle
          ? ""
          : donutArcPath(60, 60, 55, 37, a0, a1, 3, 2),
        isSingle,
      };
    });
  }, [list, totalCents, kind]);

  const activeSlice = hoveredIdx !== null ? donutSlices[hoveredIdx] ?? null : null;
  const visibleRows = useMemo(() => {
    if (compact) {
      return donutSlices.slice(0, 5).map((s) => ({
        key: s.key,
        name: s.name,
        color: s.color,
        totalCents: s.totalCents,
        percentage: s.percentage,
      }));
    }
    return list.map((item, idx) => ({
      key: item.categoryId ?? item.categoryName,
      name: item.categoryName,
      color: item.color || (kind === "income" ? "#10b981" : FALLBACK_COLORS[idx % FALLBACK_COLORS.length]),
      totalCents: item.totalCents,
      percentage: item.percentage,
    }));
  }, [compact, donutSlices, list, kind]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {kind === "expense" ? "Saídas por categoria" : "Receitas por categoria"}
          </h3>
          <p className="text-xs text-muted-foreground">Participação no mês selecionado</p>
        </div>

        <div className="inline-flex h-7 items-center rounded-md border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setKind("expense");
              setHoveredIdx(null);
            }}
            className={`h-6 cursor-pointer rounded-sm px-2 text-xs font-medium transition-colors ${
              kind === "expense"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Despesas
          </button>
          <button
            type="button"
            onClick={() => {
              setKind("income");
              setHoveredIdx(null);
            }}
            className={`h-6 cursor-pointer rounded-sm px-2 text-xs font-medium transition-colors ${
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
        <div className="py-8 text-center text-xs text-muted-foreground">
          Nenhuma transação de {kind === "expense" ? "despesa" : "receita"} registrada neste período.
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Donut Chart (transitions-dev #35) */}
          <div className="t-donut mx-auto sm:mx-0" style={{ width: 118, height: 118 }}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              {donutSlices.map((slice, idx) =>
                slice.isSingle ? (
                  <circle
                    key={slice.key}
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="16"
                    className={`t-donut-seg ${hoveredIdx !== null && hoveredIdx !== idx ? "is-dim" : ""}`}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                ) : (
                  <path
                    key={slice.key}
                    d={slice.path}
                    fill={slice.color}
                    stroke={slice.color}
                    strokeWidth={4}
                    className={`t-donut-seg cursor-pointer ${hoveredIdx !== null && hoveredIdx !== idx ? "is-dim" : ""}`}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                ),
              )}
            </svg>
            <div className="t-donut-center px-2">
              <SoftText
                text={compactBrl(activeSlice ? activeSlice.totalCents : totalCents)}
                className="justify-self-center text-[13px] font-bold tabular-nums text-foreground"
              />
              <span className="truncate text-[11px] text-muted-foreground">
                {activeSlice ? `${activeSlice.percentage}%` : "Total"}
              </span>
            </div>
          </div>

          {/* Lista compacta com barras e foco sincronizado com o donut */}
          <div className="min-w-0 flex-1 space-y-2">
            {visibleRows.map((item) => {
              const barColor = item.color;
              const widthPct = item.percentage > 0 ? Math.min(100, Math.max(2, item.percentage)) : 0;
              const sliceIdx = donutSlices.findIndex((s) => s.key === item.key || s.name === item.name);

              return (
                <div
                  key={item.key}
                  onMouseEnter={() => sliceIdx >= 0 && setHoveredIdx(sliceIdx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="space-y-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">{item.percentage}%</span>
                      <span className="font-medium text-foreground">{formatCentsToBrl(item.totalCents)}</span>
                    </div>
                  </div>

                  {!compact && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                        className="t-bar-morph h-full rounded-full"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
