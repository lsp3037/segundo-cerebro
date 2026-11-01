import type { Metadata } from "next";

import { InboxList } from "@/components/inbox/inbox-list";
import { PageHeader } from "@/components/page";
import { isAiConfigured } from "@/lib/ai";
import { getInboxItems } from "@/lib/data/inbox";
import { TABS } from "@/lib/modules";

const tab = TABS[2];

export const metadata: Metadata = { title: tab.label };

export default async function InboxPage() {
  const items = await getInboxItems();

  return (
    <>
      <PageHeader
        title={tab.label}
        icon={tab.icon}
        description={
          items.length > 0
            ? `${items.length} ${items.length === 1 ? "item" : "itens"} para organizar, do mais antigo para o mais novo.`
            : "Tudo organizado."
        }
      />
      <InboxList initialItems={items} aiConfigured={isAiConfigured()} />
    </>
  );
}
