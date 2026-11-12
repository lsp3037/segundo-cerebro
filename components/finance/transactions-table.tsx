"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckIcon,
  LaptopIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { trashTransaction } from "@/lib/actions/finance";
import { toggleTransactionPaid } from "@/lib/actions/finance-family";
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
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const today = todayIso();

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

  const handleTogglePaid = (tx: Transaction) => {
    startTransition(async () => {
      const res = await toggleTransactionPaid(tx.id);
      if (res.ok) {
        toast.success(res.data.status === "paid" ? `"${tx.description}" pago!` : `"${tx.description}" reaberto.`);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (id: string, description: string) => {
    if (!confirm(`Deseja enviar o lançamento "${description}" para a lixeira?`)) return;

    startTransition(async () => {
      const res = await trashTransaction(id);
      if (res.ok) {
        toast.success("Lançamento excluído.");
      } else {
        toast.error(res.error);
      }
    });
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
                const st = billStatus({ status: tx.status ?? "paid", due_date: tx.due_date ?? null }, today);
                const displayDate = tx.due_date || tx.date;
                const [, m, d] = displayDate.split("-");
                const formattedDate = `${d}/${m}`;

                return (
                  <div
                    key={tx.id}
                    className={`space-y-2 px-3.5 py-3 text-xs ${
                      st === "overdue" ? "bg-rose-950/15" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate font-medium text-foreground">
                          {tx.description}
                        </div>
                        {tx.notebook && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-cyan-400">
                            <LaptopIcon className="size-3" />
                            <span>
                              {tx.notebook.brand ? `${tx.notebook.brand} ` : ""}
                              {tx.notebook.model}
                            </span>
                          </div>
                        )}
                      </button>

                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          isIncome ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isIncome ? "+" : "-"} {formatCentsToBrl(tx.amount_cents)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{formattedDate}</span>
                        {tx.category && <span>· {tx.category.name}</span>}
                        {tx.member_label && <span>· {tx.member_label}</span>}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleTogglePaid(tx)}
                          className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            st === "paid"
                              ? "border-border bg-muted/40 text-muted-foreground"
                              : st === "overdue"
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                                : "border-amber-500/35 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          <CheckIcon className="size-3" />
                          {st === "paid" ? "Pago" : st === "overdue" ? "Atrasado" : "Pagar"}
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVerticalIcon className="size-3.5" />
                              <span className="sr-only">Opções</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem onClick={() => onEditTransaction(tx)} className="cursor-pointer gap-2">
                              <PencilIcon className="size-3.5" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(tx.id, tx.description)}
                              className="cursor-pointer gap-2 text-rose-400 focus:text-rose-400"
                            >
                              <Trash2Icon className="size-3.5" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop (>= md): tabela completa */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/20 text-[11px] font-medium text-muted-foreground">
                    <th className="py-2.5 pl-4 pr-2">Status</th>
                    <th className="px-3 py-2.5">Data / venc.</th>
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
                    const st = billStatus({ status: tx.status ?? "paid", due_date: tx.due_date ?? null }, today);

                    const displayDate = tx.due_date || tx.date;
                    const [, m, d] = displayDate.split("-");
                    const formattedDate = `${d}/${m}`;

                    return (
                      <tr
                        key={tx.id}
                        className={`group transition-colors hover:bg-muted/20 ${
                          st === "overdue" ? "bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleTogglePaid(tx)}
                            title={st === "paid" ? "Clique para reabrir como pendente" : "Clique para dar baixa (pagar)"}
                            className={`inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              st === "paid"
                                ? "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                                : st === "overdue"
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-emerald-500/15 hover:text-emerald-300"
                                  : "border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-emerald-500/15 hover:text-emerald-300"
                            }`}
                          >
                            <CheckIcon className="size-3" />
                            {st === "paid" ? "Pago" : st === "overdue" ? "Atrasado" : "Pendente"}
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-[11px] tabular-nums text-muted-foreground">
                          {formattedDate}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {tx.description}
                            </span>
                            {tx.notebook && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-cyan-400">
                                <LaptopIcon className="size-3" />
                                {tx.notebook.brand ? `${tx.notebook.brand} ` : ""}
                                {tx.notebook.model}
                              </span>
                            )}
                            {tx.notes && (
                              <span className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                                {tx.notes}
                              </span>
                            )}
                          </div>
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
                              <span className="inline-flex items-center rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                                {tx.member_label}
                              </span>
                            )}
                            {ledgerConfig && (
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${ledgerConfig.className}`}
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
                                <span className="sr-only">Opções</span>
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
                                onClick={() => handleDelete(tx.id, tx.description)}
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
