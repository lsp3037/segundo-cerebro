import "server-only";

import { getSidebarData } from "@/lib/data/sidebar";
import type { Area } from "@/lib/modules";

// Lê o filtro ?area=slug das abas e devolve a área correspondente (ou null).
export async function getAreaFilter(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<Area | null> {
  const { area } = await searchParams;
  if (typeof area !== "string") return null;
  const { areas } = await getSidebarData();
  return areas.find((a) => a.slug === area) ?? null;
}
