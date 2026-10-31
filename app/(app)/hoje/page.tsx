import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { formatLongDate } from "@/lib/dates";
import { TABS } from "@/lib/modules";

const tab = TABS[0];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/hoje">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description={formatLongDate(new Date())}
      items={["Tarefas do dia, com as atrasadas em destaque", "Visões de Semana e Mês, em lista e kanban", "Checklist dos hábitos do dia"]}
    />
  );
}
