"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { LgpdNotice } from "@/components/lgpd-notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/components/workspace";
import { suggestInboxClassification } from "@/lib/actions/ai";
import { convertInboxItem } from "@/lib/actions/inbox";
import { CONVERT_TARGETS, type ConvertTarget, TARGETS } from "@/lib/inbox";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function ConvertDialog({
  item,
  aiConfigured,
  onClose,
  onDone,
}: {
  item: Tables<"inbox_items"> | null;
  aiConfigured: boolean;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && <ConvertForm key={item.id} item={item} aiConfigured={aiConfigured} onClose={onClose} onDone={onDone} />}
    </Dialog>
  );
}

function ConvertForm({
  item,
  aiConfigured,
  onClose,
  onDone,
}: {
  item: Tables<"inbox_items">;
  aiConfigured: boolean;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const router = useRouter();
  const { areas, foldersFor } = useWorkspace();
  const firstLine = item.content.split("\n")[0].slice(0, 300);
  const [target, setTarget] = useState<ConvertTarget>("task");
  const [title, setTitle] = useState(firstLine);
  const [areaId, setAreaId] = useState(areas.find((a) => a.slug === "pessoal")?.id ?? areas[0].id);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [keepContent, setKeepContent] = useState(true);
  const [pending, startTransition] = useTransition();
  const [suggesting, startSuggesting] = useTransition();

  const forcedArea = TARGETS[target].areaSlug ? areas.find((a) => a.slug === TARGETS[target].areaSlug) : undefined;
  const effectiveArea = forcedArea?.id ?? areaId;
  const area = areas.find((a) => a.id === effectiveArea);
  const folders = foldersFor(TARGETS[target].modules, effectiveArea);
  const validFolder = folders.some((f) => f.folder.id === folderId) ? folderId : null;

  function chooseTarget(next: ConvertTarget) {
    setTarget(next);
    setFolderId(null);
  }

  function suggest() {
    startSuggesting(async () => {
      const result = await suggestInboxClassification(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTarget(result.data.target);
      setAreaId(result.data.areaId);
      setFolderId(result.data.folderId);
      setTitle(result.data.title);
      toast.success("Sugestão aplicada. Confira antes de salvar.");
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await convertInboxItem(item.id, {
        target,
        title,
        area_id: effectiveArea,
        folder_id: validFolder,
        due_date: target === "task" && dueDate ? dueDate : null,
        keepContent,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone(item.id);
      toast.success(`Virou ${TARGETS[target].label.toLowerCase()}.`, {
        action: { label: "Abrir", onClick: () => router.push(result.data.href) },
      });
    });
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="contents">
        <DialogHeader>
          <DialogTitle>Organizar</DialogTitle>
          <DialogDescription className="line-clamp-3 whitespace-pre-line">{item.content}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Transformar em">
            {CONVERT_TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={t === target}
                onClick={() => chooseTarget(t)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm",
                  t === target ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name={TARGETS[t].icon} className="size-3.5" />
                {TARGETS[t].label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-title">Título</Label>
            <Input id="convert-title" required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={effectiveArea} onValueChange={(v) => { setAreaId(v); setFolderId(null); }} disabled={Boolean(forcedArea)}>
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
            </div>
            <div className="space-y-1.5">
              <Label>Pasta</Label>
              <Select value={validFolder ?? NONE} onValueChange={(v) => setFolderId(v === NONE ? null : v)}>
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
            </div>
          </div>

          {target === "task" && (
            <div className="space-y-1.5">
              <Label htmlFor="convert-date">Data (opcional)</Label>
              <Input id="convert-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-48" />
            </div>
          )}

          <label className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
            Guardar o texto original junto
            <Switch checked={keepContent} onCheckedChange={setKeepContent} />
          </label>

          {area?.show_lgpd_notice && <LgpdNotice />}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex flex-col items-start">
            <Button type="button" variant="ghost" size="sm" onClick={suggest} disabled={!aiConfigured || suggesting}>
              {suggesting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              Sugerir com IA
            </Button>
            <span className="px-2 text-[11px] text-muted-foreground">
              {aiConfigured ? "Envia este texto ao Gemini. Evite itens da SES." : "Disponível depois de configurar o Gemini."}
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending && <Loader2Icon className="animate-spin" />}
              Criar {TARGETS[target].label.toLowerCase()}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
