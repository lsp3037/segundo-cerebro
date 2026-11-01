"use client";

import { useState } from "react";
import { toast } from "sonner";

import { setHabitDone } from "@/lib/actions/habits";
import type { IsoDate } from "@/lib/dates";
import type { Habit, HabitLog } from "@/lib/habits";

function toMap(logs: HabitLog[]) {
  const map = new Map<string, Set<IsoDate>>();
  for (const log of logs) {
    if (!map.has(log.habit_id)) map.set(log.habit_id, new Set());
    map.get(log.habit_id)!.add(log.date);
  }
  return map;
}

// Marcações dos hábitos com resposta imediata (volta atrás se o servidor recusar).
export function useHabitLogs(logs: HabitLog[]) {
  const [done, setDone] = useState(() => toMap(logs));
  const [prev, setPrev] = useState(logs);
  if (prev !== logs) {
    setPrev(logs);
    setDone(toMap(logs));
  }

  function apply(habitId: string, day: IsoDate, value: boolean) {
    setDone((map) => {
      const next = new Map(map);
      const days = new Set(next.get(habitId));
      if (value) days.add(day);
      else days.delete(day);
      next.set(habitId, days);
      return next;
    });
  }

  async function toggle(habit: Habit, day: IsoDate) {
    const value = !done.get(habit.id)?.has(day);
    apply(habit.id, day, value);
    const result = await setHabitDone(habit.id, day, value);
    if (!result.ok) {
      apply(habit.id, day, !value);
      toast.error(result.error);
    }
  }

  const daysOf = (habitId: string) => done.get(habitId) ?? new Set<IsoDate>();

  return { daysOf, toggle };
}
