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
import type { FinanceCategory, PaymentMethod, Transaction } from "@/lib/data/finance";
import { todayIso } from "@/lib/dates";
import { billStatus } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
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
  paymentMethods: PaymentMethod[];
  initialStatusFilter?: "all" | "pending" | "paid";
  onEditTransaction: (tx: Transaction) => void;
  onNewTransaction: () => void;
}

export function TransactionsTable({
  transactions,
  categories,
  paymentMethods,
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
      {/* Barra de Filtros e Busca (Estilo Linear / Oil UI - sem caixa dentro de caixa) */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por descrição, categoria, peça..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs bg-card/60 border-border/70"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Tipo: Todas, Entradas, Saídas */}
          <div className="inline-flex rounded-lg bg-muted/40 p-0.5 border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setKindFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                kindFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("income")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                kindFilter === "income" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entradas
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("expense")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                kindFilter === "expense" ? "bg-rose-500/20 text-rose-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Saídas
            </button>
          </div>

          {/* Filtro Status: Todos, Pendentes, Pagos */}
          <div className="inline-flex rounded-lg bg-muted/40 p-0.5 border border-border/60 text-xs">
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
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  statusFilter === opt.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filtro por Categoria */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-40 text-xs bg-card/60 border-border/70">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todas as Categorias
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

      {/* Tabela de Lançamentos */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-sm backdrop-blur-sm">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30 text-muted-foreground">
              <SearchIcon className="size-6" />
            </div>
            <h4 className="mt-4 text-sm font-semibold text-foreground">Nenhum lançamento encontrado</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Não há transações correspondentes aos filtros aplicados neste período.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={onNewTransaction}
              className="mt-4 gap-1.5 text-xs"
            >
              <PlusIcon className="size-3.5" />
              Novo Lançamento
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-2">Status</th>
                  <th className="px-3 py-2.5">Data / Venc.</th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="px-3 py-2.5">Categoria</th>
                  <th className="px-3 py-2.5">Pessoa / Origem</th>
                  <th className="px-3 py-2.5">Conta / Pagamento</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="py-2.5 pl-2 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
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
                      className={`group transition-colors hover:bg-muted/30 ${
                        st === "overdue" ? "bg-rose-950/10" : st === "pending" ? "bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Status (Baixa em 1 clique) */}
                      <td className="py-3 pl-4 pr-2 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleTogglePaid(tx)}
                          title={st === "paid" ? "Clique para reabrir como pendente" : "Clique para dar baixa (pagar)"}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            st === "paid"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              : st === "overdue"
                                ? "border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-emerald-500/20 hover:text-emerald-300"
                                : "border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-emerald-500/20 hover:text-emerald-300"
                          }`}
                        >
                          <CheckIcon className="size-3" />
                          {st === "paid" ? "Pago" : st === "overdue" ? "Atrasado" : "Pendente"}
                        </button>
                      </td>

                      {/* Data / Vencimento */}
                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Descrição e Notebook Vinculado */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
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

                      {/* Categoria */}
                      <td className="px-3 py-3 whitespace-nowrap">
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

                      {/* Pessoa / Origem */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {tx.member_label && (
                            <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                              {tx.member_label}
                            </span>
                          )}
                          {ledgerConfig && (
                            <span
                              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ledgerConfig.className}`}
                            >
                              {ledgerConfig.label}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Conta / Pagamento */}
                      <td className="px-3 py-3 whitespace-nowrap">
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

                      {/* Valor Formatado */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-semibold tabular-nums text-sm ${
                            isIncome ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"} {formatCentsToBrl(tx.amount_cents)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
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
                              className="gap-2 cursor-pointer"
                            >
                              <PencilIcon className="size-3.5" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(tx.id, tx.description)}
                              className="gap-2 text-rose-400 focus:text-rose-400 cursor-pointer"
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
        )}
      </div>
    </div>
  );
}
