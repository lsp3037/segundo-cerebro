"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  LaptopIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { trashTransaction } from "@/lib/actions/finance";
import type { FinanceCategory, PaymentMethod, Transaction } from "@/lib/data/finance";
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
  onEditTransaction: (tx: Transaction) => void;
  onNewTransaction: () => void;
}

export function TransactionsTable({
  transactions,
  categories,
  paymentMethods,
  onEditTransaction,
  onNewTransaction,
}: TransactionsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchDesc = t.description.toLowerCase().includes(query);
        const matchNotes = t.notes?.toLowerCase().includes(query) ?? false;
        const matchCategory = t.category?.name.toLowerCase().includes(query) ?? false;
        const matchNotebook = t.notebook?.model.toLowerCase().includes(query) ?? false;
        if (!matchDesc && !matchNotes && !matchCategory && !matchNotebook) return false;
      }
      return true;
    });
  }, [transactions, kindFilter, categoryFilter, search]);

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
                  <th className="py-2.5 pl-4 pr-2">Data</th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="px-3 py-2.5">Categoria</th>
                  <th className="px-3 py-2.5">Origem</th>
                  <th className="px-3 py-2.5">Pagamento</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="py-2.5 pl-2 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.kind === "income";
                  const ledgerConfig = LEDGER_BADGES[tx.ledger as "pessoal" | "trustcare"];
                  const MethodIcon = getPaymentMethodIcon(tx.payment_method?.type);

                  // Formata data YYYY-MM-DD para DD/MM
                  const [y, m, d] = tx.date.split("-");
                  const formattedDate = `${d}/${m}`;

                  return (
                    <tr
                      key={tx.id}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      {/* Data */}
                      <td className="py-3 pl-4 pr-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
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

                      {/* Origem (Pessoal vs Trust Care) */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {ledgerConfig && (
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ledgerConfig.className}`}
                          >
                            {ledgerConfig.label}
                          </span>
                        )}
                      </td>

                      {/* Pagamento */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {tx.payment_method ? (
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
