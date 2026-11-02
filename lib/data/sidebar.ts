import "server-only";

import { cache } from "react";

import type { Area, Folder } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

export type SidebarData = { areas: Area[]; folders: Folder[] };

// UUID determinístico para a pasta da Diretoria de Marketing caso a migration ainda não tenha rodado
export const MARKETING_DIRECTOR_FOLDER_ID = "e87f1c90-b19b-4e02-98e3-000000000042";

// Áreas e pastas (fora da lixeira) que alimentam a barra lateral e a busca.
export const getSidebarData = cache(async (): Promise<SidebarData> => {
  const supabase = await createClient();
  const [areas, folders] = await Promise.all([
    supabase.from("areas").select("*").order("sort_order"),
    supabase.from("folders").select("*").is("deleted_at", null).order("sort_order"),
  ]);

  if (areas.error) throw areas.error;
  if (folders.error) throw folders.error;

  const areaList = areas.data ?? [];
  const folderList = [...(folders.data ?? [])];

  // Garante que a pasta "Diretoria de Marketing" apareça sob a área Trust Care mesmo se a migration não tiver sido aplicada
  const tcArea = areaList.find((a) => a.slug === "trustcare");
  if (tcArea && !folderList.some((f) => f.module === "marketing_director")) {
    folderList.push({
      id: MARKETING_DIRECTOR_FOLDER_ID,
      user_id: tcArea.user_id,
      area_id: tcArea.id,
      parent_id: null,
      name: "Diretoria de Marketing",
      module: "marketing_director",
      icon: "megaphone",
      sort_order: 6,
      config: {},
      collapsed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

  return { areas: areaList, folders: folderList };
});
