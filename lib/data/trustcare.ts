import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Shortcut = Tables<"shortcuts">;
export type ContentPillar = Tables<"content_pillars">;
export type ContentIdea = Tables<"content_ideas">;
export type Publication = Tables<"publications">;
export type ServiceFlow = Tables<"service_flows">;
export type ReplyCase = Tables<"reply_cases">;

type Filter = { folderIds?: string[] };

export async function getShortcuts(filter: Filter = {}): Promise<Shortcut[]> {
  const supabase = await createClient();
  let query = supabase.from("shortcuts").select("*").is("deleted_at", null).order("sort_order").order("created_at");
  if (filter.folderIds) query = query.in("folder_id", filter.folderIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getContentPillars(): Promise<ContentPillar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("content_pillars").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return data;
}

export async function getContentIdeas(filter: Filter = {}): Promise<ContentIdea[]> {
  const supabase = await createClient();
  let query = supabase.from("content_ideas").select("*").is("deleted_at", null).order("updated_at", { ascending: false });
  if (filter.folderIds) query = query.in("folder_id", filter.folderIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Publicações não têm pasta: o calendário mostra todas.
export async function getPublications(): Promise<Publication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .is("deleted_at", null)
    .order("scheduled_for", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getServiceFlows(): Promise<ServiceFlow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_flows").select("*").is("deleted_at", null).order("name");
  if (error) throw error;
  return data;
}

export async function getReplyCases(): Promise<ReplyCase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reply_cases")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}
