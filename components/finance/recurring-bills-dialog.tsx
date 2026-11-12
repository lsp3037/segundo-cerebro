"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  bootstrapHouseholdTemplate,
  deleteRecurringBill,
  saveRecurringBill,
  saveRecurringValuesBatch,
} from "@/lib/actions/finance-family";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { FinanceCategory } from "@/lib/data/finance";
import type { AccountWithBalance, RecurringBill } from "@/lib/data/finance-family";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
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
  const formKey = `${props.open}-${props.bills.map((b) => `${b.id}:${b.amount_cents}:${b.due_day}`).join("|")}`;
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
    Object.fromEntries(bills.map((b) => [b.id, b.amount_cents > 0 ? centsToInput(b.amount_cents) : ""])),
  );
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
              <div className="col-span-5 min-w-0">
                <div className="truncate font-medium text-foreground">
                  <span className={b.kind === "income" ? "text-emerald-400" : "text-rose-400"}>
                    {b.kind === "income" ? "+ " : "- "}
                  </span>
                  {b.description}
                </div>
                <div className="text-xs text-muted-foreground">{b.member_label ?? "Casa"}</div>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Dia"
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
              <div className="col-span-1 text-right">
                <Button type="button" variant="ghost" size="sm" className="size-7 p-0 text-rose-400" onClick={() => handleDelete(b.id, b.description)}>
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
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
