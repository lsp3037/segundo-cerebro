import "server-only";

import { GoogleGenAI } from "@google/genai";

import type { AiProvider } from "./index";

// Gemini pelo SDK oficial. O modelo vem de GEMINI_MODEL.
export function createGeminiProvider({ apiKey, model }: { apiKey: string; model: string }): AiProvider {
  const client = new GoogleGenAI({ apiKey });

  return {
    name: `gemini:${model}`,
    async generateJson<T>({ system, prompt, schema }: { system: string; prompt: string; schema: Record<string, unknown> }) {
      const response = await client.models.generateContent({
        model,
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
    },
  };
}
