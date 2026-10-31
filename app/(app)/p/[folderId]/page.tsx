import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { LgpdNotice } from "@/components/lgpd-notice";
import { PageHeader, PhasePlaceholder } from "@/components/page";
import { getSidebarData } from "@/lib/data/sidebar";
import { type Folder, type FolderModule, MODULES } from "@/lib/modules";

async function loadFolder(folderId: string) {
  if (!z.uuid().safeParse(folderId).success) return null;
  const { areas, folders } = await getSidebarData();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return null;

  const path: Folder[] = [];
  for (let f: Folder | undefined = folder; f; f = folders.find((p) => p.id === f!.parent_id)) path.unshift(f);
  return { folder, area: areas.find((a) => a.id === folder.area_id)!, path };
}

export async function generateMetadata(props: PageProps<"/p/[folderId]">): Promise<Metadata> {
  const data = await loadFolder((await props.params).folderId);
  return { title: data?.folder.name ?? "Pasta" };
}

export default async function FolderPage(props: PageProps<"/p/[folderId]">) {
  const data = await loadFolder((await props.params).folderId);
  if (!data) notFound();
  const { folder, area, path } = data;
  const mod = MODULES[folder.module as FolderModule];

  return (
    <>
      <PageHeader
        title={folder.name}
        icon={folder.icon ?? mod.icon}
        accent={area.color}
        description={
          <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1">
            <Link href={`/hoje?area=${area.slug}`} className="hover:text-foreground" style={{ color: area.color }}>
              {area.name}
            </Link>
            {path.slice(0, -1).map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRightIcon className="size-3" aria-hidden="true" />
                <Link href={`/p/${f.id}`} className="hover:text-foreground">
                  {f.name}
                </Link>
              </span>
            ))}
            <ChevronRightIcon className="size-3" aria-hidden="true" />
            <span>{mod.label}</span>
          </nav>
        }
      />
      {area.show_lgpd_notice && <LgpdNotice className="mx-6 mt-6 max-w-xl" />}
      <PhasePlaceholder phase={mod.phase} items={[mod.description]} className={area.show_lgpd_notice ? "pt-4" : undefined} />
    </>
  );
}
