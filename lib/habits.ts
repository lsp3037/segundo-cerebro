import { addDays, type IsoDate, startOfWeek, weekday } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";

export type Habit = Tables<"habits">;
export type HabitLog = Pick<Tables<"habit_logs">, "habit_id" | "date" | "done">;

export const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// O hábito "cai" neste dia? (Hábitos "X vezes por semana" valem qualquer dia.)
export function isScheduled(habit: Habit, day: IsoDate) {
  if (habit.frequency === "weekdays") return habit.weekdays.includes(weekday(day));
  return true;
}

export function describeFrequency(habit: Pick<Habit, "frequency" | "weekdays" | "times_per_week">) {
  if (habit.frequency === "daily") return "Todo dia";
  if (habit.frequency === "times_per_week") return `${habit.times_per_week ?? 1}x por semana`;
  const days = [...habit.weekdays].sort();
  if (days.join() === "1,2,3,4,5") return "Dias úteis";
  if (days.join() === "0,6") return "Fins de semana";
  return days.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(", ");
}

// Quantas vezes foi feito na semana (seg a dom) que contém `day`.
export function doneInWeek(done: Set<IsoDate>, day: IsoDate) {
  const start = startOfWeek(day);
  let count = 0;
  for (let i = 0; i < 7; i++) if (done.has(addDays(start, i))) count++;
  return count;
}

// Sequência atual. Se hoje ainda não foi feito, conta a partir de ontem (o dia não acabou).
// Diário/dias da semana: dias agendados seguidos. X por semana: semanas seguidas com a meta batida.
export function currentStreak(habit: Habit, done: Set<IsoDate>, today: IsoDate) {
  if (habit.frequency === "times_per_week") {
    const target = habit.times_per_week ?? 1;
    let weeks = doneInWeek(done, today) >= target ? 1 : 0;
    for (let week = addDays(startOfWeek(today), -7); doneInWeek(done, week) >= target; week = addDays(week, -7)) {
      weeks++;
    }
    return { value: weeks, unit: weeks === 1 ? "semana" : "semanas" };
  }

  let days = 0;
  let day = done.has(today) ? today : addDays(today, -1);
  for (let guard = 0; guard < 3650; guard++, day = addDays(day, -1)) {
    if (!isScheduled(habit, day)) continue;
    if (!done.has(day)) break;
    days++;
  }
  return { value: days, unit: days === 1 ? "dia" : "dias" };
}
