"use client";

import { ArrowDownIcon, ArrowUpIcon, CopyIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, QuickAddInput } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOpenParam } from "@/components/use-open-param";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { createFlow, createSuggestedFlows, type FlowInput, trashFlow, updateFlow } from "@/lib/actions/flows";
import type { MessageTemplate, Objection } from "@/lib/service-flows";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Flow = Tables<"service_flows">;

export function FlowsBoard({ initialFlows }: { initialFlows: Flow[] }) {
  const list = useOptimisticList(initialFlows);
  const [openId, setOpenId] = useOpenParam("fluxo");
  const [busy, setBusy] = useState(false);
  const selected = list.items.find((f) => f.id === openId) ?? list.items[0] ?? null;

  return (
    <div className="grid gap-4 px-4 py-4 md:px-6 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-3">
        <QuickAddInput
          placeholder="Novo fluxo…"
          onAdd={async (name) => {
            const result = await createFlow({ name });
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            list.setItems((items) => [...items, result.data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
            setOpenId(result.data.id);
            return true;
          }}
        />
        <nav aria-label="Fluxos" className="space-y-0.5">
          {list.items.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setOpenId(f.id)}
              aria-current={selected?.id === f.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm",
                selected?.id === f.id ? "bg-accent font-medium" : "hover:bg-accent/50",
                !f.active && "text-muted-foreground",
              )}
            >
              <span className="truncate">{f.name}</span>
              {!f.active && <span className="ml-auto text-[11px]">pausado</span>}
            </button>
          ))}
        </nav>
        {list.items.length === 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              Começar com formatação, limpeza, upgrade, diagnóstico e notebook à venda? Você ajusta depois.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await createSuggestedFlows();
                setBusy(false);
                if (!result.ok) return toast.error(result.error);
                list.setItems(result.data.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
              }}
            >
              Criar fluxos sugeridos
            </Button>
          </div>
        )}
      </aside>

      {selected ? (
        <FlowEditor
          key={selected.id}
          flow={selected}
          onUpdate={(patch) => list.patch(selected.id, patch as Partial<Flow>, () => updateFlow(selected.id, patch))}
          onTrash={() => {
            setOpenId(null);
            list.removeItem(selected.id, () => trashFlow(selected.id));
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Crie um fluxo para começar.</p>
      )}
    </div>
  );
}

function FlowEditor({ flow, onUpdate, onTrash }: { flow: Flow; onUpdate: (patch: FlowInput) => Promise<boolean>; onTrash: () => void }) {
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description ?? "");

  return (
    <article className="min-w-0 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== flow.name && onUpdate({ name: name.trim() })}
            aria-label="Nome do fluxo"
            className="h-9 border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            Ativo
            <Switch checked={flow.active} onCheckedChange={(active) => onUpdate({ active })} />
          </label>
        </div>
        <Textarea
          value={description}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (flow.description ?? "") && onUpdate({ description: description || null })}
          placeholder="Quando usar este fluxo"
          aria-label="Descrição"
        />
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <Field label="Etapas">
          <ListEditor value={flow.steps as string[]} numbered onChange={(steps) => onUpdate({ steps })} placeholder="Nova etapa" />
        </Field>
        <Field label="Perguntas a fazer">
          <ListEditor value={flow.questions as string[]} onChange={(questions) => onUpdate({ questions })} placeholder="Nova pergunta" />
        </Field>
        <Field label="Informações a coletar">
          <ListEditor
            value={flow.info_to_collect as string[]}
            onChange={(info_to_collect) => onUpdate({ info_to_collect })}
            placeholder="Nova informação"
          />
        </Field>
        <Field label="Próximos passos">
          <ListEditor value={flow.next_steps as string[]} onChange={(next_steps) => onUpdate({ next_steps })} placeholder="Novo passo" />
        </Field>
      </div>

      <Field label="Mensagens-modelo">
        <TemplatesEditor value={flow.message_templates as MessageTemplate[]} onChange={(message_templates) => onUpdate({ message_templates })} />
      </Field>

      <Field label="Objeções comuns">
        <ObjectionsEditor value={flow.objections as Objection[]} onChange={(objections) => onUpdate({ objections })} />
      </Field>

      <div className="flex justify-end border-t pt-3">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onTrash}>
          <Trash2Icon />
          Excluir fluxo
        </Button>
      </div>
    </article>
  );
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Lista de frases curtas: editar no lugar, reordenar, remover e adicionar.
function ListEditor({
  value,
  onChange,
  placeholder,
  numbered,
}: {
  value: string[];
  onChange: (list: string[]) => void;
  placeholder: string;
  numbered?: boolean;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="space-y-1.5">
      <ol className="space-y-1">
        {value.map((item, i) => (
          <li key={`${i}-${item}`} className="group flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{numbered ? `${i + 1}.` : "•"}</span>
            <Input
              defaultValue={item}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === item) return;
                onChange(v ? value.map((x, j) => (j === i ? v : x)) : value.filter((_, j) => j !== i));
              }}
              className="h-8"
              aria-label={`Item ${i + 1}`}
            />
            <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
              <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => onChange(move(value, i, i - 1))} aria-label="Subir">
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === value.length - 1}
                onClick={() => onChange(move(value, i, i + 1))}
                aria-label="Descer"
              >
                <ArrowDownIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover">
                <XIcon />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="flex items-center gap-1.5 pl-6.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange([...value, draft.trim()]);
          setDraft("");
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="h-8" aria-label={placeholder} />
        <Button type="submit" variant="outline" size="icon-sm" aria-label="Adicionar">
          <PlusIcon />
        </Button>
      </form>
    </div>
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado.");
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function TemplatesEditor({ value, onChange }: { value: MessageTemplate[]; onChange: (list: MessageTemplate[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((t, i) => (
        <div key={`${i}-${t.title}`} className="space-y-1.5 rounded-lg border p-2.5">
          <div className="flex items-center gap-1.5">
            <Input
              defaultValue={t.title}
              onBlur={(e) => e.target.value !== t.title && onChange(value.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              placeholder="Quando usar (ex.: primeiro contato)"
              className="h-8 font-medium"
              aria-label="Título da mensagem"
            />
            <Button variant="ghost" size="icon-sm" onClick={() => copy(t.text)} aria-label="Copiar mensagem">
              <CopyIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover mensagem">
              <XIcon />
            </Button>
          </div>
          <Textarea
            defaultValue={t.text}
            rows={3}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== t.text) onChange(value.map((x, j) => (j === i ? { ...x, text: v } : x)));
            }}
            aria-label="Texto da mensagem"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...value, { title: "", text: "Escreva a mensagem…" }])}>
        <PlusIcon />
        Mensagem
      </Button>
    </div>
  );
}

function ObjectionsEditor({ value, onChange }: { value: Objection[]; onChange: (list: Objection[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((o, i) => (
        <div key={`${i}-${o.objection}`} className="grid gap-1.5 rounded-lg border p-2.5 md:grid-cols-[1fr_2fr_auto]">
          <Input
            defaultValue={o.objection}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== o.objection) onChange(value.map((x, j) => (j === i ? { ...x, objection: v } : x)));
            }}
            placeholder="O que o cliente diz"
            className="h-8"
            aria-label="Objeção"
          />
          <Textarea
            defaultValue={o.answer}
            rows={2}
            onBlur={(e) => e.target.value !== o.answer && onChange(value.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
            placeholder="Como responder"
            className="min-h-8"
            aria-label="Resposta"
          />
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover objeção">
            <XIcon />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...value, { objection: "Nova objeção", answer: "" }])}>
        <PlusIcon />
        Objeção
      </Button>
    </div>
  );
}
