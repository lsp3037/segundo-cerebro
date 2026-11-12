"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2Icon, DollarSignIcon, LaptopIcon, Loader2Icon, ShieldCheckIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { recordNotebookSale } from "@/lib/actions/finance";
import type { Notebook, PaymentMethod } from "@/lib/data/finance";
import { todayIso } from "@/lib/dates";
import { centsToInput, formatCentsToBrl, formatProfitMargin, inputToCents } from "@/lib/money";
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

interface SaleNotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebook: Notebook | null;
  paymentMethods: PaymentMethod[];
  onSuccess?: () => void;
}

const WARRANTY_PRESETS = [30, 60, 90, 180];

export function SaleNotebookDialog({
  open,
  onOpenChange,
  notebook,
  paymentMethods,
  onSuccess,
}: SaleNotebookDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [saleAmountStr, setSaleAmountStr] = useState("");
  const [machineFeeStr, setMachineFeeStr] = useState("");
  const [soldAt, setSoldAt] = useState(todayIso());
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerContact, setBuyerContact] = useState("");
  const [warrantyDays, setWarrantyDays] = useState(90);
  const [notes, setNotes] = useState("");

  // Inicializa os campos sempre que abrir para um notebook específico
  useEffect(() => {
    if (open && notebook) {
      setSaleAmountStr(notebook.asking_price_cents ? centsToInput(notebook.asking_price_cents) : "");
      setMachineFeeStr("");
      setSoldAt(todayIso());
      setPaymentMethodId("");
      setBuyerName(notebook.buyer_name ?? "");
      setBuyerContact(notebook.buyer_contact ?? "");
      setWarrantyDays(notebook.warranty_days ?? 90);
      setNotes("");
    }
  }, [open, notebook]);

  // Cálculos em tempo real de margem e lucro líquido da venda
  const economics = useMemo(() => {
    const grossSaleCents = inputToCents(saleAmountStr);
    const feeCents = inputToCents(machineFeeStr);
    const netIncomeCents = Math.max(0, grossSaleCents - feeCents);
    const totalExpensesCents = (notebook?.expense_cents ?? 0) + feeCents;
    const netProfitCents = grossSaleCents - totalExpensesCents;
    const marginStr = formatProfitMargin(netProfitCents, grossSaleCents);

    return {
      grossSaleCents,
      feeCents,
      netIncomeCents,
      totalExpensesCents,
      netProfitCents,
      marginStr,
    };
  }, [saleAmountStr, machineFeeStr, notebook]);

  if (!notebook) return null;

  const nbTitle = notebook.brand ? `${notebook.brand} ${notebook.model}` : notebook.model;
  const currentExpenses = notebook.expense_cents ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const saleAmountCents = inputToCents(saleAmountStr);
    if (saleAmountCents <= 0) {
      toast.error("Informe o valor da venda.");
      return;
    }

    startTransition(async () => {
      const res = await recordNotebookSale({
        notebook_id: notebook.id,
        sold_at: soldAt,
        sale_amount_cents: saleAmountCents,
        machine_fee_cents: inputToCents(machineFeeStr),
        payment_method_id: paymentMethodId || null,
        buyer_name: buyerName.trim() || null,
        buyer_contact: buyerContact.trim() || null,
        warranty_days: Number(warrantyDays) || 90,
        notes: notes.trim() || null,
      });

      if (res.ok) {
        toast.success(`Venda de ${nbTitle} registrada com sucesso!`);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <LaptopIcon className="size-4" />
            <span>Fechamento de Venda</span>
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {nbTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Baixa do aparelho do estoque, lançamento de receita e registro de comprador e garantia.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo de Custo Investido */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Custo Total Acumulado (Compra + Peças):</span>
            <span className="font-mono font-semibold text-rose-400">
              {formatCentsToBrl(currentExpenses)}
            </span>
          </div>
          {Boolean(notebook.asking_price_cents && notebook.asking_price_cents > 0) && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Preço Anunciado na Vitrine:</span>
              <span className="font-mono font-semibold text-cyan-400">
                {formatCentsToBrl(notebook.asking_price_cents!)}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Valor da Venda e Taxa de Maquininha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="saleAmount" className="text-xs font-medium">
                Valor Bruto de Venda (R$) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  R$
                </span>
                <Input
                  id="saleAmount"
                  type="text"
                  placeholder="0,00"
                  value={saleAmountStr}
                  onChange={(e) => setSaleAmountStr(e.target.value)}
                  className="pl-9 font-mono text-sm"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="machineFee" className="text-xs font-medium text-muted-foreground">
                Taxa Maquininha (R$) <span className="text-xs">(opcional)</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  R$
                </span>
                <Input
                  id="machineFee"
                  type="text"
                  placeholder="0,00"
                  value={machineFeeStr}
                  onChange={(e) => setMachineFeeStr(e.target.value)}
                  className="pl-9 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Card de Economia Unitária da Venda em Tempo Real */}
          {economics.grossSaleCents > 0 && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Receita Líquida (após taxas):</span>
                <span className="font-mono font-medium text-foreground">
                  {formatCentsToBrl(economics.netIncomeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-cyan-500/20 pt-1 mt-1">
                <span className="font-semibold text-foreground">Lucro Líquido Real:</span>
                <div className="flex items-center gap-1.5 font-mono text-sm font-bold">
                  <span className={economics.netProfitCents >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatCentsToBrl(economics.netProfitCents)}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({economics.marginStr})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Data e Forma de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="soldAt" className="text-xs font-medium">
                Data da Venda
              </Label>
              <Input
                id="soldAt"
                type="date"
                value={soldAt}
                onChange={(e) => setSoldAt(e.target.value)}
                className="text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forma de Pagamento</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o meio..." />
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

          {/* Dados do Comprador */}
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <UserIcon className="size-3.5 text-cyan-400" />
              <span>Dados do Comprador</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="buyerName" className="text-xs text-muted-foreground">
                  Nome do Cliente
                </Label>
                <Input
                  id="buyerName"
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="buyerContact" className="text-xs text-muted-foreground">
                  WhatsApp / Telefone
                </Label>
                <Input
                  id="buyerContact"
                  type="text"
                  placeholder="(65) 99999-9999"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Prazo de Garantia de Balcão */}
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShieldCheckIcon className="size-3.5 text-emerald-400" />
                <span>Garantia de Balcão (dias)</span>
              </div>
              <div className="flex items-center gap-1">
                {WARRANTY_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWarrantyDays(d)}
                    className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                      warrantyDays === d
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <Input
              type="number"
              min={0}
              max={1825}
              value={warrantyDays}
              onChange={(e) => setWarrantyDays(parseInt(e.target.value, 10) || 0)}
              className="text-xs font-mono"
            />
          </div>

          {/* Observações da Venda */}
          <div className="space-y-1.5">
            <Label htmlFor="saleNotes" className="text-xs font-medium text-muted-foreground">
              Observações da Venda
            </Label>
            <Textarea
              id="saleNotes"
              rows={2}
              placeholder="Detalhes adicionais, itens inclusos na venda (carregador original, mouse, etc)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
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
              type="submit"
              size="sm"
              disabled={isPending}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Gravando Venda...
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-3.5" />
                  Confirmar Venda e Baixar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
