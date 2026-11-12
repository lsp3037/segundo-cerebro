"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteFinanceAccount, saveFinanceAccount, transferBetweenAccounts } from "@/lib/actions/finance-family";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { AccountWithBalance } from "@/lib/data/finance-family";
import { ACCOUNT_TYPE_LABELS, HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import { centsToInput, formatCentsToBrl, inputToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinanceKpiStrip } from "./finance-hierarchy";
import { toastWithUndo } from "./pay-toggle";

interface AccountsCardsViewProps {
  accounts: AccountWithBalance[];
}

export function AccountsCardsView({ accounts }: AccountsCardsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [type, setType] = useState<"checking" | "savings" | "cash" | "credit_card">("checking");
  const [ownerLabel, setOwnerLabel] = useState("Casa");
  const [openingStr, setOpeningStr] = useState("0,00");
  const [limitStr, setLimitStr] = useState("");
  const [dueDayStr, setDueDayStr] = useState("");

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [transferStr, setTransferStr] = useState("");

  const bankAccounts = accounts.filter((a) => a.type !== "credit_card");
  const creditCards = accounts.filter((a) => a.type === "credit_card");
  const totalBankBalance = bankAccounts.reduce((acc, a) => acc + a.balanceCents, 0);
  const totalCardsMonth = creditCards.reduce((acc, a) => acc + a.monthInvoiceCents, 0);

  const openNew = (presetType: "checking" | "credit_card") => {
    setEditingId(undefined);
    setName("");
    setType(presetType);
    setOwnerLabel("Casa");
    setOpeningStr("0,00");
    setLimitStr("");
    setDueDayStr(presetType === "credit_card" ? "10" : "");
    setDialogOpen(true);
  };

  const openEdit = (acc: AccountWithBalance) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type as "checking" | "savings" | "cash" | "credit_card");
    setOwnerLabel(acc.owner_label ?? "Casa");
    setOpeningStr(centsToInput(acc.opening_balance_cents));
    setLimitStr(acc.credit_limit_cents ? centsToInput(acc.credit_limit_cents) : "");
    setDueDayStr(acc.due_day ? String(acc.due_day) : "");
    setDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const due = dueDayStr.trim() ? Number(dueDayStr) : null;
      const res = await saveFinanceAccount({
        id: editingId,
        name: name.trim(),
        type,
        owner_label: ownerLabel || null,
        opening_balance_cents: inputToCents(openingStr),
        credit_limit_cents: type === "credit_card" && limitStr.trim() ? inputToCents(limitStr) : null,
        due_day: type === "credit_card" && due && due >= 1 && due <= 31 ? due : null,
      });
      if (res.ok) {
        toast.success(editingId ? "Conta atualizada." : "Conta criada!");
        setDialogOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (acc: AccountWithBalance) => {
    startTransition(async () => {
      const res = await deleteFinanceAccount(acc.id);
      if (res.ok) {
        toastWithUndo(`${acc.name} foi removido. Os lançamentos continuam salvos.`, () =>
          restoreFinanceItem("account", acc.id),
        );
      } else toast.error(res.error);
    });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = inputToCents(transferStr);
    if (amount <= 0) {
      toast.error("Informe um valor maior que R$ 0,00.");
      return;
    }
    startTransition(async () => {
      const res = await transferBetweenAccounts({ fromAccountId: fromId, toAccountId: toId, amount_cents: amount });
      if (res.ok) {
        toast.success("Transferência realizada!");
        setTransferOpen(false);
        setTransferStr("");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <FinanceKpiStrip
        columns={2}
        items={[
          {
            id: "bank-balance",
            label: "Saldo em contas bancárias",
            value: formatCentsToBrl(totalBankBalance),
            tone: totalBankBalance >= 0 ? "positive" : "negative",
            badge: (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {bankAccounts.length} {bankAccounts.length === 1 ? "conta" : "contas"}
              </span>
            ),
            subtext: "Saldos reais separados dos cartões",
          },
          {
            id: "cards-month",
            label: "Faturas no mês (cartões)",
            value: formatCentsToBrl(totalCardsMonth),
            tone: totalCardsMonth > 0 ? "negative" : "default",
            badge: (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {creditCards.length} {creditCards.length === 1 ? "cartão" : "cartões"}
              </span>
            ),
            subtext: "Soma das faturas vinculadas no período",
          },
        ]}
      />

      {/* Contas Bancárias & Reserva */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Contas bancárias &amp; reserva
            </h3>
            <p className="text-xs text-muted-foreground">
              Transferências entre contas não contam como despesa
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bankAccounts.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFromId(bankAccounts[0].id);
                  setToId(bankAccounts[1].id);
                  setTransferOpen(true);
                }}
                className="h-8 gap-1.5 text-xs"
              >
                <ArrowRightLeftIcon className="size-3.5" />
                Transferir
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openNew("checking")} className="h-8 gap-1.5 text-xs">
              <PlusIcon className="size-3.5" />
              Nova conta
            </Button>
          </div>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Nenhuma conta bancária ou reserva cadastrada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      {acc.name}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type} · {acc.owner_label ?? "Casa"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(acc)}>
                      <PencilIcon className="size-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-rose-400" onClick={() => handleDelete(acc)}>
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                </div>
                <div className={`mt-3 text-xl font-semibold tabular-nums ${acc.balanceCents >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatCentsToBrl(acc.balanceCents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cartões de Crédito */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Cartões de crédito da casa
            </h3>
            <p className="text-xs text-muted-foreground">Faturas vinculadas no mês selecionado</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openNew("credit_card")} className="h-8 gap-1.5 text-xs">
            <PlusIcon className="size-3.5" />
            Novo cartão
          </Button>
        </div>

        {creditCards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Nenhum cartão cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {creditCards.map((card) => {
              const pct =
                card.credit_limit_cents && card.credit_limit_cents > 0
                  ? Math.min(100, Math.round((card.monthInvoiceCents / card.credit_limit_cents) * 100))
                  : null;
              const barColor = pct === null ? "#10b981" : pct >= 85 ? "#f43f5e" : pct >= 60 ? "#f59e0b" : "#10b981";
              const barWidth = pct !== null && pct > 0 ? Math.max(2, pct) : 0;

              return (
                <div key={card.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {card.name}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Titular: {card.owner_label ?? "Casa"}
                        {card.due_day ? ` · Vence dia ${String(card.due_day).padStart(2, "0")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(card)}>
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-rose-400" onClick={() => handleDelete(card)}>
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Fatura no mês</span>
                    <span className="text-xl font-semibold tabular-nums text-foreground">
                      {formatCentsToBrl(card.monthInvoiceCents)}
                    </span>
                  </div>

                  {pct !== null && (
                    <div className="mt-2.5 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                        <div style={{ width: `${barWidth}%`, backgroundColor: barColor }} className="h-full rounded-full" />
                      </div>
                      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
                        <span>{pct}% usado</span>
                        <span>Limite: {formatCentsToBrl(card.credit_limit_cents)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Conta / Cartão */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editingId ? "Editar Conta / Cartão" : "Nova Conta ou Cartão"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cartão Santander, Nubank, Reserva" className="mt-1 text-sm" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking" className="text-xs">Conta corrente</SelectItem>
                    <SelectItem value="savings" className="text-xs">Reserva / Investimento</SelectItem>
                    <SelectItem value="cash" className="text-xs">Dinheiro</SelectItem>
                    <SelectItem value="credit_card" className="text-xs">Cartão de crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={ownerLabel} onValueChange={setOwnerLabel}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSEHOLD_MEMBERS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {type !== "credit_card" ? (
              <div>
                <Label className="text-xs">Saldo Inicial (R$)</Label>
                <Input value={openingStr} onChange={(e) => setOpeningStr(e.target.value)} className="mt-1 font-mono text-sm" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Dia de Vencimento</Label>
                  <Input type="number" min={1} max={31} value={dueDayStr} onChange={(e) => setDueDayStr(e.target.value)} placeholder="Ex: 5" className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Limite (R$, opcional)</Label>
                  <Input value={limitStr} onChange={(e) => setLimitStr(e.target.value)} placeholder="5000,00" className="mt-1 font-mono text-sm" />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Transferência entre Contas */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Transferir entre Contas</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-3">
            <div>
              <Label className="text-xs">De</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Para</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={transferStr} onChange={(e) => setTransferStr(e.target.value)} placeholder="0,00" className="mt-1 font-mono text-sm" required />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransferOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isPending}>Transferir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
