import type { Metadata } from "next";

import { NotesList } from "@/components/notes/notes-list";
import { PageHeader } from "@/components/page";
import { getAreaFilter } from "@/lib/data/area-filter";
import { getNotes } from "@/lib/data/notes";
import { getSidebarData } from "@/lib/data/sidebar";
import { TABS } from "@/lib/modules";

const tab = TABS[4];

export const metadata: Metadata = { title: tab.label };

export default async function KnowledgePage(props: PageProps<"/conhecimento">) {
  const area = await getAreaFilter(props.searchParams);
  const [{ areas }, notes] = await Promise.all([getSidebarData(), getNotes({ areaId: area?.id })]);
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
              Notas de <strong style={{ color: area.color }}>{area.name}</strong>
            </>
          ) : (
            "Notas, repositório da empresa e reuniões."
          )
        }
      />
      <NotesList notes={notes} defaultAreaId={defaultArea.id} />
    </>
  );
}
