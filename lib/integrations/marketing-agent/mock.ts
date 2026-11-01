import "server-only";

import type { AgentSuggestion, MarketingAgent } from "./index";

// Versão de teste: devolve sugestões fixas e não envia nada para fora.
const SAMPLES: Omit<AgentSuggestion, "ref" | "pillar">[] = [
  { title: "3 sinais de que seu notebook precisa de limpeza", format: "carousel", notes: "Calor, barulho da ventoinha e lentidão. Fechar com chamada para agendar." },
  { title: "Antes e depois: HD para SSD", format: "reel", notes: "Cronometrar o tempo para ligar antes e depois da troca." },
  { title: "Por que não formatar sem backup", format: "post", notes: "Contar um caso real (sem dados do cliente) e explicar o backup." },
  { title: "Bastidores da bancada", format: "story", notes: "Mostrar a rotina de diagnóstico de um equipamento." },
  { title: "Notebook revisado: o que é conferido", format: "carousel", notes: "Checklist de revisão dos notebooks à venda." },
];

export function createMockMarketingAgent(): MarketingAgent {
  return {
    name: "mock",
    async sendIdea(idea) {
      return { ref: `mock-${idea.id.slice(0, 8)}` };
    },
    async getSuggestions({ pillars, limit }) {
      return SAMPLES.slice(0, limit).map((s, i) => ({
        ...s,
        ref: `mock-sugestao-${i + 1}`,
        pillar: pillars.length ? pillars[i % pillars.length] : null,
      }));
    },
  };
}
