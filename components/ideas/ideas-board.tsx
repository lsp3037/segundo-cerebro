"use client";

import { Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AreaFolderFields, Field, type LinkItem, LinksEditor, QuickAddInput, TagsInput } from "@/components/form-bits";
import { LgpdNotice } from "@/components/lgpd-notice";
import { Button } from "@/components/ui/button";
import { useOpenParam } from "@/components/use-open-param";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { useWorkspace } from "@/components/workspace";
import { createIdea, type IdeaInput, trashItem, updateIdea } from "@/lib/actions/learning-ideas";
import { formatShortDate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Idea = Tables<"ideas">;

const STATUS = [
  { value: "loose", label: "Soltas" },
  { value: "maturing", label: "Amadurecendo" },
  { value: "project", label: "Viraram projeto" },
  { value: "discarded", label: "Descartadas" },
] as const;

export function IdeasBoard({
  initialIdeas,
  defaultAreaId,
  folderId = null,
}: {
  initialIdeas: Idea[];
  defaultAreaId: string;
  folderId?: string | null;
}) {
  const { areaById, folderById } = useWorkspace();
  const list = useOptimisticList(initialIdeas);
  const [openId, setOpenId] = useOpenParam("ideia");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const open = list.items.find((i) => i.id === openId) ?? null;

  const columns = useMemo(
    () => STATUS.filter((s) => showDiscarded || s.value !== "discarded").map((s) => ({ ...s, ideas: list.items.filter((i) => i.status === s.value) })),
    [list.items, showDiscarded],
  );
  const discardedCount = list.items.filter((i) => i.status === "discarded").length;

  return (
    <div className="space-y-5 px-4 py-4 md:px-6">
      <QuickAddInput
        placeholder="Anote uma ideia…"
        onAdd={async (title) => {
          const areaId = folderId ? (folderById.get(folderId)?.area_id ?? defaultAreaId) : defaultAreaId;
          const result = await createIdea({ title, area_id: areaId, folder_id: folderId });
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          list.setItems((items) => [result.data, ...items]);
          return true;
        }}
      />

      <div className={cn("grid gap-3", showDiscarded ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {columns.map((col) => (
          <section key={col.value} className="flex flex-col rounded-lg border bg-muted/30">
            <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {col.label} <span className="font-normal tabular-nums">{col.ideas.length}</span>
            </h2>
            <ul className="flex-1 space-y-1.5 p-1.5 pt-0">
              {col.ideas.map((idea) => {
                const area = areaById.get(idea.area_id);
                return (
                  <li key={idea.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(idea.id)}
                      className="flex w-full flex-col gap-1 rounded-md border bg-background p-2.5 text-left hover:border-foreground/25"
                    >
                      <span className="text-sm">{idea.title}</span>
                      {idea.notes && <span className="line-clamp-2 text-xs text-muted-foreground">{idea.notes}</span>}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: area?.color }} />
                          {area?.name}
                        </span>
                        {idea.tags.map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                        <span className="ml-auto">{formatShortDate(idea.created_at.slice(0, 10))}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {discardedCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowDiscarded(!showDiscarded)}>
          {showDiscarded ? "Esconder descartadas" : `Ver descartadas (${discardedCount})`}
        </Button>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {open && (
            <IdeaForm
              key={open.id}
              idea={open}
              onUpdate={(patch) => list.patch(open.id, patch as Partial<Idea>, () => updateIdea(open.id, patch))}
              onTrash={() => {
                setOpenId(null);
                list.removeItem(open.id, () => trashItem("ideas", open.id));
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function IdeaForm({ idea, onUpdate, onTrash }: { idea: Idea; onUpdate: (patch: IdeaInput) => Promise<boolean>; onTrash: () => void }) {
  const { areaById } = useWorkspace();
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes ?? "");

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="sr-only">Editar ideia</SheetTitle>
        <SheetDescription className="sr-only">Tudo é salvo automaticamente.</SheetDescription>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== idea.title && onUpdate({ title: title.trim() })}
          aria-label="Ideia"
          className="border-none px-0 text-base font-medium shadow-none focus-visible:ring-0"
        />
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {areaById.get(idea.area_id)?.show_lgpd_notice && <LgpdNotice />}

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
          {STATUS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={idea.status === s.value}
              onClick={() => onUpdate({ status: s.value })}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs",
                idea.status === s.value ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Field label="Detalhes" htmlFor="idea-notes">
          <Textarea
            id="idea-notes"
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (idea.notes ?? "") && onUpdate({ notes: notes || null })}
            placeholder="Por que vale a pena, primeiros passos, quem pode ajudar…"
          />
        </Field>

        <AreaFolderFields areaId={idea.area_id} folderId={idea.folder_id} modules={["ideas"]} onChange={(v) => onUpdate(v)} />

        <Field label="Tags">
          <TagsInput value={idea.tags} onChange={(tags) => onUpdate({ tags })} />
        </Field>

        <Field label="Referências">
          <LinksEditor value={idea.links as LinkItem[]} onChange={(links) => onUpdate({ links })} />
        </Field>
      </div>

      <SheetFooter className="flex-row justify-end border-t">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onTrash}>
          <Trash2Icon />
          Excluir
        </Button>
      </SheetFooter>
    </>
  );
}
