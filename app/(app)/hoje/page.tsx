import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TodayAgenda } from "@/components/agenda/today-agenda";
import { UpcomingBillsCard } from "@/components/finance/upcoming-bills-card";
import { HabitsToday } from "@/components/habits/habits-today";
import { PageHeader } from "@/components/page";
import { TASK_VIEWS, type TaskView } from "@/components/tasks/meta";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { getAreaFilter } from "@/lib/data/area-filter";
import { getCalendars, getOccurrences } from "@/lib/data/events";
import { getUpcomingHouseholdBills } from "@/lib/data/finance-family";
import { getHabits } from "@/lib/data/habits";
import { countOpenInbox } from "@/lib/data/inbox";
import { getSidebarData } from "@/lib/data/sidebar";
import { getTasks } from "@/lib/data/tasks";
import { addDays, formatGreeting, formatLongDate, fromWallParts, todayIso } from "@/lib/dates";
import { TABS } from "@/lib/modules";

const tab = TABS[0];

export const metadata: Metadata = { title: tab.label };

export default async function TodayPage(props: PageProps<"/hoje">) {
  const { v } = await props.searchParams;
  const view: TaskView = TASK_VIEWS.some((x) => x.value === v) ? (v as TaskView) : "hoje";
  const area = await getAreaFilter(props.searchParams);
  const today = todayIso();

  const [{ areas, folders }, tasks, { habits, logs }, inboxCount, todayEvents, calendars, upcomingBills] = await Promise.all([
    getSidebarData(),
    getTasks({ areaId: area?.id }),
    getHabits({ areaId: area?.id, activeOnly: true }),
    countOpenInbox(),
    view === "hoje" ? getOccurrences(fromWallParts(today, 0), fromWallParts(addDays(today, 1), 0), area?.id) : Promise.resolve([]),
    view === "hoje" ? getCalendars() : Promise.resolve([]),
    view === "hoje" ? getUpcomingHouseholdBills() : Promise.resolve([]),
  ]);

  const defaultArea = area ?? areas.find((a) => a.slug === "pessoal") ?? areas[0];
  const routineFolder = folders.find((f) => f.module === "routine");

  return (
    <>
      <PageHeader
        title={tab.label}
        icon={tab.icon}
        accent={area?.color}
        description={
          area ? (
            <>
              {formatLongDate(new Date())} · só <strong style={{ color: area.color }}>{area.name}</strong>
            </>
          ) : (
            formatLongDate(new Date())
          )
        }
      />
      <TasksBoard
        key={view}
        initialTasks={tasks}
        today={today}
        view={view}
        defaultAreaId={defaultArea.id}
        greeting={formatGreeting()}
        aside={
          view === "hoje" ? (
            <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-1">
              <TodayAgenda occurrences={todayEvents} areas={areas} connected={calendars.some((c) => c.sync_enabled)} />
              <UpcomingBillsCard bills={upcomingBills} />
              <HabitsToday
                habits={habits}
                logs={logs}
                today={today}
                manageHref={routineFolder ? `/p/${routineFolder.id}` : null}
              />
              <Link
                href="/entrada"
                className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent/50 sm:col-span-2 xl:col-span-1"
              >
                <InboxIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 font-semibold">Caixa de Entrada</span>
                {inboxCount > 0 ? (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
                    {inboxCount} para organizar
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">vazia</span>
                )}
              </Link>
            </div>
          ) : undefined
        }
      />
    </>
  );
}
