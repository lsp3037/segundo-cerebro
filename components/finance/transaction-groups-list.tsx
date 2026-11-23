"use client";

import { LaptopIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import type { Transaction } from "@/lib/data/finance";
import { txSituation } from "@/lib/finance/transaction-groups";
import type { TxGroup, TxSituationTone } from "@/lib/finance/transaction-groups.types";
import { formatCentsToBrl } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryIcon } from "./category-icon";
import { LEDGER_BADGES } from "./meta";
import { PayCheck } from "./pay-toggle";

const SITUATION_CLASS: Record<TxSituationTone, string> = {
  late: "text-rose-400",
  soon: "text-amber-400",
  in: "text-emerald-400",
  mute: "text-muted-foreground",
};

// Colunas da linha no computador. A coluna de conta/forma de pagamento some quando ninguém a usa.
const GRID_WITH_ACCOUNT =
  "grid-cols-[40px_minmax(0,1fr)_auto_32px] @4xl:grid-cols-[36px_minmax(0,1.6fr)_minmax(0,1fr)_96px_150px_140px_36px]";
const GRID_WITHOUT_ACCOUNT =
  "grid-cols-[40px_minmax(0,1fr)_auto_32px] @4xl:grid-cols-[36px_minmax(0,1.6fr)_minmax(0,1fr)_96px_140px_36px]";

export function accountLabel(tx: Transaction): string | null {
  return tx.account?.name ?? tx.payment_method?.name ?? null;
}

interface RowActions {
  onEdit: (tx: Transaction) => void;
  onToggle: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

interface TransactionRowProps extends RowActions {
  tx: Transaction;
  paid: boolean;
  today: string;
  first: boolean;
  mixedLedgers: boolean;
  showAccount: boolean;
}

function TransactionRow({ tx, paid, today, first, mixedLedgers, showAccount, onEdit, onToggle, onDelete }: TransactionRowProps) {
  const income = tx.kind === "income";
  const situation = txSituation(tx, paid, today);
  const late = situation.tone === "late";
  const ledger = LEDGER_BADGES[tx.ledger as "pessoal" | "trustcare"];
  const account = accountLabel(tx);
  const toggleLabel = paid ? "Desfazer baixa" : income ? "Marcar recebido" : "Dar baixa";

  return (
    <div
      className={cn(
        "group relative grid min-h-[58px] items-center gap-x-2.5 px-2 py-1.5 transition-colors hover:bg-muted/60 @4xl:gap-x-3 @4xl:px-3",
        showAccount ? GRID_WITH_ACCOUNT : GRID_WITHOUT_ACCOUNT,
        !first && "before:absolute before:left-[52px] before:right-3 before:top-0 before:h-px before:bg-border hover:before:opacity-0 @4xl:before:left-[60px]",
        late && "bg-[linear-gradient(90deg,rgba(251,113,133,.09),rgba(251,113,133,0)_55%)]",
      )}
    >
      <PayCheck paid={paid} income={income} label={tx.description} onToggle={() => onToggle(tx)} />

      <button type="button" onClick={() => onEdit(tx)} className="min-w-0 cursor-pointer py-1 text-left">
        <span className={cn("block truncate text-[15px] font-medium @4xl:text-[14.5px]", paid ? "text-foreground/75" : "text-foreground")}>
          {tx.description}
        </span>
        <span className="block text-[13px] @4xl:truncate">
          <span className={cn("tabular-nums", SITUATION_CLASS[situation.tone])}>{situation.text}</span>
          {tx.member_label && <span className="text-muted-foreground @4xl:hidden"> · {tx.member_label}</span>}
        </span>
        {(tx.notes || tx.notebook) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {tx.notebook && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <LaptopIcon className="size-3" aria-hidden="true" />
                {tx.notebook.brand ? `${tx.notebook.brand} ` : ""}
                {tx.notebook.model}
              </span>
            )}
            {tx.notes && <span className="truncate">{tx.notes}</span>}
          </span>
        )}
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-[13.5px] text-foreground/75 @4xl:flex">
        <CategoryIcon name={tx.category?.name ?? ""} kind={income ? "income" : "expense"} icon={tx.category?.icon} color={tx.category?.color} />
        <span className="truncate">{tx.category?.name ?? "Sem categoria"}</span>
      </div>

