import type { Metadata } from "next";

import { TabPage } from "@/components/tab-page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { TABS } from "@/lib/modules";

const tab = TABS[2];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/entrada">) {
  const area = await getAreaFilter(props.searchParams);

  return (
    <TabPage
      tab={tab}
      area={area}
      description="Tudo que ainda não foi organizado."
      items={["Campo rápido para jogar qualquer coisa, com atalho de teclado", "Classificar em tarefa, nota, ideia ou aprendizado", "Itens enviados pelo bot do Telegram (Fase 6)"]}
    />
  );
}
