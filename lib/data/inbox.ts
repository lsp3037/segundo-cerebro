import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type InboxItem = Tables<"inbox_items">;

export async function getInboxItems(status: "new" | "processed" = "new"): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .is("deleted_at", null)
    .eq("status", status)
    .order("created_at", { ascending: status === "new" })
    .limit(status === "new" ? 500 : 50);
  if (error) throw error;
  return data;
}

export async function countOpenInbox(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "new");
  return count ?? 0;
}
