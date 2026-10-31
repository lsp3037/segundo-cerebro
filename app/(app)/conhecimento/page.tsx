import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[4];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/conhecimento">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="Notas, repositório da empresa e reuniões."
      items={["Notas com editor rico, tags e links entre notas", "Repositório da Trust Care e notas de reunião da SES", "Anexos guardados no Supabase"]}
    />
  );
}
