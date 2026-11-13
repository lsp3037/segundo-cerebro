import type { ComponentType } from "react";
import {
  BanknoteIcon,
  CreditCardIcon,
  QrCodeIcon,
  ReceiptIcon,
  WalletIcon,
} from "lucide-react";

export type LedgerType = "all" | "pessoal" | "trustcare";
export type TransactionKind = "income" | "expense";
export type NotebookStatus = "bought" | "repair" | "for_sale" | "sold";
export type FinanceTab =
  | "visao"
  | "contas"
  | "orcamentos"
  | "relatorios"
  | "fluxo"
  | "notebooks"
  | "investimentos";

// Abas com nomes e posições fixos: Resumo e Lançamentos sempre primeiro, Análises sempre por último.
// O que muda entre Pessoal e Trust Care fica no meio (Orçamento, Bancos e cartões e Investimentos / Notebooks).
export const LEDGER_TABS: Record<LedgerType, Array<{ id: FinanceTab; label: string }>> = {
  pessoal: [
    { id: "visao", label: "Resumo" },
    { id: "fluxo", label: "Lançamentos" },
    { id: "orcamentos", label: "Orçamento" },
    { id: "contas", label: "Bancos e cartões" },
    { id: "investimentos", label: "Investimentos" },
    { id: "relatorios", label: "Análises" },
  ],
  trustcare: [
    { id: "visao", label: "Resumo" },
    { id: "fluxo", label: "Lançamentos" },
    { id: "notebooks", label: "Notebooks" },
    { id: "relatorios", label: "Análises" },
  ],
  all: [
    { id: "visao", label: "Resumo" },
    { id: "fluxo", label: "Lançamentos" },
    { id: "relatorios", label: "Análises" },
  ],
};

export const LEDGER_LABELS: Record<LedgerType, string> = {
  all: "Pessoal + Trust Care",
  pessoal: "Pessoal / Familiar",
  trustcare: "Trust Care (Empresa)",
};

export const LEDGER_BADGES: Record<"pessoal" | "trustcare", { label: string; className: string }> = {
  pessoal: {
    label: "Pessoal / Familiar",
    className: "border-border bg-muted/60 text-foreground",
  },
  trustcare: {
    label: "Trust Care",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
};

export const NOTEBOOK_STATUS_CONFIG: Record<
  NotebookStatus,
  { label: string; color: string; badgeClass: string; dotClass: string }
> = {
  bought: {
    label: "Comprado",
    color: "#a1a1aa",
    badgeClass: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    dotClass: "bg-zinc-400",
  },
  repair: {
    label: "Em Bancada / Reparo",
    color: "#f59e0b",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400",
  },
  for_sale: {
    label: "À Venda (Estoque)",
    color: "#06b6d4",
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    dotClass: "bg-cyan-400",
  },
  sold: {
    label: "Vendido",
    color: "#10b981",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dotClass: "bg-emerald-400",
  },
};

export function getPaymentMethodIcon(type?: string | null): ComponentType<{ className?: string }> {
  switch (type) {
    case "pix":
      return QrCodeIcon;
    case "credit":
    case "debit":
      return CreditCardIcon;
    case "cash":
      return BanknoteIcon;
    case "boleto":
      return ReceiptIcon;
    default:
      return WalletIcon;
  }
}
