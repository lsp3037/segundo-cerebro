import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { HabitsManager } from "@/components/habits/habits-manager";
import { IdeasBoard } from "@/components/ideas/ideas-board";
import { LearningBoard } from "@/components/learning/learning-board";
import { LgpdNotice } from "@/components/lgpd-notice";
import { NotesList } from "@/components/notes/notes-list";
import { PageHeader, PhasePlaceholder } from "@/components/page";
import { TASK_VIEWS, type TaskView, TasksBoard } from "@/components/tasks/tasks-board";
import { getHabits } from "@/lib/data/habits";
import { getIdeas, getLearningItems } from "@/lib/data/learning-ideas";
import { getNotes } from "@/lib/data/notes";
import { getSidebarData } from "@/lib/data/sidebar";
import { getTasks } from "@/lib/data/tasks";
import { todayIso } from "@/lib/dates";
import { type Folder, type FolderModule, MODULES } from "@/lib/modules";

async function loadFolder(folderId: string) {
  if (!z.uuid().safeParse(folderId).success) return null;
  const { areas, folders } = await getSidebarData();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return null;

  const path: Folder[] = [];
  for (let f: Folder | undefined = folder; f; f = folders.find((p) => p.id === f!.parent_id)) path.unshift(f);

  // A pasta mostra o próprio conteúdo e o das subpastas.
  const subtree = [folder.id];
  for (let i = 0; i < subtree.length; i++) {
    for (const f of folders) if (f.parent_id === subtree[i]) subtree.push(f.id);
  }

  return { folder, area: areas.find((a) => a.id === folder.area_id)!, path, subtree };
}

export async function generateMetadata(props: PageProps<"/p/[folderId]">): Promise<Metadata> {
  const data = await loadFolder((await props.params).folderId);
  return { title: data?.folder.name ?? "Pasta" };
}

const FOLDER_TASK_VIEWS: TaskView[] = ["lista", "kanban", "semana", "mes"];

export default async function FolderPage(props: PageProps<"/p/[folderId]">) {
  const data = await loadFolder((await props.params).folderId);
  if (!data) notFound();
  const { folder, area, path, subtree } = data;
  const kind = folder.module as FolderModule;
  const mod = MODULES[kind];
  const filter = { folderIds: subtree };
  const today = todayIso();

  let content: React.ReactNode;
  switch (kind) {
    case "tasks": {
      const { v } = await props.searchParams;
      const view = FOLDER_TASK_VIEWS.includes(v as TaskView) ? (v as TaskView) : "lista";
      content = (
        <TasksBoard
          key={view}
          initialTasks={await getTasks(filter)}
          today={today}
          view={view}
          views={TASK_VIEWS.map((x) => x.value).filter((x) => FOLDER_TASK_VIEWS.includes(x))}
          defaultAreaId={area.id}
          folderId={folder.id}
        />
      );
      break;
    }
    case "notes":
    case "meetings":
      content = (
        <NotesList notes={await getNotes(filter)} defaultAreaId={area.id} folderId={folder.id} meeting={kind === "meetings"} />
      );
      break;
    case "routine": {
      const { habits, logs } = await getHabits(filter);
      content = <HabitsManager habits={habits} logs={logs} today={today} areaId={area.id} folderId={folder.id} />;
      break;
    }
    case "learning":
      content = <LearningBoard initialItems={await getLearningItems(filter)} defaultAreaId={area.id} folderId={folder.id} />;
      break;
    case "ideas":
      content = <IdeasBoard initialIdeas={await getIdeas(filter)} defaultAreaId={area.id} folderId={folder.id} />;
      break;
    default:
      content = <PhasePlaceholder phase={mod.phase} items={[mod.description]} className={area.show_lgpd_notice ? "pt-4" : undefined} />;
  }

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
      {area.show_lgpd_notice && <LgpdNotice className="mx-4 mt-4 max-w-xl md:mx-6" />}
      {content}
    </>
  );
}
