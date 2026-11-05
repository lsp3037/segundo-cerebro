"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { createTransaction, updateTransaction } from "@/lib/actions/finance";
import type { FinanceCategory, Notebook, PaymentMethod, Transaction } from "@/lib/data/finance";
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

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  notebooks: Notebook[];
  defaultLedger?: "pessoal" | "trustcare";
  transactionToEdit?: Transaction | null;
  onSuccess?: () => void;
}

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  paymentMethods,
  notebooks,
  defaultLedger = "pessoal",
  transactionToEdit,
  onSuccess,
}: TransactionDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [ledger, setLedger] = useState<"pessoal" | "trustcare">(defaultLedger);
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [notebookId, setNotebookId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Sincroniza com transactionToEdit ou reseta
  useEffect(() => {
    if (transactionToEdit) {
      setKind(transactionToEdit.kind as "income" | "expense");
      setLedger(transactionToEdit.ledger as "pessoal" | "trustcare");
      setAmountStr(centsToInput(transactionToEdit.amount_cents));
      setDescription(transactionToEdit.description);
      setDate(transactionToEdit.date);
      setCategoryId(transactionToEdit.category_id ?? "");
      setPaymentMethodId(transactionToEdit.payment_method_id ?? "");
      setNotebookId(transactionToEdit.notebook_id ?? "");
      setNotes(transactionToEdit.notes ?? "");
    } else {
      setKind("expense");
      setLedger(defaultLedger);
      setAmountStr("");
      setDescription("");
      setDate(todayIso());
      setCategoryId("");
      setPaymentMethodId("");
      setNotebookId("");
      setNotes("");
    }
  }, [transactionToEdit, defaultLedger, open]);

  // Filtra categorias pelo ledger e kind selecionados
  const filteredCategories = categories.filter((c) => c.ledger === ledger && c.kind === kind);

  // Notebooks elegíveis (todos ativos no estoque ou recentemente vendidos)
  const availableNotebooks = notebooks.filter((n) => !n.deleted_at);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = inputToCents(amountStr);

    if (amountCents <= 0) {
      toast.error("Informe um valor maior que R$ 0,00.");
      return;
    }

    if (!description.trim()) {
      toast.error("Informe a descrição do lançamento.");
      return;
    }

    startTransition(async () => {
      if (transactionToEdit) {
        const res = await updateTransaction(transactionToEdit.id, {
          kind,
          ledger,
          amount_cents: amountCents,
          description: description.trim(),
          date,
          category_id: categoryId ? categoryId : null,
          payment_method_id: paymentMethodId ? paymentMethodId : null,
          notebook_id: ledger === "trustcare" && notebookId ? notebookId : null,
          notes: notes.trim() || null,
        });

        if (res.ok) {
          toast.success("Lançamento atualizado.");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createTransaction({
          kind,
          ledger,
          amount_cents: amountCents,
          description: description.trim(),
          date,
          category_id: categoryId ? categoryId : null,
          payment_method_id: paymentMethodId ? paymentMethodId : null,
          notebook_id: ledger === "trustcare" && notebookId ? notebookId : null,
          notes: notes.trim() || null,
        });

        if (res.ok) {
          toast.success("Lançamento registrado!");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {transactionToEdit ? "Editar Lançamento" : "Novo Lançamento"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {transactionToEdit
              ? "Atualize as informações do lançamento financeiro."
              : "Registre uma entrada ou saída no seu fluxo de caixa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Seletor Tipo: Entrada ou Saída */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setKind("income")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                kind === "income"
                  ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUpRightIcon className="size-3.5" />
              Entrada / Receita
            </button>
            <button
              type="button"
              onClick={() => setKind("expense")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                kind === "expense"
                  ? "border border-rose-500/40 bg-rose-500/15 text-rose-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDownRightIcon className="size-3.5" />
              Saída / Despesa
            </button>
          </div>

          {/* Valor (R$) e Data */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tx-amount" className="text-xs font-medium">
                Valor (R$) *
              </Label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="tx-amount"
                  type="text"
                  placeholder="0,00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="pl-10 font-mono text-base font-semibold tabular-nums"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tx-date" className="text-xs font-medium">
                Data do Pagamento *
              </Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 font-mono text-xs"
                required
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="tx-description" className="text-xs font-medium">
              Descrição *
            </Label>
            <Input
              id="tx-description"
              placeholder={
                kind === "income"
                  ? "Ex: Manutenção Dell Inspiron, Salário SES-MT"
                  : "Ex: Compra de SSD 480GB, Mercado da semana"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 text-sm"
              required
            />
          </div>

          {/* Ledger (Pessoal vs Trust Care) */}
          <div>
            <Label className="text-xs font-medium">Conta / Destino</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLedger("pessoal")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  ledger === "pessoal"
                    ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Pessoal (Luan)
              </button>
              <button
                type="button"
                onClick={() => setLedger("trustcare")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  ledger === "trustcare"
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Trust Care
              </button>
            </div>
          </div>

          {/* Categoria e Método de Pagamento */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tx-category" className="text-xs font-medium">
                Categoria
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="tx-category" className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: c.color || "#94a3b8" }}
                        />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tx-method" className="text-xs font-medium">
                Forma de Pagamento
              </Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger id="tx-method" className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vínculo com Notebook (Se Trust Care) */}
          {ledger === "trustcare" && availableNotebooks.length > 0 && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
              <Label htmlFor="tx-notebook" className="text-xs font-medium text-cyan-300">
                Vincular a Notebook (Revenda Trust Care)
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Se for compra de peça, upgrade ou venda deste aparelho, vincule para apurar o lucro exato.
              </p>
              <Select value={notebookId} onValueChange={setNotebookId}>
                <SelectTrigger id="tx-notebook" className="mt-1.5 text-xs bg-background/50">
                  <SelectValue placeholder="Nenhum (custo geral)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">
                    Nenhum (Custo / Receita Geral)
                  </SelectItem>
                  {availableNotebooks.map((n) => (
                    <SelectItem key={n.id} value={n.id} className="text-xs">
                      {n.brand ? `${n.brand} ` : ""}
                      {n.model} {n.specs ? `(${n.specs})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label htmlFor="tx-notes" className="text-xs font-medium text-muted-foreground">
              Observações (opcional)
            </Label>
            <Textarea
              id="tx-notes"
              placeholder="Anotações internas, número de recibo, detalhes..."
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
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className={kind === "income" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {isPending && <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />}
              {transactionToEdit ? "Salvar Alterações" : "Salvar Lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
