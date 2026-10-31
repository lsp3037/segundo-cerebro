import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[6];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/financas">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="Pessoal e Trust Care."
      items={["Entradas e saídas pessoais e da Trust Care", "Lucro por notebook comprado e revendido", "Resumo mensal com gráfico"]}
    />
  );
}
