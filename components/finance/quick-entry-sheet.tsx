"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";

import type { FinanceCategory, PaymentMethod } from "@/lib/data/finance";
import type { AccountWithBalance } from "@/lib/data/finance-family";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import { inputToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { QuickCategorySelect } from "./quick-category-select";
import { QuickDaySelect } from "./quick-day-select";
import {
  NONE_VALUE,
  categoriesForEntry,
  quickLedgerFor,
  resolveDay,
  resolveQuickChoices,
  saveQuickEntry,
  type DayMode,
  type NewTransactionPrefill,
  type QuickKind,
} from "./quick-entry";

interface QuickEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  accounts: AccountWithBalance[];
  currentLedger: string;
  memberFilter: string | null;
  today: string;
  onMoreOptions: (prefill: NewTransactionPrefill) => void;
}

type SheetFormProps = Omit<QuickEntrySheetProps, "open">;

const KIND_OPTIONS: { id: QuickKind; label: string }[] = [
  { id: "expense", label: "Saída" },
  { id: "income", label: "Entrada" },
];

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex gap-0.5 rounded-[10px] bg-muted/60 p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "h-10 flex-1 cursor-pointer rounded-lg text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === opt.id ? "bg-foreground font-semibold text-background" : "text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-[13px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

const FIELD_CLASS = "h-11 w-full bg-card text-[15px]";

function QuickEntrySheetForm({
  onOpenChange,
  categories,
  paymentMethods,
  accounts,
  currentLedger,
  memberFilter,
  today,
  onMoreOptions,
}: SheetFormProps) {
  const ledger = quickLedgerFor(currentLedger);
  const personal = ledger === "pessoal";
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<QuickKind>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayMode, setDayMode] = useState<DayMode>("today");
  const [customDate, setCustomDate] = useState(today);
  const [choices, setChoices] = useState(() => {
    const remembered = resolveQuickChoices(accounts, paymentMethods, memberFilter);
    return personal ? remembered : { ...remembered, accountId: NONE_VALUE };
  });
  const [memberLabel, setMemberLabel] = useState(choices.memberLabel);
  const [paid, setPaid] = useState(true);
  const [dueDate, setDueDate] = useState("");

  const options = useMemo(() => categoriesForEntry(categories, ledger, kind), [categories, ledger, kind]);
  const date = resolveDay(dayMode, customDate, today);

  // "Pago com" junta conta e forma de pagamento: escolher uma limpa a outra.
  const payWith = choices.accountId !== NONE_VALUE ? `a:${choices.accountId}` : choices.paymentMethodId ? `m:${choices.paymentMethodId}` : NONE_VALUE;
  const handlePayWith = (value: string) => {
    if (value.startsWith("a:")) setChoices((c) => ({ ...c, accountId: value.slice(2), paymentMethodId: "" }));
    else if (value.startsWith("m:")) setChoices((c) => ({ ...c, accountId: NONE_VALUE, paymentMethodId: value.slice(2) }));
    else setChoices((c) => ({ ...c, accountId: NONE_VALUE, paymentMethodId: "" }));
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
          status: paid ? "paid" : "pending",
          dueDate,
          memberLabel,
          accountId: choices.accountId,
          paymentMethodId: choices.paymentMethodId,
        },
        today,
      );
      if (saved) onOpenChange(false);
    });
  };

  const moreOptions = () => {
    onOpenChange(false);
    onMoreOptions({ kind, description: description.trim(), amountCents: inputToCents(amountStr) });
  };

  const payAccounts = personal ? accounts : [];

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <Segmented<QuickKind> label="Tipo do lançamento" value={kind} options={KIND_OPTIONS} onChange={(k) => {
        setKind(k);
        setCategoryId("");
      }} />

      <Field id="quick-amount" label="Valor">
        <Input
          id="quick-amount"
          type="text"
          inputMode="decimal"
          placeholder="R$ 0,00"
          autoFocus
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="h-16 bg-card text-2xl font-semibold tabular-nums md:text-2xl"
        />
      </Field>

      <Field id="quick-description" label="O que foi">
        <Input
          id="quick-description"
          placeholder="Ex.: Mercado"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          className={FIELD_CLASS}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Categoria">
          <QuickCategorySelect categories={options} kind={kind} value={categoryId} onChange={setCategoryId} className={FIELD_CLASS} />
        </Field>
        <Field label="Dia">
          <QuickDaySelect value={dayMode} onChange={setDayMode} className={cn(FIELD_CLASS, "w-full")} />
        </Field>
      </div>
      {dayMode === "other" && (
        <Input
          type="date"
          aria-label="Dia do lançamento"
          value={customDate}
          max={kind === "expense" && paid ? today : undefined}
          onChange={(e) => setCustomDate(e.target.value)}
          className={FIELD_CLASS}
        />
      )}

      <div className={cn("grid gap-2", personal ? "grid-cols-2" : "grid-cols-1")}>
        {personal && (
          <Field label="Quem">
            <Select value={memberLabel} onValueChange={setMemberLabel}>
              <SelectTrigger aria-label="Quem" className={FIELD_CLASS}>
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
          </Field>
        )}
        <Field label="Pago com">
          <Select value={payWith} onValueChange={handlePayWith}>
            <SelectTrigger aria-label="Pago com" className={FIELD_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE} className="text-[13px]">
                Não informado
              </SelectItem>
              {payAccounts.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[12px]">Bancos e cartões</SelectLabel>
                  {payAccounts.map((a) => (
                    <SelectItem key={a.id} value={`a:${a.id}`} className="text-[13px]">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {paymentMethods.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[12px]">Forma de pagamento</SelectLabel>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={`m:${m.id}`} className="text-[13px]">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[14px] text-muted-foreground">{kind === "income" ? "Já recebeu" : "Já foi pago"}</span>
        <Segmented<"yes" | "no">
          label={kind === "income" ? "Já recebeu" : "Já foi pago"}
          value={paid ? "yes" : "no"}
          options={[
            { id: "yes", label: "Sim" },
            { id: "no", label: "Não" },
          ]}
          onChange={(v) => setPaid(v === "yes")}
          className="w-40"
        />
      </div>
      {!paid && (
        <Field id="quick-due" label="Vence em">
          <Input id="quick-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={FIELD_CLASS} />
        </Field>
      )}

      <p className="px-0.5 pt-1 text-[13px] text-muted-foreground">
        Parcelas, repetição e observações ficam em &quot;Mais opções&quot;.
      </p>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button type="button" variant="outline" onClick={moreOptions} disabled={isPending} className="h-12 text-[15px]">
          Mais opções
        </Button>
        <Button type="submit" disabled={isPending} className="h-12 text-[15px]">
          {isPending && <Loader2Icon className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

// Folha que sobe de baixo no celular, com o formulário curto de lançamento.
export function QuickEntrySheet({ open, onOpenChange, ...formProps }: QuickEntrySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-[22px] px-4 pb-6 pt-3.5"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        <SheetTitle className="mb-1 text-base font-semibold">Novo lançamento</SheetTitle>
        <SheetDescription className="sr-only">Informe o valor, o que foi e salve. Mais opções abre o formulário completo.</SheetDescription>
        <div className="mt-2.5">
          <QuickEntrySheetForm onOpenChange={onOpenChange} {...formProps} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
