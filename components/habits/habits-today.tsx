"use client";

import { CheckIcon, FlameIcon } from "lucide-react";
import Link from "next/link";

import type { IsoDate } from "@/lib/dates";
import { currentStreak, doneInWeek, type Habit, type HabitLog, isScheduled } from "@/lib/habits";
import { cn } from "@/lib/utils";
import { useHabitLogs } from "./use-habits";

// Checklist dos hábitos do dia, na aba Hoje.
export function HabitsToday({
  habits,
  logs,
  today,
  manageHref,
}: {
  habits: Habit[];
  logs: HabitLog[];
  today: IsoDate;
  manageHref: string | null;
}) {
  const { daysOf, toggle } = useHabitLogs(logs);
  const todays = habits.filter((h) => h.active && isScheduled(h, today));
  const doneCount = todays.filter((h) => daysOf(h.id).has(today)).length;

  return (
    <section className="rounded-xl border">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          Hábitos de hoje
          {todays.length > 0 && (
            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
              {doneCount}/{todays.length}
            </span>
          )}
        </h2>
        {manageHref && (
          <Link href={manageHref} className="text-xs text-muted-foreground hover:text-foreground">
            Gerenciar
          </Link>
        )}
      </header>

      {todays.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          {habits.length === 0 ? "Nenhum hábito cadastrado ainda." : "Nenhum hábito para hoje."}
        </p>
      ) : (
        <ul className="p-1.5">
          {todays.map((habit) => {
            const days = daysOf(habit.id);
            const done = days.has(today);
            const streak = currentStreak(habit, days, today);
            return (
              <li key={habit.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() => toggle(habit, today)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent/60"
                  style={{ "--habit": habit.color ?? "var(--foreground)" } as React.CSSProperties}
                >
                  <span
                    className={cn(
                      "flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-(--habit)/60",
                      done && "border-transparent bg-(--habit) text-background",
                    )}
                  >
                    {done && <CheckIcon className="size-3 stroke-3" />}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", done && "text-muted-foreground")}>{habit.name}</span>
                  {habit.frequency === "times_per_week" ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {doneInWeek(days, today)}/{habit.times_per_week} na semana
                    </span>
                  ) : (
                    streak.value > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums" title={`${streak.value} ${streak.unit} seguidos`}>
                        <FlameIcon className="size-3 text-orange-500" />
                        {streak.value}
                      </span>
                    )
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
