import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";

import type { AiProvider } from "./index";

// Erros que valem tentar de novo com o modelo reserva: modelo sobrecarregado ou limite de uso.
const BUSY = new Set([429, 500, 503]);

// Gemini pelo SDK oficial. GEMINI_MODEL é o principal; GEMINI_FALLBACK_MODEL (opcional)
// entra quando o principal está ocupado, o que acontece com frequência no plano gratuito.
export function createGeminiProvider({
  apiKey,
  model,
  fallbackModel,
}: {
  apiKey: string;
  model: string;
  fallbackModel?: string;
}): AiProvider {
  const client = new GoogleGenAI({ apiKey });
  const models = [model, fallbackModel].filter((m): m is string => Boolean(m));

  return {
    name: `gemini:${model}`,
    async generateJson<T>({ system, prompt, schema }: { system: string; prompt: string; schema: Record<string, unknown> }) {
      let lastError: unknown;
      for (const current of models) {
        try {
          const response = await client.models.generateContent({
            model: current,
            contents: prompt,
            config: {
              systemInstruction: system,
              responseMimeType: "application/json",
              responseJsonSchema: schema,
              temperature: 0.2,
            },
          });
          const text = response.text;
          if (!text) throw new Error("A IA não devolveu resposta.");
          return JSON.parse(text) as T;
        } catch (error) {
          lastError = error;
          if (!(error instanceof ApiError && BUSY.has(error.status))) throw error;
        }
      }
      throw lastError;
    },
  };
}
