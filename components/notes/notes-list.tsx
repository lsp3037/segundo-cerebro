"use client";

import { FileTextIcon, Loader2Icon, PinIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace";
import { createNote } from "@/lib/actions/notes";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type NoteSummary = {
  id: string;
  title: string;
  area_id: string;
  folder_id: string | null;
  tags: string[];
  pinned: boolean;
  template: string | null;
  updated_at: string;
  content_text: string | null;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function NotesList({
  notes,
  defaultAreaId,
  folderId = null,
  meeting = false,
}: {
  notes: NoteSummary[];
  defaultAreaId: string;
  folderId?: string | null;
  // Pastas de reuniões criam notas com o modelo de pauta.
  meeting?: boolean;
}) {
  const router = useRouter();
  const { areaById, folderById } = useWorkspace();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const visible = useMemo(() => {
    const q = fold(query.trim());
    return notes.filter(
      (n) => (!tag || n.tags.includes(tag)) && (!q || fold(`${n.title} ${n.content_text ?? ""}`).includes(q)),
    );
  }, [notes, query, tag]);

  function create() {
    startTransition(async () => {
      const folder = folderId ? folderById.get(folderId) : undefined;
      const result = await createNote({
        area_id: folder?.area_id ?? defaultAreaId,
        folder_id: folderId,
        template: meeting ? "meeting" : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/conhecimento/${result.data.id}`);
    });
  }

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 min-w-56 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:ring-2 focus-within:ring-ring/30 sm:max-w-sm">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar notas…"
            aria-label="Filtrar notas"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <Button size="sm" onClick={create} disabled={pending} className="ml-auto">
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          {meeting ? "Nova reunião" : "Nova nota"}
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "h-6 rounded-full px-2.5 text-xs",
                tag === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          {notes.length === 0 ? "Nenhuma nota ainda." : "Nenhuma nota com esse filtro."}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((n) => {
            const area = areaById.get(n.area_id);
            const folder = n.folder_id ? folderById.get(n.folder_id) : undefined;
            return (
              <li key={n.id}>
                <Link
                  href={`/conhecimento/${n.id}`}
                  className="flex h-full flex-col gap-1.5 rounded-lg border p-3 transition-colors hover:border-foreground/25 hover:bg-accent/30"
                >
                  <span className="flex items-start gap-2">
                    {n.template === "meeting" ? (
                      <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="line-clamp-2 flex-1 text-sm font-medium">{n.title}</span>
                    {n.pinned && <PinIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Fixada" />}
                  </span>
                  {n.content_text && <span className="line-clamp-2 text-xs text-muted-foreground">{n.content_text}</span>}
                  <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: area?.color }} />
                    <span className="truncate">{folder?.name ?? area?.name}</span>
                    <span className="ml-auto shrink-0">{formatDateTime(n.updated_at)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
