import type { ComponentType } from "react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CreditCardIcon,
  LaptopIcon,
  QrCodeIcon,
  ReceiptIcon,
  WalletIcon,
} from "lucide-react";

export type LedgerType = "all" | "pessoal" | "trustcare";
export type TransactionKind = "income" | "expense";
export type NotebookStatus = "bought" | "repair" | "for_sale" | "sold";

export const LEDGER_LABELS: Record<LedgerType, string> = {
  all: "Visão Consolidada",
  pessoal: "Pessoal / Familiar",
  trustcare: "Trust Care (Empresa)",
};

export const LEDGER_BADGES: Record<"pessoal" | "trustcare", { label: string; className: string }> = {
  pessoal: {
    label: "Pessoal / Familiar",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-400",
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
    color: "#a855f7",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    dotClass: "bg-purple-400",
  },
  repair: {
    label: "Em Bancada / Reparo",
    color: "#f59e0b",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 animate-pulse",
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
