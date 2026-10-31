import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[3];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/ideias">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="Banco de ideias gerais, de todas as áreas."
      items={["Ideias com status: solta, amadurecendo, virou projeto", "Filtro por área e por tag", "As ideias de conteúdo da Trust Care ficam na pasta própria (Fase 4)"]}
    />
  );
}
