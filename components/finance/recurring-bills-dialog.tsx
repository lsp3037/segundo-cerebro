"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, Loader2Icon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  bootstrapHouseholdTemplate,
  deleteRecurringBill,
  saveRecurringBill,
  saveRecurringValuesBatch,
  updateRecurringSchedule,
} from "@/lib/actions/finance-family";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { FinanceCategory } from "@/lib/data/finance";
import type { AccountWithBalance, RecurringBill } from "@/lib/data/finance-family";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import { billAmountForMonth, formatMonthShortYear, parseAmountChanges } from "@/lib/finance/recurring";
import { centsToInput, inputToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastWithUndo } from "./pay-toggle";
import { UiGenerationReveal } from "./ui-generation-reveal";

interface RecurringBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bills: RecurringBill[];
  categories: FinanceCategory[];
  accounts: AccountWithBalance[];
  currentMonth: string;
}

export function RecurringBillsDialog(props: RecurringBillsDialogProps) {
  const formKey = `${props.open}-${props.bills.map((b) => `${b.id}:${b.amount_cents}:${b.due_day}:${JSON.stringify(b.amount_changes)}:${b.start_month}:${b.end_month}:${b.skipped_months.join(",")}`).join("|")}`;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <RecurringBillsForm key={formKey} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function RecurringBillsForm({
  onOpenChange,
  bills,
  categories,
  accounts,
  currentMonth,
}: RecurringBillsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [valuesById, setValuesById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      bills.map((b) => {
        const now = billAmountForMonth(b, currentMonth);
        return [b.id, now > 0 ? centsToInput(now) : ""];
      }),
    ),
  );
  // Mês a partir do qual um valor novo passa a valer (padrão: o mês da tela).
  const [fromById, setFromById] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [daysById, setDaysById] = useState<Record<string, string>>(() =>
    Object.fromEntries(bills.map((b) => [b.id, b.due_day ? String(b.due_day) : ""])),
  );

  // Nova conta fixa / receita fixa
  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<"income" | "expense">("expense");
  const [newDesc, setNewDesc] = useState("");
  const [newMode, setNewMode] = useState<"fixed" | "percent_of_income">("fixed");
  const [newValStr, setNewValStr] = useState("");
  const [newPctStr, setNewPctStr] = useState("10");
  const [newDueDay, setNewDueDay] = useState("");
  const [newMember, setNewMember] = useState("Casa");
  const [newCatId, setNewCatId] = useState("");
  const [bootstrapRevealKey, setBootstrapRevealKey] = useState(0);

  const personalCats = categories.filter((c) => c.ledger === "pessoal" && c.kind === newKind);

  const handleBootstrap = () => {
    startTransition(async () => {
      const res = await bootstrapHouseholdTemplate(currentMonth);
      if (res.ok) {
        if (res.data.createdCount > 0) {
          setBootstrapRevealKey((k) => k + 1);
        }
        toast.success(
          res.data.createdCount > 0
            ? `Modelo carregado (${res.data.createdCount} itens adicionados). Preencha seus valores abaixo!`
            : "Seu modelo já está completo.",
        );
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleSaveBatch = () => {
    const items = bills
      .filter((b) => b.amount_mode === "fixed")
      .map((b) => {
        const dayNum = daysById[b.id]?.trim() ? Number(daysById[b.id]) : null;
        return {
          id: b.id,
          amount_cents: valuesById[b.id]?.trim() ? inputToCents(valuesById[b.id]) : 0,
          due_day: dayNum && dayNum >= 1 && dayNum <= 31 ? dayNum : null,
          active: true,
          from_month: fromById[b.id] || currentMonth,
        };
      });

    startTransition(async () => {
      const res = await saveRecurringValuesBatch({ month: currentMonth, items });
      if (res.ok) {
        toast.success("Valores salvos e gerados no mês!");
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;
    const due = newDueDay.trim() ? Number(newDueDay) : null;
    const pctBp = Math.round(Number(newPctStr.replace(",", ".")) * 100);

    startTransition(async () => {
      const res = await saveRecurringBill({
        kind: newKind,
        description: newDesc.trim(),
        amount_mode: newMode,
        amount_cents: newMode === "fixed" ? inputToCents(newValStr) : 0,
        percent_bp: newMode === "percent_of_income" ? pctBp : null,
        due_day: due && due >= 1 && due <= 31 ? due : null,
        category_id: newCatId || null,
        account_id: accounts.find((a) => a.name.toLowerCase() === newDesc.trim().toLowerCase())?.id ?? null,
        member_label: newMember || null,
        month: currentMonth,
      });
      if (res.ok) {
        toast.success("Item fixo adicionado!");
        setNewDesc("");
        setNewValStr("");
        setNewDueDay("");
        setShowNew(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (id: string, desc: string) => {
    startTransition(async () => {
      const res = await deleteRecurringBill(id);
      if (res.ok) {
        toastWithUndo(`${desc} saiu das contas fixas.`, () => restoreFinanceItem("recurring_bill", id));
      } else toast.error(res.error);
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base">Contas Fixas da Casa &amp; Dízimo Automático</DialogTitle>
        <DialogDescription className="text-xs">
          Tudo que está aqui gera automaticamente um lançamento pendente todo mês (e o Dízimo calcula 10% sobre as entradas).
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-y border-border/50">
        <Button type="button" variant="outline" size="sm" onClick={handleBootstrap} disabled={isPending} className="h-8 gap-1.5 text-xs border-emerald-500/35 text-emerald-400">
          <SparklesIcon className="size-3.5" />
          Carregar Modelo da Planilha (Casa / Luan / Rayzza)
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowNew((v) => !v)} className="h-8 gap-1 text-xs">
          <PlusIcon className="size-3.5" />
          Adicionar Item Fixo
        </Button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Select value={newKind} onValueChange={(v) => setNewKind(v as "income" | "expense")}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense" className="text-xs">Saída</SelectItem>
                <SelectItem value="income" className="text-xs">Entrada</SelectItem>
              </SelectContent>
            </Select>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descrição (ex: Aluguel)" className="sm:col-span-2 text-xs" required />
            <Select value={newMember} onValueChange={setNewMember}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOUSEHOLD_MEMBERS.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {newKind === "expense" && (
              <Select value={newMode} onValueChange={(v) => setNewMode(v as "fixed" | "percent_of_income")}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed" className="text-xs">Valor fixo (R$)</SelectItem>
                  <SelectItem value="percent_of_income" className="text-xs">% das Entradas</SelectItem>
                </SelectContent>
              </Select>
            )}
            {newMode === "fixed" ? (
              <Input value={newValStr} onChange={(e) => setNewValStr(e.target.value)} placeholder="Valor R$" className="font-mono text-xs" />
            ) : (
              <Input value={newPctStr} onChange={(e) => setNewPctStr(e.target.value)} placeholder="% (ex: 10)" className="font-mono text-xs" />
            )}
            <Input type="number" min={1} max={31} value={newDueDay} onChange={(e) => setNewDueDay(e.target.value)} placeholder="Dia venc." className="font-mono text-xs" />
            <Select value={newCatId} onValueChange={setNewCatId}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Categoria..." /></SelectTrigger>
              <SelectContent>
                {personalCats.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNew(false)} className="h-7 text-xs">Cancelar</Button>
            <Button type="submit" size="sm" disabled={isPending} className="h-7 text-xs">Salvar Item</Button>
          </div>
        </form>
      )}

      <UiGenerationReveal
        triggerKey={bootstrapRevealKey}
        variant="ui"
        mode="skeleton"
        duration={1400}
        className="flex-1 divide-y divide-border/40 overflow-y-auto pr-1"
      >
        {bills.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Nenhuma conta fixa configurada ainda. Clique em <strong>Carregar Modelo da Planilha</strong> acima para começar em 1 clique.
          </div>
        ) : (
          bills.map((b) => (
            <div key={b.id} className="grid grid-cols-12 items-center gap-2 py-2 text-xs">
              <div className="col-span-4 min-w-0">
                <div className="truncate font-medium text-foreground">
                  <span className={b.kind === "income" ? "text-emerald-400" : "text-rose-400"}>
                    {b.kind === "income" ? "+ " : "- "}
                  </span>
                  {b.description}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.member_label ?? "Casa"}
                  {scheduleNote(b, currentMonth) && <span className="text-amber-500"> · {scheduleNote(b, currentMonth)}</span>}
                </div>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Dia"
                  title={b.kind === "income" ? "Dia do mês em que você recebe" : "Dia do vencimento"}
                  value={daysById[b.id] ?? ""}
                  onChange={(e) => setDaysById((prev) => ({ ...prev, [b.id]: e.target.value }))}
                  className="h-7 font-mono text-xs"
                />
              </div>
              <div className="col-span-4">
                {b.amount_mode === "percent_of_income" ? (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-center font-mono text-xs text-emerald-400">
                    {((b.percent_bp ?? 1000) / 100).toFixed(0)}% auto das Entradas
                  </div>
                ) : (
                  <Input
                    placeholder="0,00"
                    value={valuesById[b.id] ?? ""}
                    onChange={(e) => setValuesById((prev) => ({ ...prev, [b.id]: e.target.value }))}
                    className="h-7 text-right font-mono text-xs"
                  />
                )}
              </div>
              <div className="col-span-2 flex justify-end gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-muted-foreground"
                  aria-expanded={openId === b.id}
                  aria-label={"Período e reajuste de " + b.description}
                  title="Período, reajuste e pular mês"
                  onClick={() => setOpenId(openId === b.id ? null : b.id)}
                >
                  <ChevronDownIcon className={"size-3.5 transition-transform " + (openId === b.id ? "rotate-180" : "")} />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="size-7 p-0 text-rose-400" onClick={() => handleDelete(b.id, b.description)}>
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
              {openId === b.id && (
                <ScheduleDetails
                  bill={b}
                  currentMonth={currentMonth}
                  fromMonth={fromById[b.id] || currentMonth}
                  onFromMonth={(m) => setFromById((prev) => ({ ...prev, [b.id]: m }))}
                  showFrom={b.amount_mode === "fixed"}
                />
              )}
            </div>
          ))
        )}
      </UiGenerationReveal>

      <DialogFooter className="pt-2 border-t border-border/50">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        {bills.length > 0 && (
          <Button type="button" size="sm" onClick={handleSaveBatch} disabled={isPending}>
            {isPending && <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />}
            Salvar &amp; Gerar no Mês
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

// Resumo curto do período, mostrado sob o nome ("até dez/2026", "pulada neste mês").
function scheduleNote(b: RecurringBill, month: string): string | null {
  const parts: string[] = [];
  if (b.start_month && b.start_month > month) parts.push("começa em " + formatMonthShortYear(b.start_month));
  if (b.end_month) parts.push((b.end_month < month ? "terminou em " : "até ") + formatMonthShortYear(b.end_month));
  if (b.skipped_months.includes(month)) parts.push("pulada neste mês");
  return parts.length ? parts.join(", ") : null;
}

// Linha extra de cada item: quando começa/termina, a partir de que mês o valor novo vale e pular o mês.
function ScheduleDetails({
  bill,
  currentMonth,
  fromMonth,
  onFromMonth,
  showFrom,
}: {
  bill: RecurringBill;
  currentMonth: string;
  fromMonth: string;
  onFromMonth: (month: string) => void;
  showFrom: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState(bill.start_month ?? "");
  const [end, setEnd] = useState(bill.end_month ?? "");
  const skipped = bill.skipped_months.includes(currentMonth);
  const changes = parseAmountChanges(bill.amount_changes);

  const save = (skippedMonths: string[]) =>
    startTransition(async () => {
      const res = await updateRecurringSchedule({
        id: bill.id,
        month: currentMonth,
        start_month: start || null,
        end_month: end || null,
        skipped_months: skippedMonths,
      });
      if (res.ok) toast.success("Período salvo.");
      else toast.error(res.error);
    });

  const toggleSkip = () =>
    save(skipped ? bill.skipped_months.filter((m) => m !== currentMonth) : [...bill.skipped_months, currentMonth]);

  return (
    <div className="col-span-12 grid gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
      <label className="grid gap-1 text-muted-foreground">
        Começa em
        <Input type="month" value={start} onChange={(e) => setStart(e.target.value)} className="h-7 text-xs" />
      </label>
      <label className="grid gap-1 text-muted-foreground">
        Termina em (vazio = sem fim)
        <Input type="month" value={end} onChange={(e) => setEnd(e.target.value)} className="h-7 text-xs" />
      </label>
      {showFrom && (
        <label className="grid gap-1 text-muted-foreground sm:col-span-2">
          Se você mudar o valor acima, ele vale a partir de
          <Input type="month" value={fromMonth} onChange={(e) => onFromMonth(e.target.value)} className="h-7 text-xs sm:max-w-44" />
        </label>
      )}
      {changes.length > 0 && (
        <ul className="text-muted-foreground sm:col-span-2">
          {changes.map((c) => (
            <li key={c.from}>
              Desde {formatMonthShortYear(c.from)}: <span className="font-mono text-foreground">{centsToInput(c.amount_cents)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={isPending} onClick={toggleSkip}>
          {skipped ? "Voltar a vencer neste mês" : "Pular este mês"}
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs" disabled={isPending} onClick={() => save(bill.skipped_months)}>
          Salvar período
        </Button>
      </div>
    </div>
  );
}
