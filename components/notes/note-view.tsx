"use client";

import { ArrowLeftIcon, CheckIcon, Loader2Icon, PinIcon, PinOffIcon, Trash2Icon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { LgpdNotice } from "@/components/lgpd-notice";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace";
import { saveNoteContent, trashNote, updateNoteMeta } from "@/lib/actions/notes";
import { formatDateTime } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import type { NoteContent } from "./note-editor";

// O editor só roda no navegador.
const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted/40" />,
});

const NONE = "__none__";
type SaveState = "saved" | "saving" | "error";

export function NoteView({
  note,
  otherNotes,
  backlinks,
}: {
  note: Tables<"notes">;
  otherNotes: { id: string; title: string }[];
  backlinks: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { areas, areaById, foldersFor } = useWorkspace();
  const [title, setTitle] = useState(note.title);
  const [areaId, setAreaId] = useState(note.area_id);
  const [folderId, setFolderId] = useState(note.folder_id);
  const [tags, setTags] = useState(note.tags);
  const [pinned, setPinned] = useState(note.pinned);
  const [tagDraft, setTagDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(note.updated_at);
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  const area = areaById.get(areaId);
  const folders = foldersFor(["notes", "meetings"], areaId);

  // Salvamentos em fila, para nunca gravar uma versão antiga por cima de uma nova.
  function queue(task: () => Promise<{ ok: boolean; error?: string }>) {
    setSaveState("saving");
    saving.current = saving.current.then(async () => {
      const result = await task();
      if (result.ok) {
        setSaveState("saved");
        setSavedAt(new Date().toISOString());
      } else {
        setSaveState("error");
        toast.error(result.error ?? "Não foi possível salvar.");
      }
    });
  }

  function saveMeta(patch: Parameters<typeof updateNoteMeta>[1]) {
    queue(() => updateNoteMeta(note.id, patch));
  }

  function addTag() {
    const tag = tagDraft.trim().replace(/^#/, "").toLowerCase();
    setTagDraft("");
    if (!tag || tags.includes(tag)) return;
    const next = [...tags, tag];
    setTags(next);
    saveMeta({ tags: next });
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    saveMeta({ tags: next });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 md:px-10">
      <div className="flex items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
        <Link href="/conhecimento" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          Conhecimento
        </Link>
        <span className="flex items-center gap-1.5" aria-live="polite">
          {saveState === "saving" && <Loader2Icon className="size-3 animate-spin" />}
          {saveState === "saved" && <CheckIcon className="size-3" />}
          {saveState === "saving" ? "Salvando…" : saveState === "error" ? "Erro ao salvar" : `Salvo · ${formatDateTime(savedAt)}`}
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const text = title.trim() || "Sem título";
          setTitle(text);
          if (text !== note.title) saveMeta({ title: text });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="Sem título"
        aria-label="Título da nota"
        maxLength={300}
        className="w-full bg-transparent px-[54px] text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 max-md:px-0"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2 px-[54px] max-md:px-0">
        <Select
          value={areaId}
          onValueChange={(v) => {
            setAreaId(v);
            setFolderId(null);
            saveMeta({ area_id: v, folder_id: null });
          }}
        >
          <SelectTrigger size="sm" className="h-7 w-auto text-xs" aria-label="Área">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={folderId ?? NONE}
          onValueChange={(v) => {
            const next = v === NONE ? null : v;
            setFolderId(next);
            saveMeta({ folder_id: next });
          }}
        >
          <SelectTrigger size="sm" className="h-7 w-auto text-xs" aria-label="Pasta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem pasta</SelectItem>
            {folders.map(({ folder, label }) => (
              <SelectItem key={folder.id} value={folder.id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.map((tag) => (
          <span key={tag} className="flex h-6 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-xs">
            #{tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remover tag ${tag}`} className="rounded-full p-0.5 hover:bg-background">
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder="+ tag"
          aria-label="Nova tag"
          maxLength={40}
          className="h-6 w-20 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={pinned ? "Desafixar" : "Fixar no topo"}
            title={pinned ? "Desafixar" : "Fixar no topo"}
            onClick={() => {
              setPinned(!pinned);
              saveMeta({ pinned: !pinned });
            }}
          >
            {pinned ? <PinOffIcon /> : <PinIcon />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir nota"
            title="Excluir nota"
            onClick={async () => {
              const result = await trashNote(note.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Nota excluída.");
              router.push("/conhecimento");
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {area?.show_lgpd_notice && <LgpdNotice className="mx-[54px] mt-4 max-md:mx-0" />}

      <div className="mt-6 -mx-2 md:mx-0">
        <NoteEditor
          noteId={note.id}
          initialJson={note.content_json}
          initialMarkdown={note.content_md}
          otherNotes={otherNotes}
          onChange={(content: NoteContent) => queue(() => saveNoteContent(note.id, content))}
        />
      </div>

      {backlinks.length > 0 && (
        <section className="mx-[54px] mt-12 border-t pt-4 max-md:mx-0">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notas que apontam para esta</h2>
          <ul className="mt-2 space-y-1">
            {backlinks.map((b) => (
              <li key={b.id}>
                <Link href={`/conhecimento/${b.id}`} className="text-sm underline-offset-4 hover:underline">
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mx-[54px] mt-10 text-xs text-muted-foreground max-md:mx-0">
        Dica: digite <kbd className="font-mono">/</kbd> para escolher o tipo de bloco e <kbd className="font-mono">@</kbd> para
        linkar outra nota. Arraste arquivos para dentro da nota para anexar.
      </p>
    </div>
  );
}
