"use client";

import type { CSSProperties, ReactNode } from "react";

import { formatCentsToBrl } from "@/lib/money";

export type FinanceTone = "default" | "positive" | "negative" | "warning" | "muted";

const TONE_CLASS: Record<FinanceTone, string> = {
  default: "text-foreground",
  positive: "text-emerald-400",
  negative: "text-rose-400",
  warning: "text-amber-400",
  muted: "text-muted-foreground",
};

// Resultado com sinal: só leva "+" e verde quando é positivo de verdade; zero fica neutro.
export function signedResult(cents: number): { value: string; tone: FinanceTone } {
  const formatted = formatCentsToBrl(cents);
  if (cents > 0) return { value: `+${formatted}`, tone: "positive" };
  if (cents < 0) return { value: formatted, tone: "negative" };
  return { value: formatted, tone: "default" };
}

interface FinanceHeroProps {
  eyebrow: string;
  value: ReactNode;
  tone?: FinanceTone;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function FinanceHero({
  eyebrow,
  value,
  tone = "default",
  subtitle,
  action,
}: FinanceHeroProps) {
  return (
    <section
      style={{ "--stagger-i": 0 } as CSSProperties}
      className="t-cascade-item t-kpi-card flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-gradient-to-b from-emerald-500/[0.03] to-card px-5 py-4"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <div
          className={`text-3xl font-bold tracking-tight tabular-nums ${TONE_CLASS[tone]}`}
        >
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}

export interface FinanceKpiItem {
  id: string;
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: FinanceTone;
  subtext?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}

interface FinanceKpiStripProps {
  items: FinanceKpiItem[];
  columns?: 2 | 3 | 4;
}

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FinanceKpiStrip({ items, columns = 3 }: FinanceKpiStripProps) {
  return (
    <section
      className={`grid grid-cols-1 gap-3 ${GRID_COLS[columns]}`}
    >
      {items.map((item, idx) => (
        <article
          key={item.id}
          style={{ "--stagger-i": idx + 1 } as CSSProperties}
          className="t-cascade-item t-kpi-card flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3.5 hover:border-border/95"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.icon}
              {item.label}
            </span>
            {item.badge}
          </div>
          <div
            className={`text-2xl font-bold tracking-tight tabular-nums ${TONE_CLASS[item.tone ?? "default"]}`}
          >
            {item.value}
          </div>
          {(item.subtext || item.action) && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="min-w-0 truncate">{item.subtext}</div>
              {item.action && <div className="shrink-0">{item.action}</div>}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
