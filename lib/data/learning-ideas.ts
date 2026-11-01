import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type LearningItem = Tables<"learning_items">;
export type Idea = Tables<"ideas">;

type Filter = { areaId?: string; folderIds?: string[] };

export async function getLearningItems(filter: Filter = {}): Promise<LearningItem[]> {
  const supabase = await createClient();
  let query = supabase.from("learning_items").select("*").is("deleted_at", null).order("updated_at", { ascending: false });
  if (filter.areaId) query = query.eq("area_id", filter.areaId);
  if (filter.folderIds) query = query.in("folder_id", filter.folderIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getIdeas(filter: Filter = {}): Promise<Idea[]> {
  const supabase = await createClient();
  let query = supabase.from("ideas").select("*").is("deleted_at", null).order("updated_at", { ascending: false });
  if (filter.areaId) query = query.eq("area_id", filter.areaId);
  if (filter.folderIds) query = query.in("folder_id", filter.folderIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
