"use client";

/* eslint-disable @next/next/no-img-element */

import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  ImageIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { uploadAttachment } from "@/lib/attachments";
import { formatDateTime } from "@/lib/dates";
import { describeMaskCounts, maskPersonalData } from "@/lib/mask";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type ReplyCase = Tables<"reply_cases">;
type Flow = Pick<Tables<"service_flows">, "id" | "name">;

type AttachedPrint = {
  id: string;
  file: File;
  previewUrl: string;
  mimeType: string;
  base64Data: string;
};

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

async function fileToPrint(file: File): Promise<AttachedPrint> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const comma = res.indexOf(",");
      const base64Data = comma >= 0 ? res.slice(comma + 1) : res;
      resolve({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || "image/png",
        base64Data,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  const [prints, setPrints] = useState<AttachedPrint[]>([]);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      toast.error("Por favor, selecione apenas arquivos de imagem (prints).");
      return;
    }
    try {
      const newPrints = await Promise.all(list.map(fileToPrint));
      setPrints((prev) => [...prev, ...newPrints]);
      toast.success(list.length === 1 ? "Print adicionado!" : `${list.length} prints adicionados!`);
    } catch {
      toast.error("Não foi possível carregar a imagem.");
    }
  }

  // Permite colar print direto da área de transferência (Ctrl+V)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (prints.length === 0 && conversation.trim().length < 3) {
          return toast.error("Cole um print do WhatsApp ou digite o texto da conversa.");
        }

        setBusy(true);
        const newCaseId = crypto.randomUUID();
        const uploadedPaths: string[] = [];

        // Salvar prints no Supabase Storage
        for (const p of prints) {
          try {
            const uploadedUrl = await uploadAttachment(p.file, { type: "reply_cases", id: newCaseId });
            const storagePath = uploadedUrl.replace(/^\/api\/arquivos\//, "");
            uploadedPaths.push(storagePath);
          } catch (err) {
            console.error("Erro ao enviar print ao storage:", err);
          }
        }

        const result = await suggestReplies({
          caseId: newCaseId,
          label: label.trim() || null,
          conversation: conversation.trim(),
          flowId: flowId === AUTO ? null : flowId,
          images: prints.map((p) => ({ mimeType: p.mimeType, base64Data: p.base64Data })),
          screenshotPaths: uploadedPaths,
        });

        setBusy(false);
        if (!result.ok) return toast.error(result.error);
        toast.success("Respostas geradas com sucesso!");
        onCreated(result.data);
      }}
    >
      <div>
        <h2 className="font-semibold text-lg">Novo atendimento</h2>
        <p className="text-sm text-muted-foreground">
          Cole o print do WhatsApp ou selecione a imagem. A IA analisa o problema do cliente e sugere respostas prontas.
        </p>
      </div>

      {/* Área de Colar / Upload do Print */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : prints.length > 0
            ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60"
            : "border-muted-foreground/30 bg-muted/20 hover:border-foreground/40 hover:bg-muted/40",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImageIcon className="size-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              Cole o print aqui (<kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-mono font-bold shadow-xs">Ctrl+V</kbd>) ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Captura do WhatsApp, foto da tela ou foto do aparelho (PNG, JPG, WebP)
            </p>
          </div>
        </div>
      </div>

      {/* Miniaturas dos Prints Anexados */}
      {prints.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Prints anexados ({prints.length})
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="mr-1 size-3.5" />
              Adicionar outro print
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {prints.map((p, idx) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg border bg-muted/30 shadow-xs">
                <img
                  src={p.previewUrl}
                  alt={`Print ${idx + 1}`}
                  className="h-28 w-44 object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPrints((prev) => prev.filter((item) => item.id !== p.id));
                  }}
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/75 text-white transition hover:bg-destructive"
                  title="Remover print"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Apelido do caso (opcional)" htmlFor="rc-label">
          <Input
            id="rc-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Dell Inspiron tela azul (ou deixe vazio para gerar automático)"
            maxLength={120}
          />
        </Field>
        <Field label="Tipo de serviço">
          <FlowSelect flows={flows} value={flowId} onChange={setFlowId} />
        </Field>
      </div>

      <div className="space-y-1.5">
        <Field
          label={prints.length > 0 ? "Observação adicional ou detalhe (opcional)" : "Ou digite a conversa em texto"}
          htmlFor="rc-conversation"
        >
          <Textarea
            id="rc-conversation"
            rows={prints.length > 0 ? 3 : 7}
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            placeholder={
              prints.length > 0
                ? "Ex.: O cliente tem urgência para retirar hoje à tarde..."
                : "Cliente: Oi, meu notebook está muito lento…\nEu: …"
            }
            maxLength={8000}
          />
        </Field>
        {conversation.trim() && <MaskPreview text={conversation} />}
      </div>

      <Button
        type="submit"
        disabled={busy || !aiReady || (prints.length === 0 && conversation.trim().length < 3)}
        className="w-full sm:w-auto"
        size="lg"
      >
        <SparklesIcon />
        {busy ? "Analisando print e pensando nas respostas…" : "Analisar e sugerir respostas"}
      </Button>
    </form>
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado! É só colar no WhatsApp.");
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
    const result = await suggestReplies({
      caseId: item.id,
      label: item.label,
      conversation,
      flowId: item.service_flow_id,
      screenshotPaths: item.screenshot_paths ?? [],
    });
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

      {/* Exibição dos Prints da conversa */}
      {item.screenshot_paths && item.screenshot_paths.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {item.screenshot_paths.length === 1 ? "Print do atendimento" : "Prints do atendimento"}
          </h3>
          <div className="flex flex-wrap gap-3">
            {item.screenshot_paths.map((p, idx) => {
              const src = p.startsWith("/api/") ? p : `/api/arquivos/${p}`;
              return (
                <a
                  key={idx}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block overflow-hidden rounded-lg border bg-muted/20 hover:border-foreground/40 transition"
                  title="Clique para abrir imagem original em tela cheia"
                >
                  <img
                    src={src}
                    alt={`Print ${idx + 1}`}
                    className="max-h-56 max-w-full rounded-lg object-contain transition group-hover:scale-[1.02]"
                  />
                  <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                    <ExternalLinkIcon className="size-3" />
                    Abrir original
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {output && (
        <>
          <div className="rounded-lg bg-muted/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
              Dúvida / Problema identificado
            </span>
            <p className="text-sm font-medium">{output.summary}</p>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Opções de resposta para o WhatsApp</h3>
            {output.replies.map((r, i) => {
              const isChosen = item.chosen_reply === r.text;
              return (
                <div key={i} className={cn("rounded-lg border p-3 transition-colors", isChosen && "border-emerald-500/50 bg-emerald-500/5")}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {r.label}
                    </span>
                    <Button variant="outline" size="sm" className="ml-auto h-7 text-xs font-medium" onClick={() => copy(r.text)}>
                      <CopyIcon className="mr-1 size-3.5" />
                      Copiar
                    </Button>
                    <Button
                      variant={isChosen ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setChosen(r.text);
                        onUpdate({ chosen_reply: r.text });
                      }}
                    >
                      <CheckIcon className="mr-1 size-3.5" />
                      {isChosen ? "Escolhida" : "Marcar usada"}
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.text}</p>
                </div>
              );
            })}
          </section>

          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3">
            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Próximo passo recomendado</h3>
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
                <p className="text-sm text-muted-foreground">Tudo claro por enquanto.</p>
              )}
            </section>
          </div>
        </>
      )}

      <Field label="Resposta que você enviou ao cliente (pode ajustar)" htmlFor="rc-chosen">
        <Textarea
          id="rc-chosen"
          rows={3}
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          onBlur={() => chosen !== (item.chosen_reply ?? "") && onUpdate({ chosen_reply: chosen || null })}
          placeholder="Cole ou edite a mensagem que você realmente mandou no WhatsApp"
        />
      </Field>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Resultado do atendimento</h3>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resultado">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={item.outcome === o.value}
              onClick={() => onUpdate({ outcome: o.value })}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs font-medium transition",
                item.outcome === o.value ? "border-foreground/40 bg-accent" : "text-muted-foreground hover:text-foreground",
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
          placeholder="Anotação rápida: fechou por quanto, motivo de não fechar, etc."
          aria-label="Anotações do resultado"
        />
      </section>

      <Collapsible className="space-y-2 pt-2 border-t">
        <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Ver detalhes do texto / Gerar novas opções
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <Textarea rows={6} value={conversation} onChange={(e) => setConversation(e.target.value)} aria-label="Conversa" maxLength={8000} />
          {conversation.trim() && <MaskPreview text={conversation} />}
          <Button variant="outline" size="sm" onClick={regenerate} disabled={busy || !aiReady}>
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
