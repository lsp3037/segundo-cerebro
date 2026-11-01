import type { FolderModule } from "@/lib/modules";

// Destinos possíveis ao organizar um item da Caixa de Entrada.
export const CONVERT_TARGETS = ["task", "note", "idea", "content_idea", "learning_item"] as const;
export type ConvertTarget = (typeof CONVERT_TARGETS)[number];

export const TARGETS: Record<ConvertTarget, { label: string; icon: string; modules: FolderModule[]; areaSlug?: string }> = {
  task: { label: "Tarefa", icon: "list-checks", modules: ["tasks"] },
  note: { label: "Nota", icon: "file-text", modules: ["notes", "meetings"] },
  idea: { label: "Ideia", icon: "lightbulb", modules: ["ideas"] },
  content_idea: { label: "Ideia de conteúdo", icon: "lightbulb", modules: ["content_ideas"], areaSlug: "trustcare" },
  learning_item: { label: "Aprender", icon: "graduation-cap", modules: ["learning"] },
};
