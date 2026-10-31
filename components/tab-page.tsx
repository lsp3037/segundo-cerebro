import { PageHeader, PhasePlaceholder } from "@/components/page";
import type { Area, Tab } from "@/lib/modules";

// Molde das abas enquanto o conteúdo de cada uma não chega.
export function TabPage({
  tab,
  description,
  area,
  items,
}: {
  tab: Tab;
  description: React.ReactNode;
  area: Area | null;
  items: string[];
}) {
  return (
    <>
      <PageHeader
        title={tab.label}
        icon={tab.icon}
        accent={area?.color}
        description={
          area ? (
            <>
              Mostrando só <strong style={{ color: area.color }}>{area.name}</strong>
            </>
          ) : (
            description
          )
        }
      />
      <PhasePlaceholder phase={tab.phase} items={items} />
    </>
  );
}
