"use client";

import { useMemo, useState, useTransition } from "react";
import {
  LaptopIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { trashTransaction } from "@/lib/actions/finance";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { FinanceCategory, Transaction } from "@/lib/data/finance";
import { todayIso } from "@/lib/dates";
import { billStatus } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPaymentMethodIcon, LEDGER_BADGES } from "./meta";
import { PayCheck, toastWithUndo, usePayToggle } from "./pay-toggle";

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: FinanceCategory[];
  initialStatusFilter?: "all" | "pending" | "paid";
  onEditTransaction: (tx: Transaction) => void;
  onNewTransaction: () => void;
}

export function TransactionsTable({
  transactions,
  categories,
  initialStatusFilter = "all",
  onEditTransaction,
  onNewTransaction,
}: TransactionsTableProps) {
  const [, startTransition] = useTransition();
  const { isPaid, toggle } = usePayToggle();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const today = todayIso();
  // O selo Pessoal / Trust Care só ajuda quando a lista mistura os dois (Pessoal + Trust Care).
  const mixedLedgers = new Set(transactions.map((t) => t.ledger)).size > 1;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (statusFilter === "pending" && t.status === "paid") return false;
      if (statusFilter === "paid" && t.status !== "paid") return false;
      if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchDesc = t.description.toLowerCase().includes(query);
        const matchNotes = t.notes?.toLowerCase().includes(query) ?? false;
        const matchCategory = t.category?.name.toLowerCase().includes(query) ?? false;
        const matchNotebook = t.notebook?.model.toLowerCase().includes(query) ?? false;
        const matchMember = t.member_label?.toLowerCase().includes(query) ?? false;
        if (!matchDesc && !matchNotes && !matchCategory && !matchNotebook && !matchMember) return false;
      }
      return true;
    });
  }, [transactions, kindFilter, statusFilter, categoryFilter, search]);

  const handleDelete = (tx: Transaction) => {
    startTransition(async () => {
      const res = await trashTransaction(tx.id);
      if (res.ok) {
        toastWithUndo(`${tx.description} foi para a lixeira.`, () => restoreFinanceItem("transaction", tx.id));
      } else {
        toast.error(res.error);
      }
    });
  };

  // Texto de situação: diz o estado, sem parecer botão. Quem dá baixa é a bolinha.
  const statusText = (tx: Transaction, paid: boolean, overdue: boolean, date: string) => {
    const isIncome = tx.kind === "income";
    if (paid) return { text: isIncome ? `recebido ${date}` : `pago ${date}`, className: "text-muted-foreground" };
    if (!tx.due_date) return { text: isIncome ? "a receber" : "a pagar", className: "text-amber-400" };
    if (overdue) return { text: isIncome ? `atrasado desde ${date}` : `venceu ${date}`, className: "text-rose-400" };
    return { text: isIncome ? `a receber ${date}` : `vence ${date}`, className: "text-amber-400" };
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por descrição, categoria, peça..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-border bg-card pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Tipo */}
          <div className="inline-flex h-8 items-center rounded-md border border-border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setKindFilter("all")}
              className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
                kindFilter === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("income")}
              className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
                kindFilter === "income" ? "bg-emerald-500/15 text-emerald-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entradas
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("expense")}
              className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
                kindFilter === "expense" ? "bg-rose-500/15 text-rose-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Saídas
            </button>
          </div>

          {/* Filtro Status */}
          <div className="inline-flex h-8 items-center rounded-md border border-border bg-card p-0.5 text-xs">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "pending", label: "Pendentes" },
                { id: "paid", label: "Pagos" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
                  statusFilter === opt.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filtro por Categoria */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40 border-border bg-card text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todas as categorias
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista / Tabela de Lançamentos */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <SearchIcon className="size-6 text-muted-foreground" />
            <h4 className="mt-3 text-sm font-medium text-foreground">Nenhum lançamento encontrado</h4>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Não há transações correspondentes aos filtros aplicados neste período.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewTransaction}
              className="mt-4 gap-1.5 text-xs"
            >
              <PlusIcon className="size-3.5" />
              Novo lançamento
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile (< md): linhas compactas em 2 linhas, sem scroll horizontal */}
            <div className="divide-y divide-border/60 md:hidden">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.kind === "income";
                const paid = isPaid(tx);
                const st = billStatus({ status: paid ? "paid" : "pending", due_date: tx.due_date ?? null }, today);
                const displayDate = (paid ? tx.paid_at : null) || tx.due_date || tx.date;
                const [, m, d] = displayDate.split("-");
                const status = statusText(tx, paid, st === "overdue", `${d}/${m}`);

                return (
                  <div
                    key={tx.id}
                    className={`flex items-start gap-1.5 py-2 pl-1.5 pr-1 text-xs ${
                      st === "overdue" ? "bg-rose-950/15" : ""
                    }`}
                  >
                    <PayCheck paid={paid} income={isIncome} label={tx.description} onToggle={() => toggle(tx)} />

                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="min-w-0 flex-1 cursor-pointer py-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`truncate font-medium ${paid ? "text-muted-foreground" : "text-foreground"}`}>
                          {tx.description}
                        </span>
                        <span
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            isIncome ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"} {formatCentsToBrl(tx.amount_cents)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                        <span className={`tabular-nums ${status.className}`}>{status.text}</span>
                        {tx.category && <span>· {tx.category.name}</span>}
                        {tx.member_label && <span>· {tx.member_label}</span>}
                      </div>
                      {tx.notebook && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-cyan-400">
                          <LaptopIcon className="size-3" />
                          <span>
                            {tx.notebook.brand ? `${tx.notebook.brand} ` : ""}
                            {tx.notebook.model}
                          </span>
                        </div>
                      )}
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVerticalIcon className="size-3.5" />
                          <span className="sr-only">Opções de {tx.description}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => onEditTransaction(tx)} className="cursor-pointer gap-2">
                          <PencilIcon className="size-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(tx)}
                          className="cursor-pointer gap-2 text-rose-400 focus:text-rose-400"
                        >
                          <Trash2Icon className="size-3.5" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>

            {/* Desktop (>= md): tabela completa */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/20 text-xs font-medium text-muted-foreground">
                    <th className="w-10 py-2.5 pl-2.5 pr-0"><span className="sr-only">Pago</span></th>
                    <th className="px-3 py-2.5">Situação</th>
                    <th className="px-3 py-2.5">Descrição</th>
                    <th className="px-3 py-2.5">Categoria</th>
                    <th className="px-3 py-2.5">Pessoa / origem</th>
                    <th className="px-3 py-2.5">Pagamento</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="py-2.5 pl-2 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.kind === "income";
                    const ledgerConfig = LEDGER_BADGES[tx.ledger as "pessoal" | "trustcare"];
                    const MethodIcon = getPaymentMethodIcon(tx.payment_method?.type);
                    const paid = isPaid(tx);
                    const st = billStatus({ status: paid ? "paid" : "pending", due_date: tx.due_date ?? null }, today);

                    const displayDate = (paid ? tx.paid_at : null) || tx.due_date || tx.date;
                    const [, m, d] = displayDate.split("-");
                    const status = statusText(tx, paid, st === "overdue", `${d}/${m}`);

                    return (
                      <tr
                        key={tx.id}
                        className={`group transition-colors hover:bg-muted/20 ${
                          st === "overdue" ? "bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="py-1.5 pl-2.5 pr-0">
                          <PayCheck paid={paid} income={isIncome} label={tx.description} onToggle={() => toggle(tx)} />
                        </td>

                        <td className={`whitespace-nowrap px-3 py-3 text-xs tabular-nums ${status.className}`}>
                          {status.text}
                        </td>

                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="flex cursor-pointer flex-col text-left"
                          >
                            <span className={`font-medium hover:underline ${paid ? "text-muted-foreground" : "text-foreground"}`}>
                              {tx.description}
                            </span>
                            {tx.notebook && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-cyan-400">
                                <LaptopIcon className="size-3" />
                                {tx.notebook.brand ? `${tx.notebook.brand} ` : ""}
                                {tx.notebook.model}
                              </span>
                            )}
                            {tx.notes && (
                              <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {tx.notes}
                              </span>
                            )}
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          {tx.category ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: tx.category.color || "#94a3b8" }}
                              />
                              <span className="text-muted-foreground">{tx.category.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {tx.member_label && (
                              <span className="inline-flex items-center rounded border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-foreground">
                                {tx.member_label}
                              </span>
                            )}
                            {mixedLedgers && ledgerConfig && (
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${ledgerConfig.className}`}
                              >
                                {ledgerConfig.label}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          {tx.account ? (
                            <span className="text-muted-foreground">{tx.account.name}</span>
                          ) : tx.payment_method ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MethodIcon className="size-3.5 text-muted-foreground" />
                              <span>{tx.payment_method.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <span
                            className={`text-sm font-medium tabular-nums ${
                              isIncome ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isIncome ? "+" : "-"} {formatCentsToBrl(tx.amount_cents)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <MoreVerticalIcon className="size-3.5" />
                                <span className="sr-only">Opções de {tx.description}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem
                                onClick={() => onEditTransaction(tx)}
                                className="cursor-pointer gap-2"
                              >
                                <PencilIcon className="size-3.5" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(tx)}
                                className="cursor-pointer gap-2 text-rose-400 focus:text-rose-400"
                              >
                                <Trash2Icon className="size-3.5" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    </div>
  );
}
