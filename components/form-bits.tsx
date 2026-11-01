"use client";

import { ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace";
import type { FolderModule } from "@/lib/modules";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type LinkItem = { title: string; url: string };

// Lista de links (título + endereço) com adicionar e remover.
export function LinksEditor({ value, onChange }: { value: LinkItem[]; onChange: (links: LinkItem[]) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  function add() {
    let href = url.trim();
    if (!href) return;
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
    try {
      new URL(href);
    } catch {
      return;
    }
    onChange([...value, { title: title.trim(), url: href }]);
    setTitle("");
    setUrl("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((link, i) => (
            <li key={`${link.url}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
              <a href={link.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 hover:underline">
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{link.title || link.url}</span>
              </a>
              <button
                type="button"
                aria-label="Remover link"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className="h-8 w-2/5" aria-label="Título do link" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="https://…"
          className="h-8 flex-1"
          aria-label="Endereço do link"
        />
        <Button type="button" variant="outline" size="icon-sm" onClick={add} aria-label="Adicionar link">
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}

// Tags em "pílulas"; Enter ou vírgula adiciona.
export function TagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const tag = draft.trim().replace(/^#/, "").toLowerCase();
    setDraft("");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1">
      {value.map((tag) => (
        <span key={tag} className="flex h-6 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-xs">
          #{tag}
          <button type="button" aria-label={`Remover ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))} className="rounded-full p-0.5 hover:bg-background">
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={value.length ? "" : "Adicionar tag"}
        aria-label="Nova tag"
        maxLength={40}
        className="h-6 min-w-20 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

const NONE = "__none__";

// Seletores de área e pasta lado a lado (a pasta filtra pelo tipo e pela área).
export function AreaFolderFields({
  areaId,
  folderId,
  modules,
  onChange,
}: {
  areaId: string;
  folderId: string | null;
  modules: FolderModule[];
  onChange: (value: { area_id: string; folder_id: string | null }) => void;
}) {
  const { areas, foldersFor } = useWorkspace();
  const folders = foldersFor(modules, areaId);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Área">
        <Select value={areaId} onValueChange={(v) => onChange({ area_id: v, folder_id: null })}>
          <SelectTrigger className="w-full">
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
      </Field>
      <Field label="Pasta">
        <Select value={folderId ?? NONE} onValueChange={(v) => onChange({ area_id: areaId, folder_id: v === NONE ? null : v })}>
          <SelectTrigger className="w-full">
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
      </Field>
    </div>
  );
}

// Campo de "adicionar" de uma linha, usado no topo das listas.
export function QuickAddInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        if (await onAdd(text.trim())) setText("");
        setBusy(false);
      }}
      className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/30"
    >
      <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={300}
        className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}
