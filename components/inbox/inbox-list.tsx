"use client";

import { ArchiveIcon, ExternalLinkIcon, InboxIcon, MoreHorizontalIcon, PlusIcon, SendIcon, Trash2Icon, WandIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setInboxStatus, trashInboxItem } from "@/lib/actions/inbox";
import { formatDateTime } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { CaptureDialog } from "./capture-dialog";
import { ConvertDialog } from "./convert-dialog";

type Item = Tables<"inbox_items">;

export function InboxList({ initialItems, aiConfigured }: { initialItems: Item[]; aiConfigured: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [prev, setPrev] = useState(initialItems);
  if (prev !== initialItems) {
    setPrev(initialItems);
    setItems(initialItems);
  }
  const [converting, setConverting] = useState<Item | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  function drop(id: string) {
    setItems((list) => list.filter((i) => i.id !== id));
  }

  async function archive(item: Item) {
    drop(item.id);
    const result = await setInboxStatus(item.id, "archived");
    if (!result.ok) {
      setItems((list) => [item, ...list]);
      toast.error(result.error);
      return;
    }
    toast("Arquivado.", {
      action: { label: "Desfazer", onClick: () => setInboxStatus(item.id, "new") },
    });
  }

  async function remove(item: Item) {
    drop(item.id);
    const result = await trashInboxItem(item.id);
    if (!result.ok) {
      setItems((list) => [item, ...list]);
      toast.error(result.error);
    }
  }

  if (items.length === 0) {
    return (
      <>
        <div className="mx-4 my-8 rounded-2xl border border-dashed px-6 py-12 text-center md:mx-6 space-y-3 bg-card/50">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <InboxIcon className="size-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Caixa de Entrada limpa e organizada</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Teve uma ideia, viu um link ou recebeu uma demanda? Guarde agora e organize depois.
            </p>
          </div>
          <div className="pt-2">
            <Button onClick={() => setCaptureOpen(true)} className="gap-2 cursor-pointer shadow-xs">
              <PlusIcon className="size-4" />
              <span>Capturar agora</span>
              <kbd className="hidden sm:inline-block rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono font-medium">
                Alt+N
              </kbd>
            </Button>
          </div>
        </div>
        <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      </>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="group flex items-start gap-3 px-4 py-3 md:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-sm break-words whitespace-pre-line">{item.content}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {formatDateTime(item.created_at)}
                {item.source === "telegram" && (
                  <span className="flex items-center gap-1">
                    <SendIcon className="size-3" />
                    Telegram
                  </span>
                )}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                    <ExternalLinkIcon className="size-3" />
                    abrir link
                  </a>
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setConverting(item)}>
              <WandIcon />
              Organizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Mais opções">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => archive(item)}>
                  <ArchiveIcon />
                  Arquivar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => remove(item)}>
                  <Trash2Icon />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <ConvertDialog
        item={converting}
        aiConfigured={aiConfigured}
        onClose={() => setConverting(null)}
        onDone={(id) => {
          setConverting(null);
          drop(id);
        }}
      />
    </>
  );
}
