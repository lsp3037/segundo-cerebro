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
import { FinanceKpiStrip } from "./finance-hierarchy";
import { toastWithUndo } from "./pay-toggle";

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
      toast.error("Escolha uma categoria e informe um limite maior que R$ 0,00.");
      return;
    }
    startTransition(async () => {
      const res = await upsertBudget({ category_id: selectedCatId, amount_cents: cents });
      if (res.ok) {
        toast.success("Limite salvo!");
        setDialogOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRemove = (row: BudgetRow) => {
    const previousCents = row.budgetCents;
    startTransition(async () => {
      const res = await deleteBudget(row.categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (previousCents && previousCents > 0) {
        toastWithUndo(`Limite de ${row.categoryName} removido.`, () =>
          upsertBudget({ category_id: row.categoryId, amount_cents: previousCents }),
        );
      } else {
        toast.success("Limite removido.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <FinanceKpiStrip
        columns={3}
        items={[
          {
            id: "planned",
            label: "Limite do mês",
            value: formatCentsToBrl(totalBudget),
            subtext: "Soma dos limites por categoria",
          },
          {
            id: "spent",
            label: "Já gasto",
            value: formatCentsToBrl(totalSpent),
            tone: totalBudget > 0 && totalSpent > totalBudget ? "negative" : totalSpent > 0 ? "warning" : "default",
            subtext:
              totalBudget > 0
                ? `${Math.round((totalSpent / totalBudget) * 100)}% do limite, contando o que falta pagar`
                : "Defina limites abaixo",
          },
          {
            id: "remaining",
            label: "Ainda pode gastar",
            value: formatCentsToBrl(remaining),
            tone: remaining >= 0 ? "positive" : "negative",
            subtext: "Limite menos o que já foi gasto",
          },
        ]}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Limites por categoria</h3>
            <p className="text-xs text-muted-foreground">Quanto já foi gasto de cada limite</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => openModal()} className="h-8 gap-1.5 text-xs">
            <PlusIcon className="size-3.5" />
            Definir limite
          </Button>
        </div>
        {budgets.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            Nenhuma categoria com limite ou gasto neste mês. Use <strong>Definir limite</strong> acima.
          </div>
        ) : (
          <>
            {/* Mobile (< md): linhas compactas sem overflow horizontal */}
            <div className="divide-y divide-border/60 md:hidden">
              {budgets.map((row) => {
                const hasBudget = row.budgetCents !== null && row.budgetCents > 0;
                const pct = hasBudget ? Math.round((row.spentCents / row.budgetCents!) * 1000) / 10 : 0;
                const level = hasBudget ? budgetLevel(row.spentCents, row.budgetCents!) : "ok";
                const barColor = level === "over" ? "#f43f5e" : level === "warning" ? "#f59e0b" : "#10b981";
                const barWidth = pct > 0 ? Math.min(100, Math.max(2, pct)) : 0;

                return (
                  <div key={row.categoryId} className="space-y-2 px-3.5 py-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color || "#94a3b8" }} />
                        <span className="truncate">{row.categoryName}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar limite de ${row.categoryName}`}
                          onClick={() => openModal(row.categoryId, row.budgetCents)}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        {hasBudget && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-rose-400"
                            aria-label={`Remover limite de ${row.categoryName}`}
                            onClick={() => handleRemove(row)}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between text-xs tabular-nums">
                      <span className={level === "over" ? "font-medium text-rose-400" : "text-foreground"}>
                        {formatCentsToBrl(row.spentCents)}
                      </span>
                      <span className="text-muted-foreground">
                        {hasBudget ? `de ${formatCentsToBrl(row.budgetCents)} (${pct}%)` : "Sem limite"}
                      </span>
                    </div>

                    {hasBudget && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                        <div style={{ width: `${barWidth}%`, backgroundColor: barColor }} className="h-full rounded-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/20 text-xs font-medium text-muted-foreground">
                    <th className="py-2.5 pl-4 pr-3">Categoria</th>
                    <th className="px-3 py-2.5 text-right">Limite</th>
                    <th className="px-3 py-2.5 text-right">Gasto</th>
                    <th className="px-3 py-2.5 text-right">Disponível</th>
                    <th className="w-56 px-3 py-2.5">Usado</th>
                    <th className="py-2.5 pl-2 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {budgets.map((row) => {
                    const hasBudget = row.budgetCents !== null && row.budgetCents > 0;
                    const diff = hasBudget ? row.budgetCents! - row.spentCents : 0;
                    const pct = hasBudget ? Math.round((row.spentCents / row.budgetCents!) * 1000) / 10 : 0;
                    const level = hasBudget ? budgetLevel(row.spentCents, row.budgetCents!) : "ok";
                    const barColor = level === "over" ? "#f43f5e" : level === "warning" ? "#f59e0b" : "#10b981";
                    const barWidth = pct > 0 ? Math.min(100, Math.max(2, pct)) : 0;

                    return (
                      <tr key={row.categoryId} className="hover:bg-muted/20">
                        <td className="py-3 pl-4 pr-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ backgroundColor: row.color || "#94a3b8" }} />
                            <span>{row.categoryName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {hasBudget ? formatCentsToBrl(row.budgetCents) : <span className="text-muted-foreground">Sem limite</span>}
                        </td>
                        <td className={`px-3 py-3 text-right font-medium tabular-nums ${level === "over" ? "text-rose-400" : "text-foreground"}`}>
                          {formatCentsToBrl(row.spentCents)}
                        </td>
                        <td className={`px-3 py-3 text-right tabular-nums ${!hasBudget ? "text-muted-foreground" : diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {hasBudget ? `${diff >= 0 ? "+" : ""}${formatCentsToBrl(diff)}` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {hasBudget ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs tabular-nums">
                                <span className={level === "over" ? "font-medium text-rose-400" : level === "warning" ? "text-amber-400" : "text-muted-foreground"}>
                                  {pct}%{level === "over" ? " · passou" : ""}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                                <div style={{ width: `${barWidth}%`, backgroundColor: barColor }} className="h-full rounded-full" />
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openModal(row.categoryId, row.spentCents)} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline">
                              + Definir limite
                            </button>
                          )}
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="sm" aria-label={`Editar limite de ${row.categoryName}`} className="size-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openModal(row.categoryId, row.budgetCents)}>
                              <PencilIcon className="size-3" />
                            </Button>
                            {hasBudget && (
                              <Button variant="ghost" size="sm" aria-label={`Remover limite de ${row.categoryName}`} className="size-7 p-0 text-muted-foreground hover:text-rose-400" onClick={() => handleRemove(row)}>
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
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Limite do mês</DialogTitle>
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
              <Label className="text-xs">Limite (R$)</Label>
              <Input value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="1500,00" className="mt-1 font-mono text-sm" required />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isPending}>Salvar limite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
