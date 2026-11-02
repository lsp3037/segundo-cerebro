// Rótulos, tipos e utilitários da Diretoria de Marketing (Trust Care).
// Não usa "use client" para poder ser compartilhado entre Server e Client Components.

export const CAMPAIGN_STATUSES = [
  { value: "draft", label: "Rascunho", color: "bg-muted text-muted-foreground border-border" },
  { value: "scheduled", label: "Agendada", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { value: "active", label: "Ativa", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { value: "paused", label: "Pausada", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "completed", label: "Concluída", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  { value: "archived", label: "Arquivada", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
] as const;

export const CAMPAIGN_OBJECTIVES = [
  { value: "whatsapp_leads", label: "Leads WhatsApp", icon: "message-circle", description: "Início de conversas diretas de novos clientes no WhatsApp" },
  { value: "upgrades_maintenance", label: "Upgrades & Manutenção", icon: "wrench", description: "Captação de clientes para SSD, memória e limpeza química" },
  { value: "notebook_sales", label: "Venda de Notebooks", icon: "laptop", description: "Conversão para o estoque de seminovos revisados" },
  { value: "brand_awareness", label: "Reconhecimento de Marca", icon: "megaphone", description: "Alcance local em Cuiabá e Várzea Grande" },
  { value: "custom", label: "Objetivo Customizado", icon: "target", description: "Meta livre ou sazonal" },
] as const;

export const HOOK_ANGLES = [
  { value: "dor_urgencia", label: "Dor & Urgência", badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", description: "PC travando, tela azul, desespero no trabalho" },
  { value: "custo_beneficio", label: "Custo-Benefício", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", description: "Upgrade inteligente vs Comprar notebook novo de R$ 4.000" },
  { value: "prova_social", label: "Prova Social", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", description: "Antes e depois de clientes reais de Cuiabá" },
  { value: "autoridade_tecnica", label: "Autoridade Técnica", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", description: "Laboratório próprio, reparo de placas, garantia Trust Care" },
  { value: "oportunidade", label: "Oportunidade & Oferta", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", description: "Condição especial, diagnóstico gratuito na semana" },
] as const;

export const ANGLE_STATUSES = [
  { value: "draft", label: "Rascunho", badge: "bg-muted text-muted-foreground border-border" },
  { value: "testing", label: "Em Teste", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { value: "winner", label: "🏆 Vencedor (Winner)", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold" },
  { value: "paused", label: "Pausado", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "discarded", label: "Descartado", badge: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
] as const;

export const CREATIVE_FORMATS = [
  { value: "video_reel", label: "Vídeo / Reel 9:16" },
  { value: "carousel", label: "Carrossel 1:1 / 4:5" },
  { value: "single_image", label: "Imagem Única" },
  { value: "story", label: "Sequência de Stories" },
] as const;

export const CONTENT_PLANNER_FORMATS = [
  { value: "all", label: "Todos os formatos" },
  { value: "reel", label: "Reels" },
  { value: "story", label: "Stories" },
  { value: "carousel", label: "Carrosséis" },
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]["value"];
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]["value"];
export type HookAngleType = (typeof HOOK_ANGLES)[number]["value"];
export type AngleStatus = (typeof ANGLE_STATUSES)[number]["value"];
export type CreativeFormat = (typeof CREATIVE_FORMATS)[number]["value"];

// Estruturas de Roteiros Avançados
export type ReelScriptData = {
  type: "reel";
  hook_3s: string;
  retention_body: string[];
  cta: string;
  audio_suggestion: string;
  duration_seconds?: number;
};

export type StoryFrame = {
  number: number;
  goal: string;
  text: string;
  interactive_element: string;
};

export type StorySequenceData = {
  type: "story";
  frames: StoryFrame[];
};

export type CarouselSlide = {
  index: number;
  role: "capa" | "conteudo" | "cta";
  headline: string;
  body?: string;
  visual_cue: string;
};

export type CarouselScriptData = {
  type: "carousel";
  slides: CarouselSlide[];
};

export type MarketingScriptData = ReelScriptData | StorySequenceData | CarouselScriptData;

// Helpers utilitários de formatação
export function formatCentsToBrl(cents: number | bigint | null | undefined): string {
  const value = Number(cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parseBrlToCents(val: string): number {
  const clean = val.replace(/[^\d]/g, "");
  return parseInt(clean, 10) || 0;
}

export function formatPercent(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return `${num.toFixed(2).replace(".", ",")}%`;
}

export function labelOf<T extends { value: string; label: string }>(
  list: readonly T[],
  value: string | null | undefined,
): string {
  return list.find((x) => x.value === value)?.label ?? value ?? "";
}

export function badgeOf<T extends { value: string; badge: string }>(
  list: readonly T[],
  value: string | null | undefined,
): string {
  return list.find((x) => x.value === value)?.badge ?? "bg-muted text-muted-foreground border-border";
}
