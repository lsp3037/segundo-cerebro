"use client";

import { useMemo } from "react";

import type { Transaction } from "@/lib/data/finance";
import { formatMonthName, formatMonthYear, type IsoDate } from "@/lib/dates";
import { daysInMonth } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";
import { cn } from "@/lib/utils";

type IsPaidFn = (tx: Transaction) => boolean;
type DotTone = "done" | "income" | "expense" | "late";

// Mais urgente primeiro: atrasado > saída pendente > entrada pendente > já feito.
const TONE_RANK: Record<DotTone, number> = { late: 3, expense: 2, income: 1, done: 0 };
const TICK_DAYS = [1, 5, 10, 15, 20, 25];
// Recuo das pontas para o pontinho não ser cortado.
const EDGE_INSET_PX = 6;

/** Dia (AAAA-MM-DD) em que o lançamento aparece na régua. */
export function rulerDay(tx: Transaction, paid: boolean): IsoDate {
  if (paid) return tx.paid_at ? tx.paid_at.slice(0, 10) : tx.date;
  return tx.due_date ?? tx.date;
}

function toneOf(tx: Transaction, paid: boolean, day: IsoDate, today: IsoDate): DotTone {
  if (paid) return "done";
  if (tx.kind === "income") return "income";
  return day < today ? "late" : "expense";
}

interface DayDot {
  day: number;
  iso: IsoDate;
  tone: DotTone;
  count: number;
  label: string;
}

interface DayBucket {
  count: number;
  tone: DotTone;
  parts: Record<DotTone, { count: number; cents: number }>;
}

function describeBucket(bucket: DayBucket): string {
  const { parts } = bucket;
  const pieces: string[] = [];
  if (parts.late.count > 0) pieces.push(`${parts.late.count} atrasado${parts.late.count > 1 ? "s" : ""}, saem ${formatCentsToBrl(parts.late.cents)}`);
  if (parts.expense.count > 0) pieces.push(`saem ${formatCentsToBrl(parts.expense.cents)}`);
  if (parts.income.count > 0) pieces.push(`entram ${formatCentsToBrl(parts.income.cents)}`);
  if (parts.done.count > 0) pieces.push(`${parts.done.count} já feito${parts.done.count > 1 ? "s" : ""}, ${formatCentsToBrl(parts.done.cents)}`);
  return pieces.join("; ");
}

function buildDots(params: { transactions: Transaction[]; month: string; today: IsoDate; isPaid: IsPaidFn }): DayDot[] {
  const { transactions, month, today, isPaid } = params;
  const buckets = new Map<number, DayBucket>();
  for (const tx of transactions) {
    const paid = isPaid(tx);
    const iso = rulerDay(tx, paid);
    if (iso.slice(0, 7) !== month) continue;
    const day = Number(iso.slice(8, 10));
    const tone = toneOf(tx, paid, iso, today);
    const bucket =
      buckets.get(day) ??
      ({
        count: 0,
        tone: "done",
        parts: {
          done: { count: 0, cents: 0 },
          income: { count: 0, cents: 0 },
          expense: { count: 0, cents: 0 },
          late: { count: 0, cents: 0 },
        },
      } satisfies DayBucket);
    bucket.count += 1;
    bucket.parts[tone].count += 1;
    bucket.parts[tone].cents += tx.amount_cents;
    if (TONE_RANK[tone] > TONE_RANK[bucket.tone] || bucket.count === 1) bucket.tone = tone;
    buckets.set(day, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, bucket]) => {
      const iso = `${month}-${String(day).padStart(2, "0")}`;
      const head = `${day} de ${formatMonthName(iso)}: ${bucket.count} ${bucket.count === 1 ? "lançamento" : "lançamentos"}`;
      return { day, iso, tone: bucket.tone, count: bucket.count, label: `${head}, ${describeBucket(bucket)}` };
    });
}

const DOT_CLASS: Record<DotTone, string> = {
  done: "size-2 bg-muted-foreground",
  income: "size-3 bg-emerald-400",
  expense: "size-3 bg-rose-400",
  late: "size-3 bg-rose-400 shadow-[0_0_0_3px_rgba(251,113,133,0.22)]",
};

