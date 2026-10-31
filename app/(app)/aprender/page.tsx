import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[5];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/aprender">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="O que você quer aprender e por quê."
      items={["Temas com motivo, links e progresso", "Transformar um aprendizado concluído em nota"]}
    />
  );
}
