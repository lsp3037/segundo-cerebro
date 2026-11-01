import { addDays, addMonths, type IsoDate, weekday } from "@/lib/dates";

// Repetições guardadas no formato RRULE (o mesmo do Google Agenda), num subconjunto simples.
export const RECURRENCE_OPTIONS = [
  { value: "", label: "Não repete" },
  { value: "FREQ=DAILY", label: "Todo dia" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Dias úteis (seg a sex)" },
  { value: "FREQ=WEEKLY", label: "Toda semana" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "A cada 2 semanas" },
  { value: "FREQ=MONTHLY", label: "Todo mês" },
  { value: "FREQ=YEARLY", label: "Todo ano" },
] as const;

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

type Rule = { freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"; interval: number; byDay: number[] };

export function parseRule(rule: string | null | undefined): Rule | null {
  if (!rule) return null;
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=") as [string, string]));
  const freq = parts.FREQ as Rule["freq"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const interval = Math.max(1, Number(parts.INTERVAL) || 1);
  const byDay = parts.BYDAY ? parts.BYDAY.split(",").map((d) => BYDAY.indexOf(d)).filter((d) => d >= 0) : [];
  return { freq, interval, byDay };
}

// Próxima data depois de `from`. Sem regra válida, devolve null.
export function nextOccurrence(rule: string | null | undefined, from: IsoDate): IsoDate | null {
  const r = parseRule(rule);
  if (!r) return null;

  switch (r.freq) {
    case "DAILY":
      return addDays(from, r.interval);
    case "WEEKLY": {
      if (r.byDay.length === 0) return addDays(from, 7 * r.interval);
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(from, i);
        if (r.byDay.includes(weekday(candidate))) return candidate;
      }
      return addDays(from, 7);
    }
    case "MONTHLY":
      return addMonths(from, r.interval);
    case "YEARLY":
      return addMonths(from, 12 * r.interval);
  }
}

export function describeRule(rule: string | null | undefined) {
  if (!rule) return null;
  return RECURRENCE_OPTIONS.find((o) => o.value === rule)?.label ?? "Repete";
}
