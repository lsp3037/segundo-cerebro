"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteBudget, upsertBudget } from "@/lib/actions/finance-family";
import type { FinanceCategory } from "@/lib/data/finance";
import type { BudgetRow } from "@/lib/data/finance-family";
import { budgetLevel } from "@/lib/finance/household";
import { centsToInput, formatCentsToBrl, inputToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BudgetsViewProps {
  budgets: BudgetRow[];
  categories: FinanceCategory[];
}

export function BudgetsView({ budgets, categories }: BudgetsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState("");
  const [amountStr, setAmountStr] = useState("");

  const personalExpenseCats = categories.filter((c) => c.ledger === "pessoal" && c.kind === "expense");
  const totalBudget = budgets.reduce((acc, b) => acc + (b.budgetCents ?? 0), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spentCents, 0);
  const remaining = totalBudget - totalSpent;

  const openModal = (catId?: string, currentCents?: number | null) => {
    setSelectedCatId(catId ?? personalExpenseCats[0]?.id ?? "");
    setAmountStr(currentCents ? centsToInput(currentCents) : "");
    setDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = inputToCents(amountStr);
    if (!selectedCatId || cents <= 0) {
      toast.error("Escolha uma categoria e informe uma meta maior que R$ 0,00.");
      return;
    }
    startTransition(async () => {
      const res = await upsertBudget({ category_id: selectedCatId, amount_cents: cents });
      if (res.ok) {
        toast.success("Meta salva!");
        setDialogOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRemove = (catId: string) => {
    startTransition(async () => {
      const res = await deleteBudget(catId);
      if (res.ok) toast.success("Meta removida.");
      else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="text-xs font-medium text-muted-foreground">Teto Mensal Planejado</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
            {formatCentsToBrl(totalBudget)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Soma das metas definidas</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="text-xs font-medium text-muted-foreground">Realizado + Pendente no Mês</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-400">
            {formatCentsToBrl(totalSpent)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% do teto consumido` : "Defina tetos abaixo"}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="text-xs font-medium text-muted-foreground">Margem Restante</div>
          <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${remaining >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCentsToBrl(remaining)}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Diferença Planejado × Real</span>
            <Button size="sm" variant="outline" onClick={() => openModal()} className="h-6 gap-1 px-2 text-[11px]">
              <PlusIcon className="size-3" />
              Definir Meta
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
        {budgets.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            Nenhuma categoria com meta ou gasto neste mês. Clique em <strong>Definir Meta</strong> acima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-3">Categoria da Casa</th>
                  <th className="px-3 py-2.5 text-right">Planejado (Meta)</th>
                  <th className="px-3 py-2.5 text-right">Realizado</th>
                  <th className="px-3 py-2.5 text-right">Diferença</th>
                  <th className="px-3 py-2.5 w-56">Consumo da Meta</th>
                  <th className="py-2.5 pl-2 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {budgets.map((row) => {
                  const hasBudget = row.budgetCents !== null && row.budgetCents > 0;
                  const diff = hasBudget ? row.budgetCents! - row.spentCents : 0;
                  const pct = hasBudget ? Math.round((row.spentCents / row.budgetCents!) * 1000) / 10 : 0;
                  const level = hasBudget ? budgetLevel(row.spentCents, row.budgetCents!) : "ok";
                  const barColor = level === "over" ? "#f43f5e" : level === "warning" ? "#f59e0b" : "#10b981";

                  return (
                    <tr key={row.categoryId} className="hover:bg-muted/20">
                      <td className="py-3 pl-4 pr-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: row.color || "#94a3b8" }} />
                          <span>{row.categoryName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {hasBudget ? formatCentsToBrl(row.budgetCents) : <span className="text-muted-foreground">Sem meta</span>}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold tabular-nums ${level === "over" ? "text-rose-400" : "text-foreground"}`}>
                        {formatCentsToBrl(row.spentCents)}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono tabular-nums ${!hasBudget ? "text-muted-foreground" : diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {hasBudget ? `${diff >= 0 ? "+ " : ""}${formatCentsToBrl(diff)}` : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {hasBudget ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className={level === "over" ? "text-rose-400 font-semibold" : level === "warning" ? "text-amber-400" : "text-emerald-400"}>
                                {pct}%{level === "over" ? " (Acima)" : ""}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                              <div style={{ width: `${Math.min(100, Math.max(2, pct))}%`, backgroundColor: barColor }} className="h-full rounded-full" />
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => openModal(row.categoryId, row.spentCents)} className="text-[11px] text-primary hover:underline">
                            + Definir teto
                          </button>
                        )}
                      </td>
                      <td className="py-3 pl-2 pr-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => openModal(row.categoryId, row.budgetCents)}>
                            <PencilIcon className="size-3" />
                          </Button>
                          {hasBudget && (
                            <Button variant="ghost" size="sm" className="size-7 p-0 text-rose-400" onClick={() => handleRemove(row.categoryId)}>
                              <Trash2Icon className="size-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Definir Meta Mensal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={selectedCatId} onValueChange={setSelectedCatId}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {personalExpenseCats.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Teto Mensal (R$)</Label>
              <Input value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="1500,00" className="mt-1 font-mono text-sm" required />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isPending}>Salvar Meta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
