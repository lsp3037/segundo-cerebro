"use client";

import { CheckIcon, CopyIcon, EyeOffIcon, PlusIcon, RefreshCwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOpenParam } from "@/components/use-open-param";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { type ReplyCaseInput, type ReplySuggestion, suggestReplies, trashReplyCase, updateReplyCase } from "@/lib/actions/replies";
import { formatDateTime } from "@/lib/dates";
import { describeMaskCounts, maskPersonalData } from "@/lib/mask";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type ReplyCase = Tables<"reply_cases">;
type Flow = Pick<Tables<"service_flows">, "id" | "name">;

const AUTO = "__auto__";
const NEW = "novo";

const OUTCOMES = [
  { value: "open", label: "Em andamento" },
  { value: "won", label: "Fechou" },
  { value: "lost", label: "Não fechou" },
] as const;

const OUTCOME_STYLE: Record<string, string> = {
  open: "text-muted-foreground",
  won: "text-emerald-600 dark:text-emerald-400",
  lost: "text-destructive",
};

export function ReplyAssistant({
  initialCases,
  flows,
  aiReady,
}: {
  initialCases: ReplyCase[];
  flows: Flow[];
  aiReady: boolean;
}) {
  const list = useOptimisticList(initialCases);
  const [openId, setOpenId] = useOpenParam("caso");
  const [filter, setFilter] = useState<string>("all");
  const selected = openId && openId !== NEW ? (list.items.find((c) => c.id === openId) ?? null) : null;
  const flowName = (fid: string | null) => flows.find((f) => f.id === fid)?.name;
  const visible = list.items.filter((c) => filter === "all" || c.outcome === filter);

  function upsert(saved: ReplyCase) {
    list.setItems((items) => [saved, ...items.filter((c) => c.id !== saved.id)]);
    setOpenId(saved.id);
  }

  return (
    <div className="grid gap-6 px-4 py-4 md:px-6 xl:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        {!aiReady && (
          <p className="mb-4 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            A IA ainda não está configurada (falta a chave do Gemini). Dá para consultar os casos, mas não gerar sugestões.
          </p>
        )}
        {selected ? (
          <CaseView
            key={selected.id}
            item={selected}
            flowName={flowName(selected.service_flow_id) ?? flowName(selected.detected_flow_id)}
            detected={!selected.service_flow_id && Boolean(selected.detected_flow_id)}
            aiReady={aiReady}
            onUpdate={(patch) => list.patch(selected.id, patch as Partial<ReplyCase>, () => updateReplyCase(selected.id, patch))}
            onRegenerated={upsert}
            onTrash={() => {
              setOpenId(null);
              list.removeItem(selected.id, () => trashReplyCase(selected.id));
            }}
          />
        ) : (
          <NewCaseForm key={openId ?? "new"} flows={flows} aiReady={aiReady} onCreated={upsert} />
        )}
      </div>

      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Casos</h2>
          <Button variant="outline" size="sm" onClick={() => setOpenId(NEW)}>
            <PlusIcon />
            Novo caso
          </Button>
        </div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Filtrar por resultado">
          {[{ value: "all", label: "Todos" }, ...OUTCOMES].map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={filter === o.value}
              onClick={() => setFilter(o.value)}
              className={cn(
                "h-6 rounded-full border px-2 text-[11px]",
                filter === o.value ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <ul className="space-y-1">
          {visible.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpenId(c.id)}
                aria-current={selected?.id === c.id}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left",
                  selected?.id === c.id ? "border-foreground/30 bg-accent" : "hover:border-foreground/20",
                )}
              >
                <span className="line-clamp-2 text-sm">{c.label || "Caso sem nome"}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatDateTime(c.created_at)}</span>
                  <span className={cn("ml-auto", OUTCOME_STYLE[c.outcome])}>{OUTCOMES.find((o) => o.value === c.outcome)?.label}</span>
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="text-xs text-muted-foreground">Nenhum caso ainda.</li>}
        </ul>
      </aside>
    </div>
  );
}

