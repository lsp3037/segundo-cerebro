"use client";

import { CalendarPlusIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Field, type LinkItem, LinksEditor, QuickAddInput, TagsInput } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useOpenParam } from "@/components/use-open-param";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { useWorkspace } from "@/components/workspace";
import { type ContentIdeaInput, createContentIdea, createPublication, trashContent, updateContentIdea } from "@/lib/actions/content";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { CONTENT_FORMATS, CONTENT_IDEA_STATUS, labelOf } from "./meta";
import { PillarsDialog } from "./pillars-dialog";

type Idea = Tables<"content_ideas">;
type Pillar = Tables<"content_pillars">;

const NONE = "__none__";
const ALL = "__all__";

export function ContentIdeasBoard({
  initialIdeas,
  initialPillars,
  folderId,
}: {
  initialIdeas: Idea[];
  initialPillars: Pillar[];
  folderId: string;
}) {
  const list = useOptimisticList(initialIdeas);
  const [pillars, setPillars] = useState(initialPillars);
  const [pillarsOpen, setPillarsOpen] = useState(false);
  const [pillarFilter, setPillarFilter] = useState(ALL);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [openId, setOpenId] = useOpenParam("ideia");
  const open = list.items.find((i) => i.id === openId) ?? null;
  const pillarById = useMemo(() => new Map(pillars.map((p) => [p.id, p])), [pillars]);

  const visible = list.items.filter((i) => pillarFilter === ALL || (i.pillar_id ?? NONE) === pillarFilter);
  const columns = CONTENT_IDEA_STATUS.filter((s) => showDiscarded || s.value !== "discarded").map((s) => ({
    ...s,
    ideas: visible.filter((i) => i.status === s.value),
  }));
  const discardedCount = visible.filter((i) => i.status === "discarded").length;

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <QuickAddInput
        placeholder="Nova ideia de conteúdo…"
        onAdd={async (title) => {
          const pillar_id = pillarFilter === ALL || pillarFilter === NONE ? null : pillarFilter;
          const result = await createContentIdea({ title, folder_id: folderId, pillar_id });
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          list.setItems((items) => [result.data, ...items]);
          return true;
        }}
      />

      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Filtrar por pilar">
        {[{ id: ALL, name: "Todos", color: null }, ...pillars, { id: NONE, name: "Sem pilar", color: null }].map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={pillarFilter === p.id}
            onClick={() => setPillarFilter(p.id)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs",
              pillarFilter === p.id ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.color && <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />}
            {p.name}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPillarsOpen(true)}>
          <Settings2Icon />
          Pilares
        </Button>
      </div>

      <div className={cn("grid gap-3", showDiscarded ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {columns.map((col) => (
          <section key={col.value} className="flex flex-col rounded-lg border bg-muted/30">
            <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {col.label} <span className="font-normal tabular-nums">{col.ideas.length}</span>
            </h2>
            <ul className="flex-1 space-y-1.5 p-1.5 pt-0">
              {col.ideas.map((idea) => {
                const pillar = idea.pillar_id ? pillarById.get(idea.pillar_id) : undefined;
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
                        {idea.format && <span className="rounded bg-muted px-1.5 py-0.5">{labelOf(CONTENT_FORMATS, idea.format)}</span>}
                        {pillar && (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: pillar.color ?? undefined }} />
                            {pillar.name}
                          </span>
                        )}
                        {idea.tags.map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
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

      <PillarsDialog open={pillarsOpen} onOpenChange={setPillarsOpen} pillars={pillars} onChange={setPillars} />

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {open && (
            <ContentIdeaForm
              key={open.id}
              idea={open}
              pillars={pillars}
              onUpdate={(patch) => list.patch(open.id, patch as Partial<Idea>, () => updateContentIdea(open.id, patch))}
              onTrash={() => {
                setOpenId(null);
                list.removeItem(open.id, () => trashContent("content_ideas", open.id));
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContentIdeaForm({
  idea,
  pillars,
  onUpdate,
  onTrash,
}: {
  idea: Idea;
  pillars: Pillar[];
  onUpdate: (patch: ContentIdeaInput) => Promise<boolean>;
  onTrash: () => void;
}) {
  const router = useRouter();
  const { foldersFor } = useWorkspace();
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes ?? "");
  const [planning, setPlanning] = useState(false);
  const publicationsFolder = foldersFor("publications")[0]?.folder;

  async function plan() {
    setPlanning(true);
    const result = await createPublication({
      content_idea_id: idea.id,
      channel: "instagram",
      status: "idea",
      notes: idea.notes,
    });
    setPlanning(false);
    if (!result.ok) return toast.error(result.error);
    if (idea.status === "idea") onUpdate({ status: "developing" });
    toast.success("Publicação criada no calendário.", {
      action: publicationsFolder
        ? { label: "Abrir", onClick: () => router.push(`/p/${publicationsFolder.id}?publicacao=${result.data.id}`) }
        : undefined,
    });
  }

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="sr-only">Editar ideia de conteúdo</SheetTitle>
        <SheetDescription className="sr-only">Tudo é salvo automaticamente.</SheetDescription>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== idea.title && onUpdate({ title: title.trim() })}
          aria-label="Ideia"
          className="border-none px-0 text-base font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
          {CONTENT_IDEA_STATUS.map((s) => (
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Formato">
            <Select
              value={idea.format ?? NONE}
              onValueChange={(v) => onUpdate({ format: v === NONE ? null : (v as ContentIdeaInput["format"]) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não definido</SelectItem>
                {CONTENT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pilar">
            <Select value={idea.pillar_id ?? NONE} onValueChange={(v) => onUpdate({ pillar_id: v === NONE ? null : v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem pilar</SelectItem>
                {pillars.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: p.color ?? undefined }} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Notas e roteiro" htmlFor="ci-notes">
          <Textarea
            id="ci-notes"
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (idea.notes ?? "") && onUpdate({ notes: notes || null })}
            placeholder="Gancho, pontos principais, chamada para ação…"
          />
        </Field>

        <Field label="Tags">
          <TagsInput value={idea.tags} onChange={(tags) => onUpdate({ tags })} />
        </Field>

        <Field label="Referências">
          <LinksEditor value={idea.references as LinkItem[]} onChange={(references) => onUpdate({ references })} />
        </Field>

        <Button variant="outline" size="sm" onClick={plan} disabled={planning}>
          <CalendarPlusIcon />
          Planejar publicação
        </Button>
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
