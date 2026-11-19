"use client";

import { useMemo, useState, useTransition } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { trashTransaction } from "@/lib/actions/finance";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { FinanceCategory, Transaction } from "@/lib/data/finance";
import { todayIso } from "@/lib/dates";
import { buildTxGroups, monthTotals, statusCounts } from "@/lib/finance/transaction-groups";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionGroupsList } from "./transaction-groups-list";
import { TransactionTotals, type KindFilter } from "./transaction-totals";
import { toastWithUndo, usePayToggle } from "./pay-toggle";

type StatusFilter = "all" | "pending" | "paid";

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: FinanceCategory[];
  // Lançamentos de meses anteriores que continuam em aberto (entram no grupo "Atrasado").
  overdueEarlier: Transaction[];
  initialStatusFilter?: StatusFilter;
  onEditTransaction: (tx: Transaction) => void;
  onNewTransaction: () => void;
}

interface ChoiceOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
}

// Seletor segmentado no computador; no celular vira uma fileira de chips.
function ChoiceGroup<T extends string>({ label, value, options, onChange }: ChoiceGroupProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 gap-2 md:gap-0.5 md:rounded-[9px] md:border md:border-border md:bg-card md:p-[3px]"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] transition-colors md:h-auto md:rounded-md md:border-transparent md:px-[11px] md:py-[5px] md:text-[13px]",
              active
                ? "border-foreground bg-foreground font-semibold text-background md:bg-muted md:font-medium md:text-foreground"
                : "border-border bg-card text-foreground/75 hover:text-foreground md:bg-transparent md:text-muted-foreground",
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn("font-normal tabular-nums", active ? "opacity-60 md:opacity-100 md:text-foreground/75" : "opacity-60")}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const STATUS_LABEL: Record<StatusFilter, string> = {
  pending: "Falta resolver",
  paid: "Já feitos",
  all: "Todos",
};

export function TransactionsTable({
  transactions,
  categories,
  overdueEarlier,
  initialStatusFilter = "all",
  onEditTransaction,
  onNewTransaction,
}: TransactionsTableProps) {
  const [, startTransition] = useTransition();
  const { isPaid, toggle } = usePayToggle();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const today = todayIso();
  // O selo Pessoal / Trust Care só ajuda quando a lista mistura os dois.
  const mixedLedgers = new Set(transactions.map((t) => t.ledger)).size > 1;

  // Filtros de tipo, categoria e busca (o de situação vem depois, para as contagens).
  const matching = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (t: Transaction) => {
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
      if (!query) return true;
      return [t.description, t.notes, t.category?.name, t.notebook?.model, t.member_label].some((field) =>
        field?.toLowerCase().includes(query),
      );
    };
    return { month: transactions.filter(matches), earlier: overdueEarlier.filter(matches) };
  }, [transactions, overdueEarlier, kindFilter, categoryFilter, search]);

  const counts = statusCounts({ transactions: matching.month, overdueEarlier: matching.earlier, isPaid });
  const totals = monthTotals({ transactions, isPaid });

  const byStatus = (t: Transaction) => {
    if (statusFilter === "all") return true;
    return statusFilter === "paid" ? isPaid(t) : !isPaid(t);
  };
  const groups = buildTxGroups({
    transactions: matching.month.filter(byStatus),
    overdueEarlier: matching.earlier.filter(byStatus),
    today,
    isPaid,
  });
  const visibleGroups = [...groups.todo, ...groups.done].filter((g) => g.items.length > 0);

  const filtersActive = search.trim() !== "" || kindFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all";
  const hasAnyData = transactions.length > 0 || overdueEarlier.length > 0;

  const clearFilters = () => {
    setSearch("");
    setKindFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const emptyFilterLabel = () => {
    const parts: string[] = [];
    if (statusFilter !== "all") parts.push(STATUS_LABEL[statusFilter]);
    if (kindFilter !== "all") parts.push(kindFilter === "income" ? "Entradas" : "Saídas");
    const category = categories.find((c) => c.id === categoryFilter);
    if (category) parts.push(category.name);
    if (search.trim()) parts.push(`“${search.trim()}”`);
    return parts.length > 0 ? parts.join(", ") : "Todos";
  };

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

  const toggleKind = (kind: "income" | "expense") => setKindFilter((current) => (current === kind ? "all" : kind));

  return (
    <div className="@container">
      <TransactionTotals totals={totals} kindFilter={kindFilter} onToggleKind={toggleKind} />

      <div className="mb-3.5 flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
        <div className="relative w-full md:max-w-[360px] md:flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar lançamentos"
            placeholder="Buscar por descrição, categoria ou pessoa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[38px] rounded-[9px] border-border bg-card pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] md:flex-1 md:gap-3 md:overflow-visible [&::-webkit-scrollbar]:hidden">
          <ChoiceGroup<StatusFilter>
            label="Situação"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: "pending", label: STATUS_LABEL.pending, count: counts.todo },
              { id: "paid", label: STATUS_LABEL.paid, count: counts.done },
              { id: "all", label: STATUS_LABEL.all, count: counts.all },
            ]}
          />
          <ChoiceGroup<KindFilter>
            label="Tipo"
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { id: "all", label: "Entradas e saídas" },
              { id: "income", label: "Entradas" },
              { id: "expense", label: "Saídas" },
            ]}
          />
          <div className="shrink-0 md:ml-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                aria-label="Categoria"
                className="h-[34px] min-w-40 rounded-full border-border bg-card text-[13.5px] md:h-[38px] md:rounded-[9px] md:text-[13px]"
              >
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[13px]">
                  Todas as categorias
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="flex flex-col items-center justify-center rounded-lg bg-card p-12 text-center">
          <SearchIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <h4 className="mt-3 text-sm font-medium text-foreground">Nenhum lançamento neste mês</h4>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Quando você lançar uma entrada ou uma saída, ela aparece aqui.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onNewTransaction} className="mt-4 gap-1.5 text-[13px]">
            <PlusIcon className="size-3.5" />
            Novo lançamento
          </Button>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg bg-card p-12 text-center">
          <SearchIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <h4 className="mt-3 text-sm font-medium text-foreground">Nada em {emptyFilterLabel()}</h4>
          {filtersActive && (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="mt-4 text-[13px]">
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <TransactionGroupsList
          groups={visibleGroups}
          isPaid={isPaid}
          today={today}
          mixedLedgers={mixedLedgers}
          onEdit={onEditTransaction}
          onToggle={toggle}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
