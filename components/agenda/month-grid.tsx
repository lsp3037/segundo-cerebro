"use client";

import { useWorkspace } from "@/components/workspace";
import { addDays, eachDay, endOfMonth, formatWeekdayShort, type IsoDate, minutesToTime, startOfWeek, wallParts } from "@/lib/dates";
import type { Occurrence } from "@/lib/events-expand";
import { cn } from "@/lib/utils";

export function MonthGrid({
  month,
  today,
  occurrences,
  onOpen,
  onCreate,
}: {
  month: IsoDate;
  today: IsoDate;
  occurrences: Occurrence[];
  onOpen: (occ: Occurrence) => void;
  onCreate: (date: IsoDate, minutes: number | null) => void;
}) {
  const { areaById } = useWorkspace();
  const days = eachDay(startOfWeek(month), addDays(startOfWeek(endOfMonth(month)), 6));

  const byDay = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const start = wallParts(o.start).date;
    const last = o.allDay ? wallParts(new Date(new Date(o.end).getTime() - 1).toISOString()).date : start;
    for (let d = start; d <= last; d = addDays(d, 1)) byDay.set(d, [...(byDay.get(d) ?? []), o]);
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground uppercase">
        {days.slice(0, 7).map((d) => (
          <div key={d} className="py-1.5">
            {formatWeekdayShort(d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          return (
            <div
              key={day}
              onClick={() => onCreate(day, null)}
              className={cn("min-h-28 cursor-cell border-r border-b p-1 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}
            >
              <div
                className={cn(
                  "mb-0.5 flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                  day === today ? "bg-foreground font-semibold text-background" : !inMonth && "text-muted-foreground",
                )}
              >
                {Number(day.slice(8))}
              </div>
              <ul className="space-y-0.5">
                {items.slice(0, 4).map((o) => {
                  const color = (o.areaId && areaById.get(o.areaId)?.color) || "#737373";
                  return (
                    <li key={o.key}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(o);
                        }}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded px-1 text-left text-xs hover:bg-accent",
                          o.allDay && "text-white hover:opacity-90",
                        )}
                        style={o.allDay ? { backgroundColor: color } : undefined}
                      >
                        {!o.allDay && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
                        {!o.allDay && <span className="shrink-0 text-muted-foreground tabular-nums">{minutesToTime(wallParts(o.start).minutes)}</span>}
                        <span className="truncate">{o.title}</span>
                      </button>
                    </li>
                  );
                })}
                {items.length > 4 && <li className="px-1 text-xs text-muted-foreground">+{items.length - 4}</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
