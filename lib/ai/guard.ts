import "server-only";

import { createClient } from "@/lib/supabase/server";

// Trava por área: nada de uma área com "Pode ir para a IA" desligado sai do servidor.
// Sempre chame antes de mandar conteúdo de uma área para o provedor de IA.
export async function allowedAiAreas() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("areas").select("id, slug, name, ai_enabled");
  if (error) throw error;
  return data.filter((a) => a.ai_enabled);
}

export async function assertAreaAllowsAi(areaId: string) {
  const allowed = await allowedAiAreas();
  if (!allowed.some((a) => a.id === areaId)) {
    throw new Error("Esta área está travada para a IA (veja Configurações).");
  }
}
