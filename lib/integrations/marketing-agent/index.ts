import "server-only";

import { createMockMarketingAgent } from "./mock";

// Adaptador do Agente de Marketing da Trust Care.
// A API real ainda não existe (o painel roda só no PC, em localhost:8007). Decidido na Fase 4:
// o calendário de publicações fica no Segundo Cérebro e o Agente vira fonte de sugestões.
// Na Fase 6, combinar rotas, payload e autenticação com o Luan e criar ./http.ts
// implementando a mesma interface, usando MARKETING_AGENT_URL e MARKETING_AGENT_KEY.

export type AgentIdea = {
  id: string;
  title: string;
  format: "reel" | "carousel" | "post" | "story" | null;
  pillar: string | null;
  notes: string | null;
};

export type AgentSuggestion = {
  ref: string;
  title: string;
  format: AgentIdea["format"];
  pillar: string | null;
  notes: string;
};

export interface MarketingAgent {
  name: string;
  // Manda uma ideia para o Agente desenvolver; devolve a referência dela lá.
  sendIdea(idea: AgentIdea): Promise<{ ref: string }>;
  // Pede sugestões de conteúdo (opcionalmente por pilar).
  getSuggestions(options: { pillars: string[]; limit: number }): Promise<AgentSuggestion[]>;
}

export function getMarketingAgent(): MarketingAgent {
  return createMockMarketingAgent();
}

// Verdadeiro só quando houver a integração real.
export function isMarketingAgentLive() {
  return false;
}
