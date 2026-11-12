"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
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

const LAST_CHOICES_KEY = "segundo-cerebro:finance-last-choices";

interface LastChoices {
  memberLabel?: string;
  accountId?: string;
  paymentMethodId?: string;
}

function readLastChoices(): LastChoices | null {
  try {
    const raw = window.localStorage.getItem(LAST_CHOICES_KEY);
    return raw ? (JSON.parse(raw) as LastChoices) : null;
  } catch {
    return null;
  }
}

function saveLastChoices(choices: LastChoices) {
  try {
    window.localStorage.setItem(LAST_CHOICES_KEY, JSON.stringify(choices));
  } catch {
    // Sem armazenamento local (aba anônima, por exemplo): só não lembra a escolha.
  }
}

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl">
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
  // Num lançamento novo, pessoa, banco e forma de pagamento repetem a última escolha.
  const [lastChoices] = useState<LastChoices | null>(() => {
    if (transactionToEdit) return null;
    const saved = readLastChoices();
    if (!saved) return null;
    // Ignora escolhas que não existem mais (conta ou forma de pagamento removida).
    return {
      memberLabel: saved.memberLabel && (HOUSEHOLD_MEMBERS as readonly string[]).includes(saved.memberLabel) ? saved.memberLabel : undefined,
      accountId: saved.accountId && accounts.some((a) => a.id === saved.accountId) ? saved.accountId : undefined,
      paymentMethodId:
        saved.paymentMethodId && paymentMethods.some((m) => m.id === saved.paymentMethodId)
          ? saved.paymentMethodId
          : undefined,
    };
  });
  const [paymentMethodId, setPaymentMethodId] = useState<string>(
    () => transactionToEdit?.payment_method_id ?? lastChoices?.paymentMethodId ?? "",
  );
  const [accountId, setAccountId] = useState<string>(
    () => transactionToEdit?.account_id ?? lastChoices?.accountId ?? "__none__",
  );
  const [memberLabel, setMemberLabel] = useState<string>(
    () => transactionToEdit?.member_label ?? lastChoices?.memberLabel ?? "Casa",
  );
  const [installments, setInstallments] = useState<string>("1");
  const [notebookId, setNotebookId] = useState<string>(() => transactionToEdit?.notebook_id ?? defaultNotebookId ?? "");
  const [notes, setNotes] = useState(() => transactionToEdit?.notes ?? "");
  // Detalhes começam fechados; abrem sozinhos quando o lançamento já usa algum deles.
  const [showDetails, setShowDetails] = useState(
    () =>
      Boolean(defaultNotebookId) ||
      Boolean(transactionToEdit?.notes || transactionToEdit?.notebook_id) ||
      (transactionToEdit?.ledger ?? defaultLedger) === "trustcare",
  );

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
          if (ledger === "pessoal") saveLastChoices({ memberLabel, accountId, paymentMethodId });
          toast.success(instCount >= 2 ? `Parcelamento em ${instCount}x registrado!` : "Lançamento registrado!");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  const isIncome = kind === "income";
  const isPaid = status === "paid";
  // Até 6 categorias viram atalho; as demais ficam em "Outra categoria".
  // A escolhida sempre aparece como atalho, mesmo vindo da lista.
  const MAX_CHIPS = 6;
  const chipCategories = filteredCategories.slice(0, MAX_CHIPS);
  const pickedOutside = filteredCategories.find((c) => c.id === categoryId && !chipCategories.includes(c));
  if (pickedOutside) chipCategories.push(pickedOutside);
  const otherCategories = filteredCategories.filter((c) => !chipCategories.includes(c));
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const summaryParts = [
    ledger === "pessoal" ? "Pessoal" : "Trust Care",
    ledger === "pessoal" ? memberLabel : null,
    selectedAccount?.name ?? selectedMethod?.name ?? null,
    Number(installments) >= 2 ? `${installments}x` : null,
  ].filter(Boolean);

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
        <DialogTitle className="text-lg font-semibold">
          {transactionToEdit ? "Editar lançamento" : "Novo lançamento"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Informe quanto, com o quê e se já foi pago. O resto fica em Mais detalhes.
        </DialogDescription>
        <div role="radiogroup" aria-label="Tipo" className="inline-flex shrink-0 rounded-lg border border-border bg-muted/30 p-0.5">
          {(
            [
              { id: "expense", label: "Saiu" },
              { id: "income", label: "Entrou" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={kind === opt.id}
              onClick={() => {
                setKind(opt.id);
                setCategoryId("");
              }}
              className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
                kind === opt.id
                  ? opt.id === "income"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="mt-2 space-y-4">
        {/* 1. Quanto? */}
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount" className="text-[13px] text-muted-foreground">
            Quanto?
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 font-mono text-lg text-muted-foreground">
              R$
            </span>
            <Input
              id="tx-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="h-14 pl-12 font-mono text-2xl font-semibold tabular-nums md:text-2xl"
              required
              autoFocus
            />
          </div>
        </div>

        {/* 2. Com o quê? + categoria em atalhos */}
        <div className="space-y-1.5">
          <Label htmlFor="tx-description" className="text-[13px] text-muted-foreground">
            {isIncome ? "De onde veio?" : "Com o quê?"}
          </Label>
          <Input
            id="tx-description"
            placeholder={isIncome ? "Ex.: Salário, venda, reembolso" : "Ex.: Mercado, combustível, farmácia"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-10 text-sm"
            required
          />
          {filteredCategories.length > 0 && (
            <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap items-center gap-1.5 pt-1">
              {chipCategories.map((c) => {
                const selected = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategoryId(selected ? "" : c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors ${
                      selected
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: c.color || "#94a3b8" }} />
                    {c.name}
                  </button>
                );
              })}
              {otherCategories.length > 0 && (
                <Select value="" onValueChange={setCategoryId}>
                  <SelectTrigger
                    aria-label="Outra categoria"
                    className="h-[30px] w-auto gap-1 rounded-full border-dashed px-2.5 text-[12.5px] text-muted-foreground"
                  >
                    <SelectValue placeholder="Outra categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-[13px]">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {/* 3. Já foi pago? -> data do pagamento OU vencimento */}
        <div className="space-y-1.5">
          <span id="tx-paid-label" className="text-[13px] font-medium text-muted-foreground">
            {isIncome ? "Já recebeu?" : "Já foi pago?"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-labelledby="tx-paid-label" className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              {(
                [
                  { id: "paid", label: "Sim" },
                  { id: "pending", label: "Ainda não" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={status === opt.id}
                  onClick={() => setStatus(opt.id)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    status === opt.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {isPaid ? (
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                em
                <Input
                  type="date"
                  aria-label={isIncome ? "Data do recebimento" : "Data do pagamento"}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 w-40 font-mono text-[13px]"
                  required
                />
              </label>
            ) : (
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                vence em
                <Input
                  type="date"
                  aria-label="Data de vencimento"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 w-40 font-mono text-[13px]"
                />
              </label>
            )}
          </div>
        </div>

        {/* Resumo dos detalhes + abrir/fechar */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-[13px]">
          <span className="min-w-0 truncate text-muted-foreground">{summaryParts.join(" · ")}</span>
          <button
            type="button"
            aria-expanded={showDetails}
            aria-controls="tx-details"
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:underline"
          >
            {showDetails ? "Menos detalhes" : "Mais detalhes"}
            <ChevronDownIcon className={`size-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showDetails && (
          <div id="tx-details" className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
            {/* De quem é */}
            <div className="space-y-1.5">
              <span id="tx-ledger-label" className="text-[13px] font-medium text-muted-foreground">
                De quem é?
              </span>
              <div role="radiogroup" aria-labelledby="tx-ledger-label" className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "pessoal", label: "Pessoal / casa" },
                    { id: "trustcare", label: "Trust Care" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={ledger === opt.id}
                    onClick={() => {
                      setLedger(opt.id);
                      setCategoryId("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                      ledger === opt.id
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {ledger === "pessoal" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Pessoa</Label>
                  <Select value={memberLabel} onValueChange={setMemberLabel}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUSEHOLD_MEMBERS.map((m) => (
                        <SelectItem key={m} value={m} className="text-[13px]">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Banco ou cartão</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-[13px]">
                        Nenhum
                      </SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-[13px]">
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tx-method" className="text-[13px] text-muted-foreground">
                  Forma de pagamento
                </Label>
                <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                  <SelectTrigger id="tx-method" className="h-9 text-[13px]">
                    <SelectValue placeholder="Não informada" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-[13px]">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ledger === "pessoal" && !transactionToEdit && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-[13px]">
                        À vista
                      </SelectItem>
                      {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-[13px]">
                          {n}x mensais
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!isPaid && (
              <div className="space-y-1.5">
                <Label htmlFor="tx-date" className="text-[13px] text-muted-foreground">
                  Data do lançamento (define o mês em que aparece)
                </Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 w-44 font-mono text-[13px]"
                  required
                />
              </div>
            )}

            {ledger === "trustcare" && availableNotebooks.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="tx-notebook" className="text-[13px] text-muted-foreground">
                  É de algum notebook da revenda?
                </Label>
                <Select value={notebookId} onValueChange={setNotebookId}>
                  <SelectTrigger id="tx-notebook" className="h-9 text-[13px]">
                    <SelectValue placeholder="Não, é um custo ou receita geral" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-[13px]">
                      Não, é um custo ou receita geral
                    </SelectItem>
                    {availableNotebooks.map((n) => (
                      <SelectItem key={n.id} value={n.id} className="text-[13px]">
                        {n.brand ? `${n.brand} ` : ""}
                        {n.model} {n.specs ? `(${n.specs})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tx-notes" className="text-[13px] text-muted-foreground">
                Observação
              </Label>
              <Textarea
                id="tx-notes"
                placeholder="Número do recibo, combinado, detalhe..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-16 resize-none text-[13px]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />}
            {transactionToEdit ? "Salvar alterações" : isIncome ? "Salvar entrada" : "Salvar gasto"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
