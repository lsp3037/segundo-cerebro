"use client";

import { useEffect, useState, useTransition } from "react";
import { DollarSignIcon, LaptopIcon, Loader2Icon, ShieldCheckIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { createNotebook, createTransaction, updateNotebook } from "@/lib/actions/finance";
import type { FinanceCategory, Notebook, PaymentMethod } from "@/lib/data/finance";
import { todayIso } from "@/lib/dates";
import { centsToInput, inputToCents } from "@/lib/money";
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
import { Textarea } from "@/components/ui/textarea";
import { NOTEBOOK_STATUS_CONFIG, type NotebookStatus } from "./meta";

interface NotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  notebookToEdit?: Notebook | null;
  onSuccess?: () => void;
}

export function NotebookDialog({
  open,
  onOpenChange,
  categories,
  paymentMethods,
  notebookToEdit,
  onSuccess,
}: NotebookDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [specs, setSpecs] = useState("");
  const [status, setStatus] = useState<NotebookStatus>("bought");
  const [askingPriceStr, setAskingPriceStr] = useState("");
  const [notes, setNotes] = useState("");

  // Campo de atalho para registrar a compra inicial ao criar novo aparelho
  const [initialCostStr, setInitialCostStr] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [paymentMethodId, setPaymentMethodId] = useState("");

  useEffect(() => {
    if (!open) return;

    if (notebookToEdit) {
      setBrand(notebookToEdit.brand ?? "");
      setModel(notebookToEdit.model);
      setSpecs(notebookToEdit.specs ?? "");
      setStatus((notebookToEdit.status as NotebookStatus) || "bought");
      setAskingPriceStr(notebookToEdit.asking_price_cents ? centsToInput(notebookToEdit.asking_price_cents) : "");
      setNotes(notebookToEdit.notes ?? "");
      setInitialCostStr("");
    } else {
      setBrand("");
      setModel("");
      setSpecs("");
      setStatus("bought");
      setAskingPriceStr("");
      setNotes("");
      setInitialCostStr("");
      setPurchaseDate(todayIso());
      setPaymentMethodId("");
    }
  }, [notebookToEdit, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!model.trim()) {
      toast.error("Informe o modelo do notebook.");
      return;
    }

    startTransition(async () => {
      const askingPriceCents = inputToCents(askingPriceStr);

      if (notebookToEdit) {
        const res = await updateNotebook(notebookToEdit.id, {
          brand: brand.trim() || null,
          model: model.trim(),
          specs: specs.trim() || null,
          status,
          asking_price_cents: askingPriceCents > 0 ? askingPriceCents : null,
          notes: notes.trim() || null,
        });

        if (res.ok) {
          toast.success("Notebook atualizado com sucesso.");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createNotebook({
          brand: brand.trim() || null,
          model: model.trim(),
          specs: specs.trim() || null,
          status,
          asking_price_cents: askingPriceCents > 0 ? askingPriceCents : null,
          notes: notes.trim() || null,
        });

        if (!res.ok) {
          toast.error(res.error);
          return;
        }

        const newNotebook = res.data;

        // Se informou custo de compra inicial, cria o lançamento automático
        const costCents = inputToCents(initialCostStr);
        if (costCents > 0 && newNotebook) {
          const purchaseCategory = categories.find(
            (c) => c.ledger === "trustcare" && c.kind === "expense" && c.name.toLowerCase().includes("estoque")
          );

          await createTransaction({
            ledger: "trustcare",
            kind: "expense",
            amount_cents: costCents,
            description: `Compra notebook: ${brand ? `${brand} ` : ""}${model}`,
            date: purchaseDate,
            category_id: purchaseCategory?.id ?? null,
            payment_method_id: paymentMethodId || null,
            notebook_id: newNotebook.id,
            notes: "Lançamento inicial de aquisição do aparelho para estoque.",
          });
        }

        toast.success("Notebook cadastrado com sucesso!");
        onOpenChange(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <LaptopIcon className="size-4" />
            <span>Ativo de Estoque • Trust Care</span>
          </div>
          <DialogTitle className="text-lg font-semibold">
            {notebookToEdit ? "Editar Notebook de Revenda" : "Cadastrar Notebook para Revenda"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {notebookToEdit
              ? "Atualize o status, preço pretendido de vitrine ou detalhes técnicos do aparelho."
              : "Cadastre um aparelho para acompanhar custos de bancada, upgrades e margem de lucro na venda."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="nb-brand" className="text-xs font-medium">
                Marca
              </Label>
              <Input
                id="nb-brand"
                placeholder="Ex: Dell, Lenovo, Acer, Apple"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="nb-model" className="text-xs font-medium">
                Modelo *
              </Label>
              <Input
                id="nb-model"
                placeholder="Ex: Inspiron 15 3520, ThinkPad T480"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 text-xs font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="nb-specs" className="text-xs font-medium">
              Especificações (Processador, RAM, Armazenamento)
            </Label>
            <Input
              id="nb-specs"
              placeholder="Ex: Intel Core i5 8ª ger, 16GB RAM DDR4, SSD 480GB NVMe"
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nb-status" className="text-xs font-medium">
                Status no Ciclo de Revenda
              </Label>
              <Select value={status} onValueChange={(val) => setStatus(val as NotebookStatus)}>
                <SelectTrigger id="nb-status" className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NOTEBOOK_STATUS_CONFIG) as NotebookStatus[]).map((st) => {
                    const conf = NOTEBOOK_STATUS_CONFIG[st];
                    return (
                      <SelectItem key={st} value={st} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${conf.dotClass}`} />
                          {conf.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="nb-asking" className="text-xs font-medium">
                Preço Pretendido / Vitrine (R$)
              </Label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  id="nb-asking"
                  type="text"
                  placeholder="0,00"
                  value={askingPriceStr}
                  onChange={(e) => setAskingPriceStr(e.target.value)}
                  className="pl-8 text-xs font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Dados do comprador se já estiver vendido */}
          {Boolean(notebookToEdit?.status === "sold" && (notebookToEdit.buyer_name || notebookToEdit.sold_at)) && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <UserIcon className="size-3.5" />
                <span>Dados do Fechamento de Venda</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1">
                <div>
                  Comprador: <span className="text-foreground font-medium">{notebookToEdit?.buyer_name || "—"}</span>
                </div>
                <div>
                  Contato: <span className="text-foreground font-mono">{notebookToEdit?.buyer_contact || "—"}</span>
                </div>
                <div>
                  Vendido em: <span className="text-foreground font-mono">{notebookToEdit?.sold_at || "—"}</span>
                </div>
                <div>
                  Garantia: <span className="text-foreground font-medium">{notebookToEdit?.warranty_days ?? 90} dias</span>
                </div>
              </div>
            </div>
          )}

          {/* Atalho de Aquisição na Criação */}
          {!notebookToEdit && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
              <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <DollarSignIcon className="size-3.5 text-amber-400" />
                <span>Custo Inicial de Aquisição (Opcional)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Informe quanto pagou pelo aparelho para lançar a compra automaticamente no fluxo de caixa da Trust Care.
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div>
                  <Label htmlFor="nb-cost" className="text-[11px] text-muted-foreground">
                    Valor Pago (R$)
                  </Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 font-mono text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="nb-cost"
                      type="text"
                      placeholder="0,00"
                      value={initialCostStr}
                      onChange={(e) => setInitialCostStr(e.target.value)}
                      className="pl-8 font-mono text-xs tabular-nums h-8"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="nb-pdate" className="text-[11px] text-muted-foreground">
                    Data da Compra
                  </Label>
                  <Input
                    id="nb-pdate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="mt-1 font-mono text-xs h-8"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Meio de Pagamento
                  </Label>
                  <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                    <SelectTrigger className="mt-1 text-xs h-8">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>
                          {pm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="nb-notes" className="text-xs font-medium text-muted-foreground">
              Anotações & Detalhes da Bancada
            </Label>
            <Textarea
              id="nb-notes"
              placeholder="Estado da carcaça, bateria, peças que ainda faltam, observações..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-xs resize-none h-16"
            />
          </div>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />}
              {notebookToEdit ? "Salvar Alterações" : "Cadastrar Aparelho"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
