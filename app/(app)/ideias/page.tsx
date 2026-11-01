import type { Metadata } from "next";

import { IdeasBoard } from "@/components/ideas/ideas-board";
import { PageHeader } from "@/components/page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { getIdeas } from "@/lib/data/learning-ideas";
import { getSidebarData } from "@/lib/data/sidebar";
import { TABS } from "@/lib/modules";

const tab = TABS[3];

export const metadata: Metadata = { title: tab.label };

export default async function IdeasPage(props: PageProps<"/ideias">) {
  const area = await getAreaFilter(props.searchParams);
  const [{ areas }, ideas] = await Promise.all([getSidebarData(), getIdeas({ areaId: area?.id })]);
  const defaultArea = area ?? areas.find((a) => a.slug === "pessoal") ?? areas[0];

  return (
    <>
      <PageHeader
        title={tab.label}
        icon={tab.icon}
        accent={area?.color}
        description={
          area ? (
            <>
              Ideias de <strong style={{ color: area.color }}>{area.name}</strong>
            </>
          ) : (
            "Banco de ideias gerais. As ideias de conteúdo da Trust Care ficam na pasta própria."
          )
        }
      />
      <IdeasBoard initialIdeas={ideas} defaultAreaId={defaultArea.id} />
    </>
  );
}
