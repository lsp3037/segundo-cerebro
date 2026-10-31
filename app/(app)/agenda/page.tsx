import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[1];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/agenda">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="Seus compromissos, tarefas com horário e rotinas."
      items={["Sincronização nos dois sentidos com o Google Agenda (pessoal e SES)", "Visões de dia, semana e mês, com cor por área", "Tarefas com horário viram blocos de tempo"]}
    />
  );
}
