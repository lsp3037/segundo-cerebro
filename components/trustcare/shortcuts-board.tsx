"use client";

import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form-bits";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { createShortcut, createSuggestedShortcuts, type ShortcutInput, trashShortcut, updateShortcut } from "@/lib/actions/shortcuts";
import type { OsSummary } from "@/lib/integrations/os-manager";
import type { Tables } from "@/lib/supabase/database.types";

type Shortcut = Tables<"shortcuts">;

const ICON_CHOICES = [
  { value: "link", label: "Link" },
  { value: "wrench", label: "Ferramenta" },
  { value: "megaphone", label: "Marketing" },
  { value: "store", label: "Loja" },
  { value: "calculator", label: "Calculadora" },
  { value: "globe", label: "Site" },
  { value: "wallet", label: "Carteira" },
];

export function ShortcutsBoard({
  initialShortcuts,
  folderId,
  osSummary,
  accent,
}: {
  initialShortcuts: Shortcut[];
  folderId: string;
  osSummary: OsSummary;
  accent: string;
}) {
  const list = useOptimisticList(initialShortcuts);
  const [editing, setEditing] = useState<Shortcut | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.items.map((s) => (
          <ShortcutCard key={s.id} shortcut={s} osSummary={osSummary} accent={accent} onEdit={() => setEditing(s)} />
        ))}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          <PlusIcon className="size-4" />
          Novo atalho
        </button>
      </div>

      {list.items.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">Começar com Gerenciador de O.S., Agente de Marketing e Loja online?</span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await createSuggestedShortcuts(folderId);
              setBusy(false);
              if (!result.ok) return toast.error(result.error);
              list.setItems(result.data);
            }}
          >
            Criar atalhos sugeridos
          </Button>
        </div>
      )}

      <ShortcutDialog
        key={editing === "new" ? "new" : editing?.id}
        shortcut={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (editing === "new") {
            const result = await createShortcut({ ...values, folder_id: folderId, sort_order: list.items.length });
            if (!result.ok) return toast.error(result.error);
            list.setItems((items) => [...items, result.data]);
            setEditing(null);
          } else if (editing) {
            const saved = await list.patch(editing.id, values as Partial<Shortcut>, () => updateShortcut(editing.id, values));
            if (saved) setEditing(null);
          }
        }}
        onTrash={
          editing && editing !== "new"
            ? () => {
                list.removeItem(editing.id, () => trashShortcut(editing.id));
                setEditing(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function ShortcutCard({
  shortcut,
  osSummary,
  accent,
  onEdit,
}: {
  shortcut: Shortcut;
  osSummary: OsSummary;
  accent: string;
  onEdit: () => void;
}) {
  return (
    <article className="group relative flex flex-col rounded-xl border bg-background p-4 hover:border-foreground/25">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50" style={{ color: accent }}>
          <Icon name={shortcut.icon ?? "link"} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <a href={shortcut.url} target="_blank" rel="noreferrer" className="font-medium after:absolute after:inset-0 hover:underline">
            {shortcut.title}
          </a>
          {shortcut.description && <p className="line-clamp-2 text-xs text-muted-foreground">{shortcut.description}</p>}
        </div>
        <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {shortcut.widget === "os_summary" && <OsSummaryWidget summary={osSummary} />}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEdit}
        aria-label={`Editar ${shortcut.title}`}
        className="absolute right-2 bottom-2 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <PencilIcon />
      </Button>
    </article>
  );
}

function OsSummaryWidget({ summary }: { summary: OsSummary }) {
  if (summary.status === "not_configured") {
    return <p className="mt-3 text-xs text-muted-foreground">Resumo desligado: falta a chave de leitura do Gerenciador (OS_API_KEY).</p>;
  }
  if (summary.status === "error") {
    return <p className="mt-3 text-xs text-destructive">{summary.message}</p>;
  }

  const stats = [
    { label: "Abertas", value: summary.open },
    { label: "Atrasadas", value: summary.late, hint: "abertas há mais de 7 dias", alert: summary.late > 0 },
    { label: "Aguardando peça", value: summary.waitingParts },
  ];

  return (
    <div className="mt-4 space-y-2">
      <dl className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/40 px-2.5 py-2" title={s.hint}>
            <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
            <dd className={s.alert ? "text-lg font-semibold text-destructive tabular-nums" : "text-lg font-semibold tabular-nums"}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {summary.byStatus.length > 0 && (
        <p className="pr-8 text-[11px] text-muted-foreground">{summary.byStatus.map((s) => `${s.status}: ${s.count}`).join(" · ")}</p>
      )}
    </div>
  );
}

function ShortcutDialog({
  shortcut,
  onClose,
  onSave,
  onTrash,
}: {
  shortcut: Shortcut | "new" | null;
  onClose: () => void;
  onSave: (values: ShortcutInput) => Promise<unknown>;
  onTrash?: () => void;
}) {
  const current = shortcut && shortcut !== "new" ? shortcut : null;
  const [title, setTitle] = useState(current?.title ?? "");
  const [url, setUrl] = useState(current?.url ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [icon, setIcon] = useState(current?.icon ?? "link");
  const [osWidget, setOsWidget] = useState(current?.widget === "os_summary");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={shortcut !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onSave({ title, url, description: description.trim() || null, icon, widget: osWidget ? "os_summary" : null });
            setBusy(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{current ? "Editar atalho" : "Novo atalho"}</DialogTitle>
            <DialogDescription>Abre em uma nova aba.</DialogDescription>
          </DialogHeader>

          <Field label="Nome" htmlFor="sc-title">
            <Input id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Endereço" htmlFor="sc-url">
            <Input id="sc-url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
          </Field>
          <Field label="Descrição" htmlFor="sc-desc">
            <Input id="sc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </Field>
          <Field label="Ícone">
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_CHOICES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <Icon name={c.value} className="size-4" />
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm">
            Mostrar resumo das O.S. neste card
            <Switch checked={osWidget} onCheckedChange={setOsWidget} />
          </label>

          <DialogFooter className="sm:justify-between">
            {onTrash ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onTrash}>
                <Trash2Icon />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={busy}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