function LegendItem({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2 rounded-full", className)} />
      {children}
    </span>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface MonthRulerProps {
  transactions: Transaction[];
  /** Mês visto, AAAA-MM. */
  month: string;
  today: IsoDate;
  isPaid: IsPaidFn;
  /** Dia escolhido no momento (destaca o pontinho). */
  selectedDay?: IsoDate | null;
  onPickDay?: (iso: IsoDate) => void;
}

// Régua do mês: um pontinho por dia com lançamentos, "hoje" marcado e escala de dias embaixo.
export function MonthRuler({ transactions, month, today, isPaid, selectedDay = null, onPickDay }: MonthRulerProps) {
  const totalDays = daysInMonth(month);
  const monthStart = `${month}-01`;
  const isCurrentMonth = today.slice(0, 7) === month;
  const isPastMonth = today.slice(0, 7) > month;
  const todayDay = isCurrentMonth ? Number(today.slice(8, 10)) : null;

  const dots = useMemo(
    () => buildDots({ transactions, month, today, isPaid }),
    [transactions, month, today, isPaid],
  );

  const pct = (day: number) => (totalDays > 1 ? ((day - 1) / (totalDays - 1)) * 100 : 0);
  const livedPct = isPastMonth ? 100 : todayDay ? pct(todayDay) : 0;
  const title = isCurrentMonth
    ? `${capitalize(formatMonthName(monthStart))}: hoje é dia ${todayDay}`
    : capitalize(formatMonthYear(monthStart));
  const tickDays = [...TICK_DAYS.filter((d) => d < totalDays - 1), totalDays];

  return (
    <section aria-label="Régua do mês" className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
        <span>{title}</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendItem className="bg-emerald-400">recebe</LegendItem>
          <LegendItem className="bg-rose-400">paga ou atrasa</LegendItem>
          <LegendItem className="bg-muted-foreground">já feito</LegendItem>
        </span>
      </div>

      <div className="relative mt-5 h-[34px]">
        <div className="absolute inset-y-0" style={{ left: EDGE_INSET_PX, right: EDGE_INSET_PX }}>
          <div className="absolute inset-x-0 top-4 h-0.5 rounded-[1px] bg-border" />
          {livedPct > 0 && (
            <div
              className="absolute left-0 top-4 h-0.5 rounded-[1px] bg-muted-foreground/60"
              style={{ width: `${livedPct}%` }}
            />
          )}
          {todayDay !== null && (
            <>
              <div
                aria-hidden="true"
                className="absolute top-[7px] h-5 w-0.5 -translate-x-1/2 rounded-[1px] bg-foreground"
                style={{ left: `${pct(todayDay)}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute -top-[15px] -translate-x-1/2 whitespace-nowrap text-[12px] font-medium leading-none text-foreground"
                style={{ left: `${pct(todayDay)}%` }}
              >
                hoje
              </span>
            </>
          )}

          {dots.map((dot) => (
            <button
              key={dot.day}
              type="button"
              aria-label={dot.label}
              aria-pressed={selectedDay === dot.iso}
              title={dot.label}
              onClick={() => onPickDay?.(dot.iso)}
              className="group absolute top-[17px] flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              style={{ left: `${pct(dot.day)}%` }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full transition-transform group-hover:scale-125 motion-reduce:transition-none",
                  DOT_CLASS[dot.tone],
                  selectedDay === dot.iso && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
              />
              {dot.count > 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[19px] top-1/2 -translate-y-1/2 text-[12px] leading-none tabular-nums text-muted-foreground"
                >
                  {dot.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="relative mt-0.5 h-[18px] text-[12px] text-muted-foreground">
        <div className="absolute inset-y-0" style={{ left: EDGE_INSET_PX, right: EDGE_INSET_PX }}>
          {tickDays.map((day) => (
            <span
              key={day}
              className="absolute -translate-x-1/2 tabular-nums leading-[18px]"
              style={{ left: `${pct(day)}%` }}
            >
              {day}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
