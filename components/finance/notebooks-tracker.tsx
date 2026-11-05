"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CoinsIcon,
  LaptopIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { trashNotebook, updateNotebook } from "@/lib/actions/finance";
import type { FinanceCategory, Notebook, PaymentMethod } from "@/lib/data/finance";
import { formatCentsToBrl, formatProfitMargin } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NOTEBOOK_STATUS_CONFIG, type NotebookStatus } from "./meta";

interface NotebooksTrackerProps {
  notebooks: Notebook[];
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  onNewNotebook: () => void;
  onEditNotebook: (nb: Notebook) => void;
  onAddCostToNotebook: (nb: Notebook) => void;
  onRecordSale: (nb: Notebook) => void;
}

export function NotebooksTracker({
  notebooks,
  categories,
  paymentMethods,
  onNewNotebook,
  onEditNotebook,
  onAddCostToNotebook,
  onRecordSale,
}: NotebooksTrackerProps) {
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<NotebookStatus | "all">("all");
  const [search, setSearch] = useState("");

  // Métricas consolidadas dos notebooks
  const stats = useMemo(() => {
    let inStockCount = 0;
    let capitalInvestedInStockCents = 0;
    let totalRealizedProfitCents = 0;
    let totalSoldIncomeCents = 0;

    for (const nb of notebooks) {
      const expenses = nb.expense_cents ?? 0;
      const income = nb.income_cents ?? 0;
      const profit = nb.profit_cents ?? 0;

      if (nb.status === "sold") {
        totalRealizedProfitCents += profit;
        totalSoldIncomeCents += income;
      } else {
        inStockCount += 1;
        capitalInvestedInStockCents += expenses;
      }
    }

    const marginStr = formatProfitMargin(totalRealizedProfitCents, totalSoldIncomeCents);

    return {
      inStockCount,
      capitalInvestedInStockCents,
      totalRealizedProfitCents,
      marginStr,
    };
  }, [notebooks]);

  // Filtra notebooks
  const filteredNotebooks = useMemo(() => {
    return notebooks.filter((nb) => {
      if (statusFilter !== "all" && nb.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchModel = nb.model.toLowerCase().includes(q);
        const matchBrand = nb.brand?.toLowerCase().includes(q) ?? false;
        const matchSpecs = nb.specs?.toLowerCase().includes(q) ?? false;
        const matchNotes = nb.notes?.toLowerCase().includes(q) ?? false;
        if (!matchModel && !matchBrand && !matchSpecs && !matchNotes) return false;
      }
      return true;
    });
  }, [notebooks, statusFilter, search]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Deseja enviar o notebook "${name}" para a lixeira?`)) return;

    startTransition(async () => {
      const res = await trashNotebook(id);
      if (res.ok) {
        toast.success("Notebook removido.");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleQuickStatusChange = (nb: Notebook, newStatus: NotebookStatus) => {
    startTransition(async () => {
      const res = await updateNotebook(nb.id, { status: newStatus });
      if (res.ok) {
        toast.success(`Status alterado para "${NOTEBOOK_STATUS_CONFIG[newStatus].label}".`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 4 Mini KPIs específicos de Revenda */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Aparelhos no Estoque</span>
            <LaptopIcon className="size-4 text-cyan-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {stats.inStockCount}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Aguardando reparo ou à venda</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Capital Preso em Estoque</span>
            <CoinsIcon className="size-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-amber-400 tabular-nums">
            {formatCentsToBrl(stats.capitalInvestedInStockCents)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Custo de compra + peças instaladas</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Lucro Líquido Realizado</span>
            <ArrowUpRightIcon className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
            {formatCentsToBrl(stats.totalRealizedProfitCents)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Soma de lucro nos aparelhos vendidos</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Margem Média na Venda</span>
            <CheckCircle2Icon className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-primary tabular-nums">
            {stats.marginStr}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Retorno médio sobre faturamento</p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por marca, modelo, peças..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs bg-card/60 border-border/70"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            }`}
          >
            Todos ({notebooks.length})
          </button>
          {(Object.keys(NOTEBOOK_STATUS_CONFIG) as NotebookStatus[]).map((st) => {
            const conf = NOTEBOOK_STATUS_CONFIG[st];
            const count = notebooks.filter((n) => n.status === st).length;
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <span className={`size-1.5 rounded-full ${conf.dotClass}`} />
                {conf.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Cards de Notebooks */}
      {filteredNotebooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/70 bg-card/60 p-12 text-center backdrop-blur-sm">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30 text-muted-foreground">
            <LaptopIcon className="size-6" />
          </div>
          <h4 className="mt-4 text-sm font-semibold text-foreground">Nenhum notebook encontrado</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Cadastre os aparelhos que você compra para consertar, fazer upgrade e revender na Trust Care.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={onNewNotebook}
            className="mt-4 gap-1.5 text-xs"
          >
            <PlusIcon className="size-3.5" />
            Cadastrar Notebook
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotebooks.map((nb) => {
            const statusConfig =
              NOTEBOOK_STATUS_CONFIG[nb.status as NotebookStatus] ?? NOTEBOOK_STATUS_CONFIG.bought;
            const isSold = nb.status === "sold";
            const expenses = nb.expense_cents ?? 0;
            const income = nb.income_cents ?? 0;
            const profit = nb.profit_cents ?? 0;
            const margin = formatProfitMargin(profit, income);

            return (
              <div
                key={nb.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-cyan-500/40"
              >
                <div>
                  {/* Topo do Card: Marca, Modelo e Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {nb.brand && (
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {nb.brand}
                        </span>
                      )}
                      <h4 className="font-semibold text-sm text-foreground group-hover:text-cyan-400 transition-colors">
                        {nb.model}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${statusConfig.badgeClass}`}
                      >
                        <span className={`size-1.5 rounded-full ${statusConfig.dotClass}`} />
                        {statusConfig.label}
                      </span>

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
                            onClick={() => onEditNotebook(nb)}
                            className="gap-2 cursor-pointer"
                          >
                            <PencilIcon className="size-3.5" />
                            Editar Dados
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onAddCostToNotebook(nb)}
                            className="gap-2 cursor-pointer"
                          >
                            <WrenchIcon className="size-3.5 text-amber-400" />
                            Lançar Custo / Peça
                          </DropdownMenuItem>
                          {!isSold && (
                            <DropdownMenuItem
                              onClick={() => onRecordSale(nb)}
                              className="gap-2 cursor-pointer text-emerald-400 focus:text-emerald-400"
                            >
                              <ShoppingBagIcon className="size-3.5" />
                              Registrar Venda
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {/* Troca Rápida de Status */}
                          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                            Mudar Status
                          </div>
                          {(Object.keys(NOTEBOOK_STATUS_CONFIG) as NotebookStatus[]).map((st) => (
                            <DropdownMenuItem
                              key={st}
                              onClick={() => handleQuickStatusChange(nb, st)}
                              disabled={nb.status === st}
                              className="text-xs cursor-pointer"
                            >
                              {NOTEBOOK_STATUS_CONFIG[st].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(nb.id, `${nb.brand ?? ""} ${nb.model}`)}
                            className="gap-2 text-rose-400 focus:text-rose-400 cursor-pointer"
                          >
                            <Trash2Icon className="size-3.5" />
                            Excluir Aparelho
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Especificações Técnicas */}
                  {nb.specs && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {nb.specs}
                    </p>
                  )}

                  {/* Notas / Observações */}
                  {nb.notes && (
                    <div className="mt-2 rounded-md bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground/80 line-clamp-2">
                      {nb.notes}
                    </div>
                  )}
                </div>

                {/* Bloco de Economia Unitária (Unit Economics) */}
                <div className="mt-4 border-t border-border/50 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-muted-foreground">Custo Total:</span>
                      <div className="font-mono font-medium text-rose-400 tabular-nums">
                        {formatCentsToBrl(expenses)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground">
                        {isSold ? "Vendido por:" : "Receita Vinculada:"}
                      </span>
                      <div className="font-mono font-medium text-foreground tabular-nums">
                        {income > 0 ? formatCentsToBrl(income) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Resultado: Lucro e Margem */}
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {isSold ? "Lucro Realizado:" : "Resultado Atual:"}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums">
                      <span className={profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {formatCentsToBrl(profit)}
                      </span>
                      {income > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({margin})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botões de Ação Direta no Card */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddCostToNotebook(nb)}
                      className="h-7 flex-1 text-[11px] gap-1"
                    >
                      <PlusIcon className="size-3" />
                      Add Custo
                    </Button>
                    {!isSold ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onRecordSale(nb)}
                        className="h-7 flex-1 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <ShoppingBagIcon className="size-3" />
                        Vender
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onEditNotebook(nb)}
                        className="h-7 flex-1 text-[11px] gap-1"
                      >
                        <PencilIcon className="size-3" />
                        Detalhes
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
