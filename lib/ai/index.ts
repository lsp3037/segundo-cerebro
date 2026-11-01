import "server-only";

import { createGeminiProvider } from "./gemini";

// Camada única de IA. Para trocar de provedor, crie outro arquivo que implemente
// AiProvider e escolha-o aqui (ex.: por uma variável AI_PROVIDER).
export interface AiProvider {
  name: string;
  // Gera uma resposta em JSON seguindo o esquema informado (JSON Schema).
  generateJson<T>(options: { system: string; prompt: string; schema: Record<string, unknown> }): Promise<T>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("A IA ainda não foi configurada (falta a chave GEMINI_API_KEY).");
  }
}

export function getAiProvider(): AiProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) throw new AiNotConfiguredError();
  return createGeminiProvider({ apiKey, model, fallbackModel: process.env.GEMINI_FALLBACK_MODEL });
}

export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
}
