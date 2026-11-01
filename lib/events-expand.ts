import { RRule, RRuleSet } from "rrule";

import { TZ_OFFSET_MS } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";

export type EventRow = Tables<"events">;

// Uma ocorrência na tela: o evento (ou a repetição dele) com início e fim reais.
export type Occurrence = {
  key: string;
  eventId: string;
  title: string;
  areaId: string | null;
  calendarId: string | null;
  kind: string;
  allDay: boolean;
  start: string;
  end: string;
  recurring: boolean;
  location: string | null;
};

// O rrule calcula em UTC; as regras do Google falam do horário local (ex.: "toda segunda").
// Por isso deslocamos para o "relógio de Cuiabá" antes de calcular e voltamos depois.
const toWall = (d: Date) => new Date(d.getTime() + TZ_OFFSET_MS);
const fromWall = (d: Date) => new Date(d.getTime() - TZ_OFFSET_MS);

// EXDATE do Google: "EXDATE;TZID=America/Cuiaba:20261105T080000" ou "EXDATE;VALUE=DATE:20261105".
function parseExdates(lines: string[]): number[] {
  const out: number[] = [];
  for (const line of lines) {
    if (!line.startsWith("EXDATE")) continue;
    const values = line.slice(line.indexOf(":") + 1).split(",");
    for (const v of values) {
      const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
      if (!m) continue;
      const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
      const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
      out.push(new Date(z ? `${iso}Z` : `${iso}-04:00`).getTime());
    }
  }
  return out;
}

function toOccurrence(e: EventRow, start: Date, end: Date, recurring: boolean, masterId?: string): Occurrence {
  return {
    key: `${masterId ?? e.id}|${start.getTime()}`,
    eventId: e.id,
    title: e.title,
    areaId: e.area_id,
    calendarId: e.calendar_id,
    kind: e.kind,
    allDay: e.all_day,
    start: start.toISOString(),
    end: end.toISOString(),
    recurring,
    location: e.location,
  };
}

// Transforma as linhas do banco nas ocorrências do período [from, to).
export function expandEvents(rows: EventRow[], fromIso: string, toIso: string): Occurrence[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const overlaps = (s: Date, e: Date) => s < to && (e > from || (e.getTime() === s.getTime() && s >= from));

  // Ocorrências alteradas/canceladas substituem a repetição original daquele horário.
  const replaced = new Set<string>();
  const byGoogleId = new Map(rows.filter((r) => r.google_event_id).map((r) => [r.google_event_id!, r]));
  for (const r of rows) {
    if (r.recurring_event_id && r.original_start_at) {
      const master = byGoogleId.get(r.recurring_event_id);
      if (master) replaced.add(`${master.id}|${new Date(r.original_start_at).getTime()}`);
    }
  }

  const out: Occurrence[] = [];
  for (const e of rows) {
    if (e.status === "cancelled" || e.deleted_at) continue;
    const start = new Date(e.start_at);
    const end = new Date(e.end_at);

    if (!e.recurrence?.length) {
      if (overlaps(start, end)) {
        const master = e.recurring_event_id ? byGoogleId.get(e.recurring_event_id) : undefined;
        out.push(toOccurrence(e, start, end, Boolean(master), master?.id));
      }
      continue;
    }

    const ruleLines = e.recurrence.filter((l) => l.startsWith("RRULE"));
    if (ruleLines.length === 0) continue;
    const duration = end.getTime() - start.getTime();
    const exdates = new Set(parseExdates(e.recurrence));

    try {
      // Monta a regra com a data de início explícita (passar dtstart pelo rrulestr gera horários errados).
      const rule = new RRuleSet();
      for (const line of ruleLines) {
        rule.rrule(new RRule({ ...RRule.parseString(line.replace(/^RRULE:/, "")), dtstart: toWall(start) }));
      }
      const occurrences = rule.between(toWall(new Date(from.getTime() - duration)), toWall(to), true).slice(0, 1000);
      for (const wall of occurrences) {
        const s = fromWall(wall);
        const key = `${e.id}|${s.getTime()}`;
        if (exdates.has(s.getTime()) || replaced.has(key)) continue;
        const occEnd = new Date(s.getTime() + duration);
        if (overlaps(s, occEnd)) out.push(toOccurrence(e, s, occEnd, true));
      }
    } catch {
      // Regra que o app não entende: mostra só a primeira data.
      if (overlaps(start, end)) out.push(toOccurrence(e, start, end, true));
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start) || Number(b.allDay) - Number(a.allDay));
}
