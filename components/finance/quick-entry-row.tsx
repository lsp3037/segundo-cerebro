"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";

import type { FinanceCategory, PaymentMethod } from "@/lib/data/finance";
import type { AccountWithBalance } from "@/lib/data/finance-family";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuickCategorySelect } from "./quick-category-select";
import { QuickDaySelect } from "./quick-day-select";
import {
  categoriesForEntry,
  quickLedgerFor,
  resolveDay,
  resolveQuickChoices,
  saveQuickEntry,
  type DayMode,
  type QuickKind,
} from "./quick-entry";

interface QuickEntryRowProps {
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  accounts: AccountWithBalance[];
  currentLedger: string;
  memberFilter: string | null;
  today: string;
}

const KIND_OPTIONS: { id: QuickKind; label: string }[] = [
  { id: "expense", label: "Saída" },
  { id: "income", label: "Entrada" },
];

// Linha tracejada do topo da lista (só em tela larga): escreve, Enter, e já está lançado.
export function QuickEntryRow({ categories, paymentMethods, accounts, currentLedger, memberFilter, today }: QuickEntryRowProps) {
  const ledger = quickLedgerFor(currentLedger);
  const [isPending, startTransition] = useTransition();
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<QuickKind>("expense");
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayMode, setDayMode] = useState<DayMode>("today");
  const [customDate, setCustomDate] = useState(today);
  const [choices] = useState(() => resolveQuickChoices(accounts, paymentMethods, memberFilter));

  const options = useMemo(() => categoriesForEntry(categories, ledger, kind), [categories, ledger, kind]);
  const date = resolveDay(dayMode, customDate, today);

  const clearTexts = () => {
    setDescription("");
    setAmountStr("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const saved = await saveQuickEntry(
        ledger,
        {
          kind,
          amountStr,
          description,
          date,
          categoryId,
          status: "paid",
          dueDate: "",
          // Pessoa do filtro atual, quando houver; senão a última escolha.
          memberLabel: memberFilter ?? choices.memberLabel,
          accountId: choices.accountId,
          paymentMethodId: choices.paymentMethodId,
        },
        today,
      );
      if (saved) clearTexts();
      descriptionRef.current?.focus();
    });
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    const field = e.target as HTMLElement;
    // Esc dentro de uma lista aberta só fecha a lista.
    if (e.key !== "Escape" || field.tagName !== "INPUT") return;
    clearTexts();
    field.blur();
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={handleEscape}
      data-no-month-shortcuts
      aria-label="Lançar rápido"
      className="mb-5 grid grid-cols-[auto_auto_minmax(0,1fr)_120px_190px_auto_auto] items-center gap-2.5 rounded-[9px] border border-dashed border-border bg-card px-2.5 py-2"
    >
      <PlusIcon className="mx-0.5 size-[18px] text-muted-foreground" aria-hidden="true" />

      <div role="group" aria-label="Tipo do lançamento" className="inline-flex gap-0.5 rounded-lg bg-muted/50 p-0.5">
        {KIND_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={kind === opt.id}
            onClick={() => {
              setKind(opt.id);
              setCategoryId("");
            }}
            className={cn(
              "h-8 cursor-pointer rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              kind === opt.id
                ? opt.id === "income"
                  ? "bg-emerald-500/15 font-medium text-emerald-400"
                  : "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Input
        ref={descriptionRef}
        aria-label="O que foi"
        placeholder="Lançar rápido: o que foi? (ex.: Mercado)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
        className="h-9 border-0 bg-transparent px-2.5 text-[14px] shadow-none dark:bg-transparent"
      />

      <Input
        aria-label="Valor"
        type="text"
        inputMode="decimal"
        placeholder="R$ 0,00"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        className="h-9 bg-muted/50 text-right text-[14px] tabular-nums"
      />

      <QuickCategorySelect
        categories={options}
        kind={kind}
        value={categoryId}
        onChange={setCategoryId}
        className="h-9 bg-muted/50"
      />

      <div className="flex items-center gap-1.5">
        <QuickDaySelect value={dayMode} onChange={setDayMode} className="h-9 min-w-[104px] bg-muted/50" />
        {dayMode === "other" && (
          <Input
            type="date"
            aria-label="Dia do lançamento"
            value={customDate}
            max={kind === "expense" ? today : undefined}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-9 w-[150px] text-[13px]"
          />
        )}
      </div>

      <Button type="submit" disabled={isPending} className="h-9 px-4 text-[13px]">
        {isPending && <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
        Salvar
      </Button>
    </form>
  );
}
