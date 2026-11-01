"use client";

import { ExternalLinkIcon, FileTextIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AreaFolderFields, Field, type LinkItem, LinksEditor, QuickAddInput } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { useWorkspace } from "@/components/workspace";
import {
  createLearningItem,
  type LearningInput,
  learningToNote,
  trashItem,
  updateLearningItem,
} from "@/lib/actions/learning-ideas";
import { formatShortDate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Item = Tables<"learning_items">;

const STATUS = [
  { value: "learning", label: "Aprendendo" },
  { value: "wishlist", label: "Quero aprender" },
  { value: "paused", label: "Pausado" },
  { value: "done", label: "Concluído" },
] as const;

export function LearningBoard({
  initialItems,
  defaultAreaId,
  folderId = null,
}: {
  initialItems: Item[];
  defaultAreaId: string;
  folderId?: string | null;
}) {
  const { folderById } = useWorkspace();
  const list = useOptimisticList(initialItems);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.items.find((i) => i.id === openId) ?? null;

  function update(item: Item, patch: LearningInput) {
    const local = { ...patch, ...(patch.status === "done" ? { progress: 100 } : {}) } as Partial<Item>;
    return list.patch(item.id, local, () => updateLearningItem(item.id, patch));
  }

  return (
    <div className="space-y-6 px-4 py-4 md:px-6">
      <QuickAddInput
        placeholder="O que você quer aprender?"
        onAdd={async (topic) => {
          const areaId = folderId ? (folderById.get(folderId)?.area_id ?? defaultAreaId) : defaultAreaId;
          const result = await createLearningItem({ topic, area_id: areaId, folder_id: folderId });
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          list.setItems((items) => [result.data, ...items]);
          return true;
        }}
      />

      {list.items.length === 0 && (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Nada na lista ainda. Ex.: Power BI, metodologia de pesquisa, Docker.
        </p>
      )}

      {STATUS.map(({ value, label }) => {
        const items = list.items.filter((i) => i.status === value);
        if (items.length === 0) return null;
        return (
          <section key={value} className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {label} <span className="font-normal tabular-nums">{items.length}</span>
            </h2>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    className="flex h-full w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:border-foreground/25 hover:bg-accent/30"
                  >
                    <span className="text-sm font-medium">{item.topic}</span>
                    {item.reason && <span className="line-clamp-2 text-xs text-muted-foreground">{item.reason}</span>}
                    <span className="mt-auto flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${item.progress}%` }} />
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{item.progress}%</span>
                    </span>
                    <span className="flex gap-3 text-xs text-muted-foreground">
                      {(item.resources as LinkItem[]).length > 0 && <span>{(item.resources as LinkItem[]).length} recursos</span>}
                      {item.target_date && <span>até {formatShortDate(item.target_date)}</span>}
                      {item.note_id && <span>virou nota</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {open && (
            <LearningForm
              key={open.id}
              item={open}
              onUpdate={(patch) => update(open, patch)}
              onTrash={() => {
                setOpenId(null);
                list.removeItem(open.id, () => trashItem("learning_items", open.id));
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LearningForm({
  item,
  onUpdate,
  onTrash,
}: {
  item: Item;
  onUpdate: (patch: LearningInput) => Promise<boolean>;
  onTrash: () => void;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState(item.topic);
  const [reason, setReason] = useState(item.reason ?? "");
  const [progress, setProgress] = useState(item.progress);
  const [converting, startConverting] = useTransition();

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="sr-only">Editar aprendizado</SheetTitle>
        <SheetDescription className="sr-only">Tudo é salvo automaticamente.</SheetDescription>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onBlur={() => topic.trim() && topic.trim() !== item.topic && onUpdate({ topic: topic.trim() })}
          aria-label="Tema"
          className="border-none px-0 text-base font-medium shadow-none focus-visible:ring-0"
        />
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
          {STATUS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={item.status === s.value}
              onClick={() => onUpdate({ status: s.value })}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs",
                item.status === s.value ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Field label={`Progresso: ${progress}%`} htmlFor="learning-progress">
          <input
            id="learning-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            onPointerUp={() => progress !== item.progress && onUpdate({ progress })}
            onKeyUp={() => progress !== item.progress && onUpdate({ progress })}
            className="w-full accent-foreground"
          />
        </Field>

        <Field label="Por que aprender" htmlFor="learning-reason">
          <Textarea
            id="learning-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => reason !== (item.reason ?? "") && onUpdate({ reason: reason || null })}
            placeholder="Para o mestrado, para a Trust Care…"
          />
        </Field>

        <Field label="Prazo (opcional)" htmlFor="learning-date">
          <Input
            id="learning-date"
            type="date"
            value={item.target_date ?? ""}
            onChange={(e) => onUpdate({ target_date: e.target.value || null })}
            className="w-48"
          />
        </Field>

        <AreaFolderFields
          areaId={item.area_id}
          folderId={item.folder_id}
          modules={["learning"]}
          onChange={(v) => onUpdate(v)}
        />

        <Field label="Recursos (cursos, vídeos, livros)">
          <LinksEditor value={item.resources as LinkItem[]} onChange={(resources) => onUpdate({ resources })} />
        </Field>

        <div className="rounded-lg border p-3">
          {item.note_id ? (
            <Link href={`/conhecimento/${item.note_id}`} className="flex items-center gap-2 text-sm hover:underline">
              <FileTextIcon className="size-4" />
              Abrir a nota deste aprendizado
              <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />
            </Link>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Concluiu? Guarde o que aprendeu numa nota do Conhecimento.</p>
              <Button
                variant="outline"
                size="sm"
                disabled={converting}
                onClick={() =>
                  startConverting(async () => {
                    const result = await learningToNote(item.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    router.push(`/conhecimento/${result.data.noteId}`);
                  })
                }
              >
                {converting ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />}
                Virar nota
              </Button>
            </div>
          )}
        </div>
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
