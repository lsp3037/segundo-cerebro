"use client";

import { RepeatIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { useWorkspace } from "@/components/workspace";
import { formatWeekdayShort, type IsoDate, minutesToTime, wallParts } from "@/lib/dates";
import type { Occurrence } from "@/lib/events-expand";
import { cn } from "@/lib/utils";

const HOUR_PX = 48;

// Minuto atual (só no navegador; no servidor fica nulo para não divergir do HTML).
function subscribeMinute(callback: () => void) {
  const timer = setInterval(callback, 30_000);
  return () => clearInterval(timer);
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);
const MIN_HEIGHT = 20;

type Placed = { occ: Occurrence; top: number; height: number; col: number; cols: number };

// Distribui eventos que se sobrepõem lado a lado.
function layoutDay(items: { occ: Occurrence; startMin: number; endMin: number }[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: Placed[] = [];
  let cluster: { item: (typeof sorted)[number]; col: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const { item, col } of cluster) {
      placed.push({
        occ: item.occ,
        top: (item.startMin / 60) * HOUR_PX,
        height: Math.max(MIN_HEIGHT, ((item.endMin - item.startMin) / 60) * HOUR_PX),
        col,
        cols,
      });
    }
    cluster = [];
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.item.endMin > item.startMin).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return placed;
}

export function TimeGrid({
  days,
  today,
  occurrences,
  onOpen,
  onCreate,
}: {
  days: IsoDate[];
  today: IsoDate;
  occurrences: Occurrence[];
  onOpen: (occ: Occurrence) => void;
  onCreate: (date: IsoDate, minutes: number | null) => void;
}) {
  const { areaById } = useWorkspace();
  const scroller = useRef<HTMLDivElement>(null);

  // Abre já mostrando a partir das 7h.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 7 * HOUR_PX });
  }, []);

  const allDay = (day: IsoDate) =>
    occurrences.filter((o) => {
      if (!o.allDay) return false;
      const s = wallParts(o.start).date;
      const e = wallParts(new Date(new Date(o.end).getTime() - 1).toISOString()).date;
      return s <= day && day <= e;
    });

  const timed = (day: IsoDate) =>
    layoutDay(
      occurrences
        .filter((o) => !o.allDay)
        .flatMap((o) => {
          const s = wallParts(o.start);
          const e = wallParts(o.end);
          if (s.date > day || e.date < day) return [];
          const startMin = s.date < day ? 0 : s.minutes;
          const endMin = e.date > day ? 24 * 60 : Math.max(e.minutes, startMin + 15);
          return [{ occ: o, startMin, endMin }];
        }),
    );

  const color = (o: Occurrence) => (o.areaId && areaById.get(o.areaId)?.color) || "#737373";
  const nowTick = useSyncExternalStore(subscribeMinute, minuteSnapshot, () => null);
  const nowMin = nowTick === null ? null : wallParts(new Date(nowTick * 60_000).toISOString()).minutes;
  const hasAllDay = days.some((d) => allDay(d).length > 0);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={day} className="border-l px-2 py-1.5 text-center">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">{formatWeekdayShort(day)}</div>
            <div
              className={cn(
                "mx-auto flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                day === today && "bg-foreground font-semibold text-background",
              )}
            >
              {Number(day.slice(8))}
            </div>
          </div>
        ))}
      </div>

      {hasAllDay && (
        <div className="grid border-b" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="px-1 py-1 text-right text-[10px] text-muted-foreground">dia todo</div>
          {days.map((day) => (
            <div key={day} className="space-y-0.5 border-l p-0.5">
              {allDay(day).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onOpen(o)}
                  className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-white"
                  style={{ backgroundColor: color(o) }}
                >
                  {o.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="relative max-h-[calc(100svh-17rem)] min-h-96 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: 24 * HOUR_PX }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums" style={{ top: h * HOUR_PX }}>
                {h > 0 && `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day}
              className="relative cursor-cell border-l"
              style={{ height: 24 * HOUR_PX }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const minutes = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
                onCreate(day, Math.min(minutes, 23 * 60 + 30));
              }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: h * HOUR_PX }} />
              ))}
              {day === today && nowMin !== null && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: (nowMin / 60) * HOUR_PX }} />
              )}
              {timed(day).map((p) => (
                <button
                  key={p.occ.key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(p.occ);
                  }}
                  className={cn(
                    "absolute overflow-hidden rounded-md border-l-[3px] bg-background px-1.5 py-0.5 text-left text-xs shadow-sm hover:z-20 hover:shadow-md",
                    p.occ.kind === "task_block" && "border-dashed",
                  )}
                  style={{
                    top: p.top,
                    height: p.height,
                    left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                    width: `calc(${100 / p.cols}% - 4px)`,
                    borderLeftColor: color(p.occ),
                    backgroundColor: `color-mix(in srgb, ${color(p.occ)} 18%, var(--background))`,
                  }}
                >
                  <span className="flex items-center gap-1 font-medium">
                    {p.occ.recurring && <RepeatIcon className="size-2.5 shrink-0" />}
                    <span className="truncate">{p.occ.title}</span>
                  </span>
                  {p.height > 32 && (
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {minutesToTime(wallParts(p.occ.start).minutes)}–{minutesToTime(wallParts(p.occ.end).minutes)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
