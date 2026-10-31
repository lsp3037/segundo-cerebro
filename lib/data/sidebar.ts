import "server-only";

import { cache } from "react";

import type { Area, Folder } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

export type SidebarData = { areas: Area[]; folders: Folder[] };

// Áreas e pastas (fora da lixeira) que alimentam a barra lateral e a busca.
export const getSidebarData = cache(async (): Promise<SidebarData> => {
  const supabase = await createClient();
  const [areas, folders] = await Promise.all([
    supabase.from("areas").select("*").order("sort_order"),
    supabase.from("folders").select("*").is("deleted_at", null).order("sort_order"),
  ]);

  if (areas.error) throw areas.error;
  if (folders.error) throw folders.error;

  return { areas: areas.data, folders: folders.data };
});
