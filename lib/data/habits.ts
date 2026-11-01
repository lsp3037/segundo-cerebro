import "server-only";

import { addDays, todayIso } from "@/lib/dates";
import type { Habit, HabitLog } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

// Hábitos (fora da lixeira) e as marcações dos últimos ~13 meses,
// o suficiente para a sequência e para o mapa do mês.
export async function getHabits(filter: { areaId?: string; folderIds?: string[]; activeOnly?: boolean } = {}) {
  const supabase = await createClient();

  let habitsQuery = supabase.from("habits").select("*").is("deleted_at", null).order("sort_order").order("created_at");
  if (filter.areaId) habitsQuery = habitsQuery.eq("area_id", filter.areaId);
  if (filter.folderIds) habitsQuery = habitsQuery.in("folder_id", filter.folderIds);
  if (filter.activeOnly) habitsQuery = habitsQuery.eq("active", true);

  const { data: habits, error } = await habitsQuery;
  if (error) throw error;
  if (habits.length === 0) return { habits: [] as Habit[], logs: [] as HabitLog[] };

  const { data: logs, error: logsError } = await supabase
    .from("habit_logs")
    .select("habit_id, date, done")
    .in(
      "habit_id",
      habits.map((h) => h.id),
    )
    .gte("date", addDays(todayIso(), -400))
    .eq("done", true);
  if (logsError) throw logsError;

  return { habits: habits as Habit[], logs: logs as HabitLog[] };
}
