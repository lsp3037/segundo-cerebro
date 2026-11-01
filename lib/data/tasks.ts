import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Task = Tables<"tasks">;

const COLUMNS =
  "id, area_id, folder_id, title, notes, priority, status, due_date, start_time, duration_min, recurrence_rule, recurrence_parent_id, completed_at, event_id, sort_order, created_at, updated_at, deleted_at, user_id";

// Tarefas abertas (qualquer data) e as fechadas nos últimos 60 dias.
// O volume de uma pessoa é pequeno; as visões filtram no navegador.
export async function getTasks(filter: { areaId?: string; folderIds?: string[] } = {}): Promise<Task[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();

  let query = supabase
    .from("tasks")
    .select(COLUMNS)
    .is("deleted_at", null)
    .or(`status.in.(todo,doing,waiting),updated_at.gte.${since}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("priority")
    .order("created_at")
    .limit(2000);

  if (filter.areaId) query = query.eq("area_id", filter.areaId);
  if (filter.folderIds) query = query.in("folder_id", filter.folderIds);

  const { data, error } = await query;
  if (error) throw error;
  return data as Task[];
}
