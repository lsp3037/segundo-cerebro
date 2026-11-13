import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { AsideCard, AsideEmpty } from "@/components/today/aside-card";
import { minutesToTime, wallParts } from "@/lib/dates";
import type { Occurrence } from "@/lib/events-expand";
import type { Area } from "@/lib/modules";

// Compromissos do dia, na lateral da aba Hoje.
export function TodayAgenda({ occurrences, areas, connected }: { occurrences: Occurrence[]; areas: Area[]; connected: boolean }) {
  const color = (o: Occurrence) => areas.find((a) => a.id === o.areaId)?.color ?? "#737373";
  const sorted = [...occurrences].sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || a.start.localeCompare(b.start));

  return (
    <AsideCard
      icon={CalendarDaysIcon}
      title="Agenda de hoje"
      meta={connected && sorted.length > 0 ? sorted.length : undefined}
      action={{ label: "Abrir", href: "/agenda?v=dia" }}
    >
      {!connected ? (
        <AsideEmpty>
          <Link href="/configuracoes#agenda" className="underline underline-offset-4">
            Conecte o Google Agenda
          </Link>{" "}
          para ver seus compromissos aqui.
        </AsideEmpty>
      ) : sorted.length === 0 ? (
        <AsideEmpty>Agenda livre hoje.</AsideEmpty>
      ) : (
        <ul>
          {sorted.map((o) => {
            const start = wallParts(o.start);
            const end = wallParts(o.end);
            const showEnd = !o.allDay && end.date === start.date && end.minutes > start.minutes;
            return (
              <li key={o.key} className="flex gap-3 rounded-lg px-2.5 py-2">
                <span className="w-0.5 shrink-0 rounded-full" style={{ backgroundColor: color(o) }} aria-hidden="true" />
                <div className="w-11 shrink-0 text-sm leading-5 tabular-nums">
                  {o.allDay ? (
                    <span className="text-muted-foreground">dia todo</span>
                  ) : (
                    <>
                      <span className="block font-medium">{minutesToTime(start.minutes)}</span>
                      {showEnd && <span className="block text-xs text-muted-foreground">{minutesToTime(end.minutes)}</span>}
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-5 font-medium">{o.title}</p>
                  {o.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPinIcon className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{o.location}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AsideCard>
  );
}
