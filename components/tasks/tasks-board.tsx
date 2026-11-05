"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useOpenParam } from "@/components/use-open-param";
import { useWorkspace } from "@/components/workspace";
import {
  addDays,
  addMonths,
  eachDay,
  endOfMonth,
  formatMonthYear,
  formatShortDate,
  formatWeekdayShort,
  type IsoDate,
  startOfMonth,
  startOfWeek,
  todayIso,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TasksKanban } from "./kanban";
import { compareTasks, isOpen, type Task, TASK_VIEWS, type TaskView } from "./meta";
import { TaskQuickAdd } from "./task-quick-add";
import { TaskRow } from "./task-row";
import { TaskSheet } from "./task-sheet";
import { type TaskList, useTaskList } from "./use-task-list";

export function TasksBoard({
  initialTasks,
  today,
  view,
  views = TASK_VIEWS.map((v) => v.value),
  defaultAreaId,
  folderId = null,
  aside,
}: {
  initialTasks: Task[];
  today: IsoDate;
  view: TaskView;
  views?: TaskView[];
  defaultAreaId: string;
  folderId?: string | null;
  aside?: React.ReactNode;
}) {
  const list = useTaskList(initialTasks);
  const [openId, setOpenId] = useOpenParam("tarefa");
  const openTask = list.tasks.find((t) => t.id === openId) ?? null;

  const props: ViewProps = {
    list,
    today,
    defaultAreaId,
    folderId,
    onOpen: (task) => setOpenId(task.id),
    onToggle: (task) => list.setStatus(task, task.status === "done" ? "todo" : "done"),
  };

  return (
    <div className="px-4 py-4 md:px-6">
      {views.length > 1 && <ViewSwitcher views={views} current={view} />}

      <div className={cn("mt-4", aside && "grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="min-w-0 order-2 xl:order-1">
          {view === "hoje" && <TodayView {...props} />}
          {view === "semana" && <WeekView {...props} />}
          {view === "mes" && <MonthView {...props} />}
          {view === "lista" && <ListView {...props} />}
          {view === "kanban" && <TasksKanban {...props} />}
        </div>
        {aside && <div className="space-y-4 xl:space-y-6 order-1 xl:order-2">{aside}</div>}
      </div>

      <TaskSheet task={openTask} list={list} onClose={() => setOpenId(null)} />
    </div>
  );
}

export type ViewProps = {
  list: TaskList;
  today: IsoDate;
  defaultAreaId: string;
  folderId: string | null;
  onOpen: (task: Task) => void;
  onToggle: (task: Task) => void;
};

function ViewSwitcher({ views, current }: { views: TaskView[]; current: TaskView }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div role="tablist" aria-label="Visão" className="inline-flex rounded-lg border p-0.5">
      {TASK_VIEWS.filter((v) => views.includes(v.value)).map((v) => {
        const params = new URLSearchParams(searchParams);
        params.set("v", v.value);
        return (
          <Link
            key={v.value}
            role="tab"
            aria-selected={v.value === current}
            href={`${pathname}?${params}`}
            scroll={false}
            className={cn(
              "flex h-7 items-center rounded-md px-3 text-sm transition-colors",
              v.value === current ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count?: number;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h2
        className={cn(
          "flex items-center gap-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
          tone === "danger" && "text-red-600 dark:text-red-400",
        )}
      >
        {title}
        {count !== undefined && <span className="font-normal tabular-nums">{count}</span>}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-3 text-sm text-muted-foreground">{children}</p>;
}

// ---------------------------------------------------------------------------

function TodayView({ list, today, defaultAreaId, folderId, onOpen, onToggle }: ViewProps) {
  const { overdue, todays, doneToday } = useMemo(() => {
    const open = list.tasks.filter(isOpen);
    return {
      overdue: open.filter((t) => t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
      todays: open.filter((t) => t.due_date === today).sort(compareTasks),
      doneToday: list.tasks.filter(
        (t) => t.status === "done" && t.completed_at !== null && todayIso(new Date(t.completed_at)) === today,
      ),
    };
  }, [list.tasks, today]);

  const row = (task: Task, showDate = false) => (
    <TaskRow key={task.id} task={task} today={today} showDate={showDate} onOpen={() => onOpen(task)} onToggle={() => onToggle(task)} />
  );

  return (
    <div className="space-y-6">
      <TaskQuickAdd list={list} today={today} defaultAreaId={defaultAreaId} folderId={folderId} defaultDate={today} placeholder="Nova tarefa para hoje…" />

      {overdue.length > 0 && (
        <Section title="Atrasadas" count={overdue.length} tone="danger">
          {overdue.map((t) => row(t, true))}
        </Section>
      )}

      <Section title="Hoje" count={todays.length}>
        {todays.length ? todays.map((t) => row(t)) : <Empty>Nada marcado para hoje.</Empty>}
      </Section>

      {doneToday.length > 0 && (
        <Section title="Concluídas hoje" count={doneToday.length}>
          {doneToday.map((t) => row(t))}
        </Section>
      )}
    </div>
  );
}

function ListView({ list, today, defaultAreaId, folderId, onOpen, onToggle }: ViewProps) {
  const groups = useMemo(() => {
    const open = list.tasks.filter(isOpen);
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 7);
    const buckets: { title: string; tone?: "danger"; tasks: Task[] }[] = [
      { title: "Atrasadas", tone: "danger", tasks: open.filter((t) => t.due_date && t.due_date < today) },
      { title: "Hoje", tasks: open.filter((t) => t.due_date === today) },
      { title: "Amanhã", tasks: open.filter((t) => t.due_date === tomorrow) },
      { title: "Próximos 7 dias", tasks: open.filter((t) => t.due_date && t.due_date > tomorrow && t.due_date <= weekEnd) },
      { title: "Mais adiante", tasks: open.filter((t) => t.due_date && t.due_date > weekEnd) },
      { title: "Sem data", tasks: open.filter((t) => !t.due_date) },
    ];
    for (const b of buckets) b.tasks.sort((a, c) => (a.due_date ?? "").localeCompare(c.due_date ?? "") || compareTasks(a, c));
    return buckets.filter((b) => b.tasks.length > 0);
  }, [list.tasks, today]);

  return (
    <div className="space-y-6">
      <TaskQuickAdd list={list} today={today} defaultAreaId={defaultAreaId} folderId={folderId} />
      {groups.length === 0 && <Empty>Nenhuma tarefa aberta.</Empty>}
      {groups.map((g) => (
        <Section key={g.title} title={g.title} count={g.tasks.length} tone={g.tone}>
          {g.tasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} onOpen={() => onOpen(t)} onToggle={() => onToggle(t)} />
          ))}
        </Section>
      ))}
    </div>
  );
}

function PeriodNav({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" onClick={onPrev} aria-label="Anterior">
        <ChevronLeftIcon />
      </Button>
      <Button variant="outline" size="sm" onClick={onToday}>
        Hoje
      </Button>
      <Button variant="outline" size="icon-sm" onClick={onNext} aria-label="Próximo">
        <ChevronRightIcon />
      </Button>
      <span className="ml-1 text-sm font-medium first-letter:uppercase">{label}</span>
    </div>
  );
}

function WeekView({ list, today, defaultAreaId, folderId, onOpen, onToggle }: ViewProps) {
  const [start, setStart] = useState(() => startOfWeek(today));
  const days = eachDay(start, addDays(start, 6));
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of list.tasks) if (t.due_date) map.set(t.due_date, [...(map.get(t.due_date) ?? []), t]);
    for (const tasks of map.values()) tasks.sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || compareTasks(a, b));
    return map;
  }, [list.tasks]);

  return (
    <div className="space-y-4">
      <PeriodNav
        label={`${formatShortDate(days[0])} – ${formatShortDate(days[6])}`}
        onPrev={() => setStart(addDays(start, -7))}
        onNext={() => setStart(addDays(start, 7))}
        onToday={() => setStart(startOfWeek(today))}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((day) => {
          const tasks = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <section key={day} className={cn("flex min-h-40 flex-col rounded-lg border", isToday && "border-foreground/30 bg-accent/30")}>
              <h3 className="flex items-baseline gap-1.5 border-b px-2.5 py-1.5 text-xs">
                <span className="font-semibold uppercase">{formatWeekdayShort(day)}</span>
                <span className={cn("tabular-nums text-muted-foreground", isToday && "font-semibold text-foreground")}>
                  {Number(day.slice(8))}
                </span>
              </h3>
              <div className="flex-1 p-1">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} compact onOpen={() => onOpen(t)} onToggle={() => onToggle(t)} />
                ))}
              </div>
              <TaskQuickAdd
                list={list}
                today={today}
                defaultAreaId={defaultAreaId}
                folderId={folderId}
                defaultDate={day}
                placeholder="Adicionar"
                minimal
                className="m-1 border-transparent px-1.5 py-0.5"
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ today, list, onOpen }: ViewProps) {
  const { areaById } = useWorkspace();
  const [month, setMonth] = useState(() => startOfMonth(today));
  const gridStart = startOfWeek(month);
  const days = eachDay(gridStart, addDays(startOfWeek(endOfMonth(month)), 6));
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of list.tasks) if (t.due_date) map.set(t.due_date, [...(map.get(t.due_date) ?? []), t]);
    for (const tasks of map.values()) tasks.sort(compareTasks);
    return map;
  }, [list.tasks]);

  return (
    <div className="space-y-4">
      <PeriodNav
        label={formatMonthYear(month)}
        onPrev={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
        onToday={() => setMonth(startOfMonth(today))}
      />
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
            const tasks = byDay.get(day) ?? [];
            const inMonth = day.slice(0, 7) === month.slice(0, 7);
            return (
              <div key={day} className={cn("min-h-24 border-r border-b p-1 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}>
                <div
                  className={cn(
                    "mb-0.5 flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    day === today ? "bg-foreground font-semibold text-background" : !inMonth && "text-muted-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </div>
                <ul className="space-y-0.5">
                  {tasks.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(t)}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded px-1 text-left text-xs hover:bg-accent",
                          !isOpen(t) && "text-muted-foreground line-through",
                        )}
                      >
                        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: areaById.get(t.area_id)?.color }} />
                        <span className="truncate">{t.title}</span>
                      </button>
                    </li>
                  ))}
                  {tasks.length > 3 && <li className="px-1 text-xs text-muted-foreground">+{tasks.length - 3}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
