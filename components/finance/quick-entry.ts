// Lógica compartilhada do "Lançar rápido" (linha no computador e folha no celular).
import { toast } from "sonner";

import { createTransaction, trashTransaction } from "@/lib/actions/finance";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { FinanceCategory, PaymentMethod } from "@/lib/data/finance";
import type { AccountWithBalance } from "@/lib/data/finance-family";
import { addDays } from "@/lib/dates";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import { inputToCents } from "@/lib/money";
import { readLastChoices, saveLastChoices } from "./last-choices";
import { toastWithUndo } from "./pay-toggle";

export type QuickKind = "income" | "expense";
export type QuickLedger = "pessoal" | "trustcare";

// Valor de "sem conta" / "sem categoria" nos seletores (o Select não aceita texto vazio).
export const NONE_VALUE = "__none__";

export type DayMode = "today" | "yesterday" | "other";

export function resolveDay(mode: DayMode, customDate: string, today: string) {
  if (mode === "today") return today;
  return mode === "yesterday" ? addDays(today, -1) : customDate;
}

export interface QuickEntryDraft {
  kind: QuickKind;
  amountStr: string;
  description: string;
  date: string;
  categoryId: string;
  status: "paid" | "pending";
  dueDate: string;
  memberLabel: string;
  accountId: string;
  paymentMethodId: string;
}

// O que já foi digitado na folha e segue para o formulário completo ("Mais opções").
export interface NewTransactionPrefill {
  kind: QuickKind;
  description: string;
  amountCents: number;
}

export interface QuickChoices {
  memberLabel: string;
  accountId: string;
  paymentMethodId: string;
}

// No Consolidado a entrada rápida vai para o Pessoal.
export function quickLedgerFor(currentLedger: string): QuickLedger {
  return currentLedger === "trustcare" ? "trustcare" : "pessoal";
}

// Categorias do tipo e da carteira escolhidos, sem nomes repetidos.
export function categoriesForEntry(categories: FinanceCategory[], ledger: QuickLedger, kind: QuickKind) {
  const seen = new Set<string>();
  return categories.filter((c) => {
    if (c.ledger !== ledger || c.kind !== kind) return false;
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Pessoa do filtro atual, senão a última escolha. Conta e forma de pagamento só se ainda existirem.
export function resolveQuickChoices(
  accounts: AccountWithBalance[],
  paymentMethods: PaymentMethod[],
  memberFilter: string | null,
): QuickChoices {
  const saved = readLastChoices();
  const savedMember = (HOUSEHOLD_MEMBERS as readonly string[]).includes(saved?.memberLabel ?? "") ? saved?.memberLabel : undefined;
  return {
    memberLabel: memberFilter ?? savedMember ?? "Casa",
    accountId: saved?.accountId && accounts.some((a) => a.id === saved.accountId) ? saved.accountId : NONE_VALUE,
    paymentMethodId:
      saved?.paymentMethodId && paymentMethods.some((m) => m.id === saved.paymentMethodId) ? saved.paymentMethodId : "",
  };
}

// Valida, grava e avisa. Devolve true quando gravou (a tela então limpa os campos).
export async function saveQuickEntry(ledger: QuickLedger, draft: QuickEntryDraft, today: string): Promise<boolean> {
  const amountCents = inputToCents(draft.amountStr);
  if (amountCents <= 0) {
    toast.error("Informe um valor maior que R$ 0,00.");
    return false;
  }
  if (!draft.description.trim()) {
    toast.error("Informe o que foi.");
    return false;
  }
  if (!draft.date) {
    toast.error("Informe o dia.");
    return false;
  }
  if (draft.status === "paid" && draft.kind === "expense" && draft.date > today) {
    toast.error("Uma saída já paga não pode ter data no futuro.");
    return false;
  }

  const personal = ledger === "pessoal";
  // Bancos e cartões são da carteira pessoal.
  const accountId = personal && draft.accountId !== NONE_VALUE ? draft.accountId : null;
  const res = await createTransaction({
    ledger,
    kind: draft.kind,
    status: draft.status,
    amount_cents: amountCents,
    description: draft.description.trim(),
    date: draft.date,
    due_date: draft.status === "pending" && draft.dueDate ? draft.dueDate : null,
    category_id: draft.categoryId && draft.categoryId !== NONE_VALUE ? draft.categoryId : null,
    payment_method_id: draft.paymentMethodId || null,
    account_id: accountId,
    member_label: personal && draft.memberLabel ? draft.memberLabel : null,
  });
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }

  if (personal) {
    saveLastChoices({ memberLabel: draft.memberLabel, accountId: draft.accountId, paymentMethodId: draft.paymentMethodId });
  }
  // Desfazer = mandar o recém-criado para a lixeira; o aviso seguinte oferece restaurar.
  const createdId = res.data.id;
  toastWithUndo("Lançamento registrado.", async () => {
    const trashed = await trashTransaction(createdId);
    if (trashed.ok) toastWithUndo("Lançamento desfeito.", () => restoreFinanceItem("transaction", createdId));
    return trashed;
  });
  return true;
}