// Aviso do que será escondido antes de a conversa ir para a IA, com a prévia do texto enviado.
function MaskPreview({ text }: { text: string }) {
  const { masked, counts } = maskPersonalData(text);
  const summary = describeMaskCounts(counts);
  return (
    <Collapsible className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <EyeOffIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          {summary ? `Antes de enviar à IA, vou esconder ${summary}.` : "Nenhum telefone, e-mail, CPF ou endereço encontrado."} O texto
          original fica só no seu banco.
        </span>
        <CollapsibleTrigger className="shrink-0 underline-offset-2 hover:text-foreground hover:underline">Ver o que vai</CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 font-sans whitespace-pre-wrap">{masked}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FlowSelect({ flows, value, onChange }: { flows: Flow[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>Deixar a IA identificar</SelectItem>
        {flows.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NewCaseForm({ flows, aiReady, onCreated }: { flows: Flow[]; aiReady: boolean; onCreated: (c: ReplyCase) => void }) {
  const [label, setLabel] = useState("");
  const [conversation, setConversation] = useState("");
  const [flowId, setFlowId] = useState(AUTO);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const result = await suggestReplies({
          caseId: null,
          label: label.trim() || null,
          conversation,
          flowId: flowId === AUTO ? null : flowId,
        });
        setBusy(false);
        if (!result.ok) return toast.error(result.error);
        onCreated(result.data);
      }}
    >
      <div>
        <h2 className="font-semibold">Novo caso</h2>
        <p className="text-sm text-muted-foreground">Cole a conversa do WhatsApp. O assistente só sugere: nada é enviado ao cliente.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Apelido do caso (opcional)" htmlFor="rc-label">
          <Input id="rc-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: notebook Dell lento" maxLength={120} />
        </Field>
        <Field label="Tipo de serviço">
          <FlowSelect flows={flows} value={flowId} onChange={setFlowId} />
        </Field>
      </div>

      <Field label="Conversa" htmlFor="rc-conversation">
        <Textarea
          id="rc-conversation"
          rows={12}
          value={conversation}
          onChange={(e) => setConversation(e.target.value)}
          placeholder={"Cliente: Oi, meu notebook está muito lento…\nEu: …"}
          maxLength={8000}
        />
      </Field>

      {conversation.trim() && <MaskPreview text={conversation} />}

      <Button type="submit" disabled={busy || !aiReady || conversation.trim().length < 10}>
        <SparklesIcon />
        {busy ? "Pensando…" : "Sugerir respostas"}
      </Button>
    </form>
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado. É só colar no WhatsApp.");
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function CaseView({
  item,
  flowName,
  detected,
  aiReady,
  onUpdate,
  onRegenerated,
  onTrash,
}: {
  item: ReplyCase;
  flowName?: string;
  detected: boolean;
  aiReady: boolean;
  onUpdate: (patch: ReplyCaseInput) => Promise<boolean>;
  onRegenerated: (c: ReplyCase) => void;
  onTrash: () => void;
}) {
  const output = item.ai_output as ReplySuggestion | null;
  const [label, setLabel] = useState(item.label ?? "");
  const [chosen, setChosen] = useState(item.chosen_reply ?? "");
  const [notes, setNotes] = useState(item.outcome_notes ?? "");
  const [conversation, setConversation] = useState(item.conversation_text ?? "");
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    const result = await suggestReplies({ caseId: item.id, label: item.label, conversation, flowId: item.service_flow_id });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    onRegenerated(result.data);
  }

  return (
    <article className="max-w-2xl space-y-5">
      <header className="space-y-1">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() !== (item.label ?? "") && onUpdate({ label: label.trim() || null })}
          aria-label="Apelido do caso"
          className="h-9 border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <p className="text-xs text-muted-foreground">
          {formatDateTime(item.created_at)}
          {flowName && ` · ${detected ? "Fluxo identificado pela IA" : "Fluxo"}: ${flowName}`}
        </p>
      </header>

      {output && (
        <>
          <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">{output.summary}</p>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Opções de resposta</h3>
            {output.replies.map((r, i) => {
              const isChosen = item.chosen_reply === r.text;
              return (
                <div key={i} className={cn("rounded-lg border p-3", isChosen && "border-emerald-500/50 bg-emerald-500/5")}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{r.label}</span>
                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => copy(r.text)}>
                      <CopyIcon />
                      Copiar
                    </Button>
                    <Button
                      variant={isChosen ? "secondary" : "outline"}
                      size="sm"
                      className="h-7"
                      onClick={() => {
                        setChosen(r.text);
                        onUpdate({ chosen_reply: r.text });
                      }}
                    >
                      <CheckIcon />
                      {isChosen ? "Escolhida" : "Usar esta"}
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.text}</p>
                </div>
              );
            })}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Próximo passo</h3>
              <p className="text-sm">{output.next_step}</p>
            </section>
            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ainda falta perguntar</h3>
              {output.missing_info.length ? (
                <ul className="list-disc space-y-0.5 pl-4 text-sm">
                  {output.missing_info.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nada importante.</p>
              )}
            </section>
          </div>
        </>
      )}

      <Field label="Resposta que você mandou (pode ajustar)" htmlFor="rc-chosen">
        <Textarea
          id="rc-chosen"
          rows={3}
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          onBlur={() => chosen !== (item.chosen_reply ?? "") && onUpdate({ chosen_reply: chosen || null })}
        />
      </Field>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Resultado</h3>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resultado">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={item.outcome === o.value}
              onClick={() => onUpdate({ outcome: o.value })}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs",
                item.outcome === o.value ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (item.outcome_notes ?? "") && onUpdate({ outcome_notes: notes || null })}
          placeholder="O que funcionou ou não, para melhorar o fluxo depois"
          aria-label="Anotações do resultado"
        />
      </section>

      <Collapsible className="space-y-2">
        <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Conversa e gerar de novo
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          <Textarea rows={8} value={conversation} onChange={(e) => setConversation(e.target.value)} aria-label="Conversa" maxLength={8000} />
          {conversation.trim() && <MaskPreview text={conversation} />}
          <Button variant="outline" size="sm" onClick={regenerate} disabled={busy || !aiReady || conversation.trim().length < 10}>
            <RefreshCwIcon />
            {busy ? "Pensando…" : "Gerar de novo"}
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end border-t pt-3">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onTrash}>
          <Trash2Icon />
          Excluir caso
        </Button>
      </div>
    </article>
  );
}
