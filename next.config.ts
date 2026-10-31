import type { NextConfig } from "next";

// Cache Components fica desligado: quase todo conteúdo aqui é pessoal e lido
// por usuário logado, então a renderização dinâmica clássica é mais simples.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
