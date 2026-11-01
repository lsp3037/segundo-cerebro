import type { Metadata } from "next";

import { type AgendaViewName, AgendaView } from "@/components/agenda/agenda-view";
import { PageHeader } from "@/components/page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { getCalendars, getOccurrences } from "@/lib/data/events";
import {
  addDays,
  addMonths,
  eachDay,
  endOfMonth,
  formatMonthYear,
  formatRelativeDay,
  formatShortDate,
  fromWallParts,
  startOfMonth,
  startOfWeek,
  todayIso,
} from "@/lib/dates";
import { TABS } from "@/lib/modules";

const tab = TABS[1];

export const metadata: Metadata = { title: tab.label };

export default async function AgendaPage(props: PageProps<"/agenda">) {
  const { v, d } = await props.searchParams;
  const view: AgendaViewName = v === "dia" || v === "mes" ? v : "semana";
  const today = todayIso();
  const anchor = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const area = await getAreaFilter(props.searchParams);

  // Período exibido conforme a visão.
  let days: string[];
  let from: string;
  let to: string;
  let label: string;
  let prev: string;
  let next: string;
  const month = startOfMonth(anchor);

  if (view === "dia") {
    days = [anchor];
    [from, to] = [anchor, addDays(anchor, 1)];
    label = formatRelativeDay(anchor, today);
    [prev, next] = [addDays(anchor, -1), addDays(anchor, 1)];
  } else if (view === "semana") {
    const start = startOfWeek(anchor);
    days = eachDay(start, addDays(start, 6));
    [from, to] = [start, addDays(start, 7)];
    label = `${formatShortDate(days[0])} – ${formatShortDate(days[6])}`;
    [prev, next] = [addDays(anchor, -7), addDays(anchor, 7)];
  } else {
    days = [];
    [from, to] = [startOfWeek(month), addDays(startOfWeek(endOfMonth(month)), 7)];
    label = formatMonthYear(month);
    [prev, next] = [addMonths(month, -1), addMonths(month, 1)];
  }

  const [occurrences, calendars] = await Promise.all([
    getOccurrences(fromWallParts(from, 0), fromWallParts(to, 0), area?.id),
    getCalendars(),
  ]);

  return (
    <>
      <PageHeader
        title={tab.label}
        icon={tab.icon}
        accent={area?.color}
        description={
          area ? (
            <>
              Compromissos de <strong style={{ color: area.color }}>{area.name}</strong>
            </>
          ) : (
            "Seus compromissos, tarefas com horário e rotinas, sincronizados com o Google Agenda."
          )
        }
      />
      <AgendaView
        view={view}
        label={label}
        days={days}
        month={month}
        prev={prev}
        next={next}
        today={today}
        occurrences={occurrences}
        calendars={calendars}
        defaultAreaId={area?.id ?? null}
      />
    </>
  );
}
