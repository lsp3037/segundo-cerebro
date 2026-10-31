import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[7];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/revisao">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="O fechamento da semana, todo domingo."
      items={["Checklist guiado: Caixa de Entrada, atrasadas, próxima semana, agenda, conteúdo e finanças", "Histórico das revisões com anotações"]}
    />
  );
}
