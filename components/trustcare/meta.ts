// Rótulos da Trust Care usados por telas do servidor e do navegador (sem "use client").

export const CONTENT_FORMATS = [
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carrossel" },
  { value: "post", label: "Post" },
  { value: "story", label: "Story" },
] as const;

export const CONTENT_IDEA_STATUS = [
  { value: "idea", label: "Ideias" },
  { value: "developing", label: "Desenvolvendo" },
  { value: "approved", label: "Aprovadas" },
  { value: "discarded", label: "Descartadas" },
] as const;

export const PUBLICATION_STATUS = [
  { value: "idea", label: "Ideia" },
  { value: "script", label: "Roteiro" },
  { value: "production", label: "Produção" },
  { value: "scheduled", label: "Agendado" },
  { value: "published", label: "Publicado" },
] as const;

export const CHANNELS = [
  { value: "instagram", label: "Instagram" },
  { value: "google_business", label: "Google Meu Negócio" },
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number]["value"];
export type PublicationStatus = (typeof PUBLICATION_STATUS)[number]["value"];
export type Channel = (typeof CHANNELS)[number]["value"];

export function labelOf<T extends { value: string; label: string }>(list: readonly T[], value: string | null | undefined) {
  return list.find((x) => x.value === value)?.label ?? "";
}
