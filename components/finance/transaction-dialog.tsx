"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { createTransaction, updateTransaction } from "@/lib/actions/finance";
import type { FinanceCategory, Notebook, PaymentMethod } from "@/lib/data/finance";
import type { AccountWithBalance } from "@/lib/data/finance-family";
import { todayIso } from "@/lib/dates";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import { centsToInput, inputToCents } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";
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
  accounts?: AccountWithBalance[];
  defaultLedger?: "pessoal" | "trustcare";
  defaultNotebookId?: string | null;
  defaultDescription?: string | null;
  defaultKind?: "income" | "expense";
  transactionToEdit?: Tables<"transactions"> | null;
  onSuccess?: () => void;
}

export function TransactionDialog(props: TransactionDialogProps) {
  const formKey = `${props.open}-${props.transactionToEdit?.id ?? "new"}-${props.defaultLedger ?? "pessoal"}-${props.defaultNotebookId ?? ""}`;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl">
        <TransactionDialogForm key={formKey} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function TransactionDialogForm({
  onOpenChange,
  categories,
  paymentMethods,
  notebooks,
  accounts = [],
  defaultLedger = "pessoal",
  defaultNotebookId,
  defaultDescription,
  defaultKind,
  transactionToEdit,
  onSuccess,
}: TransactionDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<"income" | "expense">(
    () => (transactionToEdit?.kind as "income" | "expense") ?? defaultKind ?? "expense",
  );
  const [ledger, setLedger] = useState<"pessoal" | "trustcare">(
    () => (transactionToEdit?.ledger as "pessoal" | "trustcare") ?? (defaultNotebookId ? "trustcare" : defaultLedger),
  );
  const [status, setStatus] = useState<"paid" | "pending">(
    () => (transactionToEdit?.status as "paid" | "pending") ?? "paid",
  );
  const [amountStr, setAmountStr] = useState(() =>
    transactionToEdit ? centsToInput(transactionToEdit.amount_cents) : "",
  );
  const [description, setDescription] = useState(
    () => transactionToEdit?.description ?? defaultDescription ?? "",
  );
  const [date, setDate] = useState(() => transactionToEdit?.date ?? todayIso());
  const [dueDate, setDueDate] = useState(() => transactionToEdit?.due_date ?? "");
  const [categoryId, setCategoryId] = useState<string>(() => transactionToEdit?.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string>(() => transactionToEdit?.payment_method_id ?? "");
  const [accountId, setAccountId] = useState<string>(() => transactionToEdit?.account_id ?? "__none__");
  const [memberLabel, setMemberLabel] = useState<string>(() => transactionToEdit?.member_label ?? "Casa");
  const [installments, setInstallments] = useState<string>("1");
  const [notebookId, setNotebookId] = useState<string>(() => transactionToEdit?.notebook_id ?? defaultNotebookId ?? "");
  const [notes, setNotes] = useState(() => transactionToEdit?.notes ?? "");

  // Filtra categorias pelo ledger e kind selecionados (garantindo unicidade)
  const filteredCategories = useMemo(() => {
    const list = categories.filter((c) => c.ledger === ledger && c.kind === kind);
    const seen = new Set<string>();
    const unique: FinanceCategory[] = [];
    for (const c of list) {
      const key = c.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }
    return unique;
  }, [categories, ledger, kind]);

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
      const resolvedAccountId = accountId && accountId !== "__none__" ? accountId : null;
      const resolvedMember = ledger === "pessoal" && memberLabel ? memberLabel : null;
      const resolvedDue = dueDate.trim() ? dueDate : null;
      const instCount = Number(installments);

      if (transactionToEdit) {
        const res = await updateTransaction(transactionToEdit.id, {
          kind,
          ledger,
          status,
          amount_cents: amountCents,
          description: description.trim(),
          date,
          due_date: resolvedDue,
          category_id: categoryId ? categoryId : null,
          payment_method_id: paymentMethodId ? paymentMethodId : null,
          account_id: resolvedAccountId,
          member_label: resolvedMember,
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
          status,
          amount_cents: amountCents,
          description: description.trim(),
          date,
          due_date: resolvedDue,
          category_id: categoryId ? categoryId : null,
          payment_method_id: paymentMethodId ? paymentMethodId : null,
          account_id: resolvedAccountId,
          member_label: resolvedMember,
          installment_total: instCount >= 2 ? instCount : undefined,
          notebook_id: ledger === "trustcare" && notebookId ? notebookId : null,
          notes: notes.trim() || null,
        });

        if (res.ok) {
          toast.success(instCount >= 2 ? `Parcelamento em ${instCount}x registrado!` : "Lançamento registrado!");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  return (
    <>
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
                  ? "Ex: Salário mensal, Rendimento de aluguel, Manutenção"
                  : "Ex: Supermercado do mês, Aluguel/Condomínio, Combustível"
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
                Pessoal / Familiar
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

          {/* Status (Pago vs Pendente) + Vencimento */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium">Status</Label>
              <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-lg bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setStatus("paid")}
                  className={`rounded-md py-1 text-xs font-medium transition-colors ${
                    status === "paid" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Pago
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("pending")}
                  className={`rounded-md py-1 text-xs font-medium transition-colors ${
                    status === "pending" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Pendente
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="tx-due-date" className="text-xs font-medium">
                Vencimento (opcional)
              </Label>
              <Input
                id="tx-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          {/* Pessoa + Conta / Cartão + Parcelamento (quando Pessoal) */}
          {ledger === "pessoal" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs font-medium">Pessoa / Centro</Label>
                <Select value={memberLabel} onValueChange={setMemberLabel}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSEHOLD_MEMBERS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Conta / Cartão</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">Nenhum</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!transactionToEdit && (
                <div>
                  <Label className="text-xs font-medium">Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">À vista (1x)</SelectItem>
                      {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n}x mensais
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
    </>
  );
}
