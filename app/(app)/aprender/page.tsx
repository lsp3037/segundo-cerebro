import type { Metadata } from "next";

import { LearningBoard } from "@/components/learning/learning-board";
import { PageHeader } from "@/components/page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { getLearningItems } from "@/lib/data/learning-ideas";
import { getSidebarData } from "@/lib/data/sidebar";
import { TABS } from "@/lib/modules";

const tab = TABS[5];

export const metadata: Metadata = { title: tab.label };

export default async function LearnPage(props: PageProps<"/aprender">) {
  const area = await getAreaFilter(props.searchParams);
  const [{ areas }, items] = await Promise.all([getSidebarData(), getLearningItems({ areaId: area?.id })]);
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
              Aprendizados de <strong style={{ color: area.color }}>{area.name}</strong>
            </>
          ) : (
            "O que você quer aprender, por quê e como está indo."
          )
        }
      />
      <LearningBoard initialItems={items} defaultAreaId={defaultArea.id} />
    </>
  );
}