      <div className="hidden min-w-0 text-[13.5px] text-foreground/75 @4xl:block">
        <span className="block truncate">{tx.member_label}</span>
        {mixedLedgers && ledger && (
          <span className={cn("mt-0.5 inline-flex items-center rounded border px-1.5 py-px text-xs font-medium", ledger.className)}>
            {ledger.label}
          </span>
        )}
      </div>

      {showAccount && (
        <div className="hidden min-w-0 truncate text-[13.5px] text-muted-foreground @4xl:block">{account}</div>
      )}

      <div
        className={cn(
          "whitespace-nowrap text-right text-[15.5px] font-semibold tabular-nums",
          income ? "text-emerald-400" : paid ? "text-[#d9a3ad]" : "text-rose-400",
        )}
      >
        {income ? "+" : "−"} {formatCentsToBrl(tx.amount_cents)}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 justify-self-end p-0 text-muted-foreground hover:text-foreground data-[state=open]:opacity-100 @4xl:opacity-0 @4xl:focus-visible:opacity-100 @4xl:group-hover:opacity-100"
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Opções de {tx.description}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-[13px]">
          <DropdownMenuItem onClick={() => onEdit(tx)} className="cursor-pointer gap-2">
            <PencilIcon className="size-3.5" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(tx)}
            className="cursor-pointer gap-2 text-rose-400 focus:text-rose-400"
          >
            <Trash2Icon className="size-3.5" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="absolute right-14 top-1/2 hidden -translate-y-1/2 gap-1.5 rounded-lg bg-muted py-1 pl-3 @4xl:group-hover:flex @4xl:group-focus-within:flex">
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(tx)} className="h-[30px] text-[13px]">
          Editar
        </Button>
        <Button
          type="button"
          variant={paid ? "outline" : "default"}
          size="sm"
          onClick={() => onToggle(tx)}
          className="h-[30px] text-[13px]"
        >
          {toggleLabel}
        </Button>
      </div>
    </div>
  );
}

function GroupSummary({ group }: { group: TxGroup }) {
  const done = group.section === "done";
  const incomeVerb = done ? "entraram" : "entram";
  const expenseVerb = done ? "saíram" : "saem";
  return (
    <span className="ml-auto flex flex-wrap justify-end gap-x-3 text-[13px] tabular-nums text-foreground/75">
      {group.incomeCents > 0 && (
        <span>
          {incomeVerb} <b className="font-medium text-emerald-400">{formatCentsToBrl(group.incomeCents)}</b>
        </span>
      )}
      {group.expenseCents > 0 && (
        <span>
          {expenseVerb} <b className="font-medium">{formatCentsToBrl(group.expenseCents)}</b>
        </span>
      )}
    </span>
  );
}

interface TransactionGroupsListProps extends RowActions {
  groups: TxGroup[];
  isPaid: (tx: Transaction) => boolean;
  today: string;
  mixedLedgers: boolean;
}

export function TransactionGroupsList({ groups, isPaid, today, mixedLedgers, ...actions }: TransactionGroupsListProps) {
  const showAccount = groups.some((g) => g.items.some((tx) => accountLabel(tx) !== null));

  return (
    <div>
      {groups.map((group) => (
        <section key={`${group.section}:${group.id}`} aria-label={group.title} className="mb-7">
          <header className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-3 bg-background px-3 pb-2 pt-3.5 @4xl:static @4xl:pt-0">
            <h3 className={cn("text-sm font-semibold @4xl:text-[15px]", group.tone === "late" && "text-rose-400")}>
              {group.title}
            </h3>
            {group.subtitle && <span className="hidden text-[13px] text-muted-foreground @4xl:inline">{group.subtitle}</span>}
            <GroupSummary group={group} />
          </header>
          <div className="overflow-hidden rounded-lg bg-card">
            {group.items.map((tx, index) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                paid={isPaid(tx)}
                today={today}
                first={index === 0}
                mixedLedgers={mixedLedgers}
                showAccount={showAccount}
                {...actions}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
