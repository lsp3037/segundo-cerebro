import type { Tables } from "@/lib/supabase/database.types";

export type Area = Tables<"areas">;
export type Folder = Tables<"folders">;

export const FOLDER_MODULES = [
  "tasks",
  "notes",
  "meetings",
  "routine",
  "learning",
  "ideas",
  "shortcuts",
  "content_ideas",
  "publications",
  "service_flows",
  "reply_assistant",
  "finance",
] as const;

export type FolderModule = (typeof FOLDER_MODULES)[number];

// O que cada tipo de pasta mostra, e em que fase a tela chega.
export const MODULES: Record<FolderModule, { label: string; icon: string; phase: number; description: string }> = {
  tasks: { label: "Demandas", icon: "list-checks", phase: 2, description: "Tarefas com prioridade, prazo e status." },
  notes: { label: "Notas", icon: "file-text", phase: 2, description: "Notas em Markdown com editor rico e links entre notas." },
  meetings: { label: "Reuniões", icon: "users", phase: 2, description: "Notas de reunião com modelo de pauta e encaminhamentos." },
  routine: { label: "Rotina e hábitos", icon: "repeat", phase: 2, description: "Hábitos marcados a cada dia, com sequência e mapa do mês." },
  learning: { label: "Aprender", icon: "graduation-cap", phase: 2, description: "Temas, motivos, recursos e progresso." },
  ideas: { label: "Ideias", icon: "lightbulb", phase: 2, description: "Banco de ideias gerais." },
  shortcuts: { label: "Atalhos", icon: "link", phase: 4, description: "Cards de acesso rápido e resumo das O.S." },
  content_ideas: { label: "Ideias de conteúdo", icon: "lightbulb", phase: 4, description: "Ideias para Instagram e Google Meu Negócio." },
  publications: { label: "Publicações", icon: "calendar-range", phase: 4, description: "Calendário editorial com status de produção." },
  service_flows: { label: "Fluxos de atendimento", icon: "workflow", phase: 4, description: "Etapas, perguntas, mensagens-modelo e objeções por serviço." },
  reply_assistant: { label: "Assistente de respostas", icon: "message-square-text", phase: 4, description: "Sugestões de resposta para leads e clientes." },
  finance: { label: "Finanças", icon: "wallet", phase: 5, description: "Entradas, saídas, saldo e lucro por notebook." },
};

// Abas da barra superior.
export const TABS = [
  { href: "/hoje", label: "Hoje", icon: "sun", phase: 2 },
  { href: "/agenda", label: "Agenda", icon: "calendar", phase: 3 },
  { href: "/entrada", label: "Caixa de Entrada", icon: "inbox", phase: 2 },
  { href: "/ideias", label: "Ideias", icon: "lightbulb", phase: 2 },
  { href: "/conhecimento", label: "Conhecimento", icon: "library", phase: 2 },
  { href: "/aprender", label: "Aprender", icon: "graduation-cap", phase: 2 },
  { href: "/financas", label: "Finanças", icon: "wallet", phase: 5 },
  { href: "/revisao", label: "Revisão Semanal", icon: "clipboard-check", phase: 5 },
] as const;

export type Tab = (typeof TABS)[number];

export const AREA_COLOR_PRESETS = [
  "#2563EB",
  "#7C3AED",
  "#EA580C",
  "#059669",
  "#DB2777",
  "#0891B2",
  "#CA8A04",
  "#DC2626",
  "#4F46E5",
  "#525252",
];
