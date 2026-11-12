"use client";

import { useId, useMemo, useState, useTransition } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  FileUpIcon,
  FilterIcon,
  GitMergeIcon,
  Loader2Icon,
  PlusCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  TagIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  analyzeOfxContent,
  importOfxBatchAction,
  type AnalyzedOfxItem,
  type OfxAnalysisReport,
} from "@/lib/actions/ofx-import";
import type { FinanceCategory, PaymentMethod } from "@/lib/data/finance";
import { formatCentsToBrl } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface OfxImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  defaultLedger?: "pessoal" | "trustcare";
  onSuccess?: () => void;
}

interface EditableItemState {
  included: boolean;
  action: "create" | "link_existing" | "ignore";
  description: string;
  categoryId: string;
  rememberRule: boolean;
  rulePattern: string;
}

export function OfxImportDialog({
  open,
  onOpenChange,
  categories,
  paymentMethods,
  defaultLedger = "pessoal",
  onSuccess,
}: OfxImportDialogProps) {
  const fileInputId = useId();
  const [isPending, startTransition] = useTransition();

  // Etapa 1: Upload / Seleção de parâmetros
  const [targetLedger, setTargetLedger] = useState<"pessoal" | "trustcare">(defaultLedger);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Etapa 2: Relatório analisado
  const [report, setReport] = useState<OfxAnalysisReport | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, EditableItemState>>({});
  const [filterTab, setFilterTab] = useState<"all" | "new" | "matched" | "imported">("all");

  // Filtra categorias do ledger alvo
  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.ledger === targetLedger);
  }, [categories, targetLedger]);

  const handleReset = () => {
    setSelectedFile(null);
    setReport(null);
    setItemStates({});
    setFilterTab("all");
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Selecione um arquivo de extrato bancário no formato .ofx");
      return;
    }
    setSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo .ofx para analisar.");
      return;
    }

    startTransition(async () => {
      try {
        const text = await selectedFile.text();
        const res = await analyzeOfxContent({
          content: text,
          targetLedger,
        });

        if (!res.ok) {
          toast.error(res.error);
          return;
        }

        setReport(res.data);

        // Inicializa estado interativo para cada item
        const initialStates: Record<string, EditableItemState> = {};
        for (const item of res.data.items) {
          const isImported = item.status === "already_imported";
          const isMatched = item.status === "matched_existing";

          initialStates[item.fitid] = {
            included: !isImported,
            action: isImported ? "ignore" : isMatched ? "link_existing" : "create",
            description: item.clean_description,
            categoryId: item.suggestedCategoryId ?? "",
            rememberRule: false,
            rulePattern: item.rulePatternSuggestion,
          };
        }
        setItemStates(initialStates);
        toast.success(`Extrato lido: ${res.data.items.length} movimentações encontradas.`);
      } catch (err) {
        console.error("analyze error:", err);
        toast.error("Falha ao ler o conteúdo do arquivo OFX.");
      }
    });
  };

  // Itens filtrados para exibição na tabela
  const visibleItems = useMemo(() => {
    if (!report) return [];
    return report.items.filter((item) => {
      if (filterTab === "new") return item.status === "new";
      if (filterTab === "matched") return item.status === "matched_existing";
      if (filterTab === "imported") return item.status === "already_imported";
      return true;
    });
  }, [report, filterTab]);

  // Contagem de itens selecionados para importar
  const selectedCount = useMemo(() => {
    return Object.values(itemStates).filter((s) => s.included && s.action !== "ignore").length;
  }, [itemStates]);

  const handleToggleSelectAll = (select: boolean) => {
    setItemStates((prev) => {
      const next = { ...prev };
      for (const item of visibleItems) {
        if (item.status !== "already_imported") {
          next[item.fitid] = { ...next[item.fitid], included: select };
        }
      }
      return next;
    });
  };

  const handleConfirmImport = () => {
    if (!report) return;

    const itemsToImport = report.items
      .filter((item) => {
        const st = itemStates[item.fitid];
        return st && st.included && st.action !== "ignore";
      })
      .map((item) => {
        const st = itemStates[item.fitid];
        return {
          fitid: item.fitid,
          date: item.date,
          amount_cents: item.amount_cents,
          kind: item.kind,
          description: st.description.trim() || item.clean_description,
          category_id: st.categoryId || null,
          payment_method_id: paymentMethodId || null,
          ledger: targetLedger,
          action: st.action,
          matched_transaction_id: item.matchedTransaction?.id ?? null,
          remember_rule: st.rememberRule,
          rule_pattern: st.rulePattern.trim() || undefined,
        };
      });

    if (itemsToImport.length === 0) {
      toast.error("Nenhuma transação selecionada para importação.");
      return;
    }

    startTransition(async () => {
      const res = await importOfxBatchAction({
        ledger: targetLedger,
        payment_method_id: paymentMethodId || null,
        items: itemsToImport,
      });

      if (res.ok) {
        const msg = [
          res.data.created > 0 ? `${res.data.created} criadas` : null,
          res.data.linked > 0 ? `${res.data.linked} mescladas` : null,
          res.data.rulesSaved > 0 ? `${res.data.rulesSaved} regras memorizadas` : null,
        ]
          .filter(Boolean)
          .join(", ");

        toast.success(`Extrato importado com sucesso! (${msg || "Processado"})`);
        onOpenChange(false);
        handleReset();
        onSuccess?.();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl max-h-[92vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <FileSpreadsheetIcon className="size-4" />
            <span>Importador Inteligente de Extrato (.OFX)</span>
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {report ? "Revisão e Conciliação do Extrato" : "Importar Extrato Bancário"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {report
              ? "Confira os lançamentos, aprove as categorias sugeridas e decida se deseja mesclar correspondências existentes."
              : "Suba o arquivo .ofx gerado pelo seu banco (Nubank, Itaú, Sicredi, Inter, BB, etc.) para conciliação 100% local."}
          </DialogDescription>
        </DialogHeader>

        {/* ETAPA 1: Upload e Configurações Iniciais */}
        {!report ? (
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">De quem é o extrato?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetLedger("pessoal")}
                    className={`rounded-lg border p-2.5 text-xs font-medium text-left transition-all ${
                      targetLedger === "pessoal"
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-semibold text-foreground">Pessoal & Familiar</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Bancos e cartões pessoais</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetLedger("trustcare")}
                    className={`rounded-lg border p-2.5 text-xs font-medium text-left transition-all ${
                      targetLedger === "trustcare"
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-semibold text-foreground">Trust Care</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Banco PJ da assistência</div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Meio de Pagamento Padrão (Opcional)</Label>
                <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                  <SelectTrigger className="text-xs h-10">
                    <SelectValue placeholder="Selecione o banco ou cartão..." />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Atribui esta forma de pagamento a todos os lançamentos deste extrato.
                </p>
              </div>
            </div>

            {/* Dropzone de Arquivo */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                handleFileChange(file || null);
              }}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? "border-emerald-500 bg-emerald-500/5"
                  : selectedFile
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : "border-border/80 bg-muted/10 hover:border-border hover:bg-muted/20"
              }`}
            >
              <input
                id={fileInputId}
                type="file"
                accept=".ofx"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <FileSpreadsheetIcon className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Arquivo OFX Pronto
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="h-7 text-xs text-muted-foreground hover:text-rose-400 gap-1"
                  >
                    <XIcon className="size-3.5" />
                    Trocar Arquivo
                  </Button>
                </div>
              ) : (
                <label htmlFor={fileInputId} className="flex flex-col items-center cursor-pointer space-y-2">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
                    <UploadCloudIcon className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Arraste seu arquivo .ofx ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Compatível com Nubank, Itaú, Sicredi, Banco do Brasil, Inter, Caixa, Bradesco...
                    </p>
                  </div>
                </label>
              )}
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
              <SparklesIcon className="size-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Privacidade e Sigilo Absoluto:</span> Todo o processamento
                deste extrato ocorre 100% no seu servidor local. Nenhum número de conta ou dado bancário é transmitido
                para modelos de IA externos.
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAnalyze}
                disabled={!selectedFile || isPending}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" />
                    Analisando Extrato...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="size-3.5" />
                    Analisar Transações
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ETAPA 2: Lista Interativa de Transações com Edição Inline */
          <div className="flex flex-col flex-1 min-h-0 space-y-3 pt-2">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
              <div className="rounded-xl border border-border/70 bg-card/60 p-2.5">
                <span className="text-xs text-muted-foreground">Total Encontrado</span>
                <div className="font-mono text-lg font-bold text-foreground">
                  {report.summary.total}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                <span className="text-xs text-emerald-300">Novos Lançamentos</span>
                <div className="font-mono text-lg font-bold text-emerald-400">
                  {report.summary.newCount}
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-2.5">
                <span className="text-xs text-blue-300">Possíveis Mesclagens</span>
                <div className="font-mono text-lg font-bold text-blue-400">
                  {report.summary.matchedCount}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                <span className="text-xs text-muted-foreground">Já Importados</span>
                <div className="font-mono text-lg font-bold text-muted-foreground">
                  {report.summary.alreadyImportedCount}
                </div>
              </div>
            </div>

            {/* Filtros e Ações em Lote */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterTab === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  Todas ({report.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("new")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterTab === "new"
                      ? "bg-emerald-600 text-white"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  Novas ({report.summary.newCount})
                </button>
                {report.summary.matchedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab("matched")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filterTab === "matched"
                        ? "bg-blue-600 text-white"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    Correspondências ({report.summary.matchedCount})
                  </button>
                )}
                {report.summary.alreadyImportedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab("imported")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filterTab === "imported"
                        ? "bg-muted text-foreground"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    Já Importadas ({report.summary.alreadyImportedCount})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Marcar Visíveis
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Lista com Rolagem das Transações */}
            <div className="flex-1 min-h-[300px] max-h-[460px] overflow-y-auto rounded-xl border border-border/80 bg-background/50 divide-y divide-border/60">
              {visibleItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhuma transação nesta visualização.
                </div>
              ) : (
                visibleItems.map((item) => {
                  const state = itemStates[item.fitid] ?? {
                    included: item.status !== "already_imported",
                    action: item.status === "matched_existing" ? "link_existing" : "create",
                    description: item.clean_description,
                    categoryId: item.suggestedCategoryId ?? "",
                    rememberRule: false,
                    rulePattern: item.rulePatternSuggestion,
                  };

                  const isImported = item.status === "already_imported";
                  const isMatched = item.status === "matched_existing";

                  return (
                    <div
                      key={item.fitid}
                      className={`p-3 text-xs transition-colors ${
                        !state.included || isImported
                          ? "opacity-50 bg-muted/10"
                          : isMatched
                            ? "bg-blue-950/10 hover:bg-blue-950/20"
                            : "hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox de Inclusão */}
                        <input
                          type="checkbox"
                          checked={state.included}
                          disabled={isImported}
                          onChange={(e) => {
                            setItemStates((prev) => ({
                              ...prev,
                              [item.fitid]: { ...state, included: e.target.checked },
                            }));
                          }}
                          className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                        />

                        {/* Conteúdo Principal da Linha */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {item.date.split("-").reverse().join("/")}
                              </span>

                              {isImported && (
                                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                                  Já Importada (Ignorada)
                                </Badge>
                              )}

                              {isMatched && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs py-0 px-1.5 flex items-center gap-1">
                                  <GitMergeIcon className="size-3" />
                                  Possível Correspondência
                                </Badge>
                              )}
                            </div>

                            {/* Valor Formatado */}
                            <div className="font-mono text-sm font-bold tabular-nums">
                              <span className={item.kind === "income" ? "text-emerald-400" : "text-rose-400"}>
                                {item.kind === "income" ? "+" : "-"} {formatCentsToBrl(item.amount_cents)}
                              </span>
                            </div>
                          </div>

                          {/* Edição de Descrição e Categoria */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              type="text"
                              value={state.description}
                              disabled={!state.included || isImported}
                              onChange={(e) => {
                                setItemStates((prev) => ({
                                  ...prev,
                                  [item.fitid]: { ...state, description: e.target.value },
                                }));
                              }}
                              className="text-xs h-8"
                              placeholder="Descrição..."
                            />

                            <Select
                              value={state.categoryId}
                              disabled={!state.included || isImported}
                              onValueChange={(val) => {
                                setItemStates((prev) => ({
                                  ...prev,
                                  [item.fitid]: { ...state, categoryId: val },
                                }));
                              }}
                            >
                              <SelectTrigger className="text-xs h-8">
                                <SelectValue placeholder="Selecione categoria..." />
                              </SelectTrigger>
                              <SelectContent className="text-xs max-h-56">
                                {availableCategories
                                  .filter((c) => c.kind === item.kind)
                                  .map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="size-2 rounded-full"
                                          style={{ backgroundColor: c.color || "#6b7280" }}
                                        />
                                        {c.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Se for correspondência, oferece opção de Mesclar */}
                          {isMatched && item.matchedTransaction && (
                            <div className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-2 text-xs text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div>
                                <span className="font-semibold text-white">Lançamento prévio no sistema:</span> "
                                {item.matchedTransaction.description}" em {item.matchedTransaction.date} (
                                {formatCentsToBrl(item.matchedTransaction.amount_cents)})
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={state.action === "link_existing" ? "default" : "outline"}
                                  onClick={() => {
                                    setItemStates((prev) => ({
                                      ...prev,
                                      [item.fitid]: { ...state, action: "link_existing" },
                                    }));
                                  }}
                                  className="h-6 text-xs px-2"
                                >
                                  Mesclar (1 clique)
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={state.action === "create" ? "secondary" : "ghost"}
                                  onClick={() => {
                                    setItemStates((prev) => ({
                                      ...prev,
                                      [item.fitid]: { ...state, action: "create" },
                                    }));
                                  }}
                                  className="h-6 text-xs px-2 text-muted-foreground"
                                >
                                  Criar Novo
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Memorização de Regra Automática */}
                          {state.included && !isImported && (
                            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={state.rememberRule}
                                  onChange={(e) => {
                                    setItemStates((prev) => ({
                                      ...prev,
                                      [item.fitid]: { ...state, rememberRule: e.target.checked },
                                    }));
                                  }}
                                  className="size-3.5 rounded border-border accent-primary cursor-pointer"
                                />
                                <span>Memorizar regra para</span>
                              </label>

                              {state.rememberRule && (
                                <Input
                                  type="text"
                                  value={state.rulePattern}
                                  onChange={(e) => {
                                    setItemStates((prev) => ({
                                      ...prev,
                                      [item.fitid]: { ...state, rulePattern: e.target.value },
                                    }));
                                  }}
                                  placeholder="Palavra-chave..."
                                  className="h-6 text-xs w-48 font-mono"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé com Confirmação em Lote */}
            <DialogFooter className="pt-2 border-t border-border/60 flex items-center justify-between sm:justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RefreshCwIcon className="size-3" />
                Trocar Arquivo
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={selectedCount === 0 || isPending}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isPending ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin" />
                      Gravando Transações...
                    </>
                  ) : (
                    <>
                      <CheckCircle2Icon className="size-3.5" />
                      Importar {selectedCount} {selectedCount === 1 ? "Transação" : "Transações"}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
