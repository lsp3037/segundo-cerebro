import "server-only";

import { type EventRow, expandEvents, type Occurrence } from "@/lib/events-expand";
import { createClient } from "@/lib/supabase/server";

export type CalendarInfo = {
  id: string;
  name: string;
  color: string | null;
  default_area_id: string | null;
  is_primary: boolean;
  writable: boolean;
  sync_enabled: boolean;
  connection_id: string;
};

// Ocorrências do período (repetições já calculadas). Filtra por área depois de expandir,
// porque a área de uma repetição vem do evento principal.
export async function getOccurrences(fromIso: string, toIso: string, areaId?: string): Promise<Occurrence[]> {
  const supabase = await createClient();
  const columns = "*";
  const [ranged, recurring, overrides] = await Promise.all([
    supabase
      .from("events")
      .select(columns)
      .is("deleted_at", null)
      .is("recurrence", null)
      .lt("start_at", toIso)
      .gte("end_at", fromIso)
      .limit(3000),
    supabase.from("events").select(columns).is("deleted_at", null).not("recurrence", "is", null).limit(2000),
    supabase
      .from("events")
      .select(columns)
      .not("recurring_event_id", "is", null)
      .gte("original_start_at", new Date(new Date(fromIso).getTime() - 2 * 86_400_000).toISOString())
      .lt("original_start_at", toIso)
      .limit(3000),
  ]);

  const rows = new Map<string, EventRow>();
  for (const r of [...(ranged.data ?? []), ...(recurring.data ?? []), ...(overrides.data ?? [])]) rows.set(r.id, r);

  const occurrences = expandEvents([...rows.values()], fromIso, toIso);
  return areaId ? occurrences.filter((o) => o.areaId === areaId) : occurrences;
}

export async function getCalendars(): Promise<CalendarInfo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendars")
    .select("id, name, color, default_area_id, is_primary, access_role, sync_enabled, connection_id")
    .order("is_primary", { ascending: false })
    .order("name");
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    default_area_id: c.default_area_id,
    is_primary: c.is_primary,
    writable: !c.access_role || ["owner", "writer"].includes(c.access_role),
    sync_enabled: c.sync_enabled,
    connection_id: c.connection_id,
  }));
}

export async function getEvent(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  return data;
}
