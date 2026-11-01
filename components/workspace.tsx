"use client";

import { createContext, use, useMemo } from "react";

import type { Area, Folder, FolderModule } from "@/lib/modules";

type Workspace = {
  areas: Area[];
  folders: Folder[];
  areaById: Map<string, Area>;
  folderById: Map<string, Folder>;
  // Pastas de um tipo (ex.: "tasks"), opcionalmente só de uma área, com o caminho para exibir.
  foldersFor: (module: FolderModule | FolderModule[], areaId?: string) => { folder: Folder; label: string }[];
};

const WorkspaceContext = createContext<Workspace | null>(null);

// Áreas e pastas já carregadas pelo layout, disponíveis para qualquer tela do app.
export function WorkspaceProvider({
  areas,
  folders,
  children,
}: {
  areas: Area[];
  folders: Folder[];
  children: React.ReactNode;
}) {
  const value = useMemo<Workspace>(() => {
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const folderById = new Map(folders.map((f) => [f.id, f]));

    const pathOf = (folder: Folder) => {
      const names: string[] = [];
      for (let f: Folder | undefined = folder; f; f = f.parent_id ? folderById.get(f.parent_id) : undefined) {
        names.unshift(f.name);
      }
      return names.join(" › ");
    };

    return {
      areas,
      folders,
      areaById,
      folderById,
      foldersFor: (module, areaId) => {
        const modules = Array.isArray(module) ? module : [module];
        return folders
          .filter((f) => modules.includes(f.module as FolderModule) && (!areaId || f.area_id === areaId))
          .map((folder) => ({ folder, label: pathOf(folder) }))
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
      },
    };
  }, [areas, folders]);

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace() {
  const ctx = use(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fora do WorkspaceProvider");
  return ctx;
}
