"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  ClockIcon,
  LaptopIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { trashNotebook, updateNotebook } from "@/lib/actions/finance";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { Notebook } from "@/lib/data/finance";
import { formatCentsToBrl, formatProfitMargin } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FinanceKpiStrip } from "./finance-hierarchy";
import { toastWithUndo } from "./pay-toggle";
import { NOTEBOOK_STATUS_CONFIG, type NotebookStatus } from "./meta";

interface NotebooksTrackerProps {
  notebooks: Notebook[];
  onNewNotebook: () => void;
  onEditNotebook: (nb: Notebook) => void;
  onAddCostToNotebook: (nb: Notebook, defaultDescription?: string) => void;
  onRecordSale: (nb: Notebook) => void;
}

export function NotebooksTracker({
  notebooks,
  onNewNotebook,
  onEditNotebook,
  onAddCostToNotebook,
  onRecordSale,
}: NotebooksTrackerProps) {
  const [, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<NotebookStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());

  // Métricas consolidadas dos notebooks
  const stats = useMemo(() => {
    let inStockCount = 0;
    let capitalInvestedInStockCents = 0;
    let totalRealizedProfitCents = 0;
    let totalSoldIncomeCents = 0;
    let staleCount = 0;

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

        const createdTime = new Date(nb.created_at).getTime();
        const days = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
        if (days > 30) staleCount += 1;
      }
    }

    const marginStr = formatProfitMargin(totalRealizedProfitCents, totalSoldIncomeCents);

    return {
      inStockCount,
      capitalInvestedInStockCents,
      totalRealizedProfitCents,
      marginStr,
      staleCount,
    };
  }, [notebooks, now]);

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
        const matchBuyer = nb.buyer_name?.toLowerCase().includes(q) ?? false;
        if (!matchModel && !matchBrand && !matchSpecs && !matchNotes && !matchBuyer) return false;
      }
      return true;
    });
  }, [notebooks, statusFilter, search]);

  const handleDelete = (id: string, name: string) => {
    startTransition(async () => {
      const res = await trashNotebook(id);
      if (res.ok) {
        toastWithUndo(`${name} foi para a lixeira.`, () => restoreFinanceItem("notebook", id));
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleQuickStatusChange = (nb: Notebook, newStatus: NotebookStatus) => {
    if (newStatus === "sold") {
      onRecordSale(nb);
      return;
    }

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
      <FinanceKpiStrip
        columns={4}
        items={[
          {
            id: "in-stock",
            label: "No estoque",
            value: stats.inStockCount,
            badge:
              stats.staleCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                  <AlertTriangleIcon className="size-3" />
                  {stats.staleCount} (&gt;30d)
                </span>
              ) : undefined,
            subtext: "Em reparo ou à venda",
          },
          {
            id: "capital",
            label: "Capital investido",
            value: formatCentsToBrl(stats.capitalInvestedInStockCents),
            tone: stats.capitalInvestedInStockCents > 0 ? "warning" : "default",
            subtext: "Compra + peças em estoque",
          },
          {
            id: "profit",
            label: "Lucro realizado",
            value: formatCentsToBrl(stats.totalRealizedProfitCents),
            tone: stats.totalRealizedProfitCents >= 0 ? "positive" : "negative",
            subtext: "Total dos vendidos",
          },
          {
            id: "margin",
            label: "Margem média",
            value: stats.marginStr,
            subtext: "Retorno sobre faturamento",
          },
        ]}
      />

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por marca, modelo, peças ou comprador..."
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

            // Cálculo de Dias em Estoque
            const createdTime = new Date(nb.created_at).getTime();
            const endTime = nb.sold_at ? new Date(nb.sold_at).getTime() : now;
            const daysInStock = Math.max(0, Math.floor((endTime - createdTime) / (1000 * 60 * 60 * 24)));
            const isStale = !isSold && daysInStock > 30;

            // Garantia pós-venda
            let isWarrantyActive = false;
            let warrantyEndDateStr = "";
            if (isSold && nb.sold_at) {
              const warrantyDays = nb.warranty_days ?? 90;
              const saleDate = new Date(nb.sold_at);
              const endDate = new Date(saleDate.getTime() + warrantyDays * 86400000);
              isWarrantyActive = now <= endDate.getTime();
              warrantyEndDateStr = endDate.toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" });
            }

            return (
              <div
                key={nb.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/25"
              >
                <div>
                  {/* Topo do Card: Marca, Modelo e Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {nb.brand && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {nb.brand}
                        </span>
                      )}
                      <h4 className="font-semibold text-sm text-foreground group-hover:text-cyan-400 transition-colors">
                        {nb.model}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${statusConfig.badgeClass}`}
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
                            onClick={() => onAddCostToNotebook(nb, isSold ? "Peça garantia pós-venda" : undefined)}
                            className="gap-2 cursor-pointer"
                          >
                            <WrenchIcon className="size-3.5 text-amber-400" />
                            {isSold ? "Lançar Custo de Garantia" : "Lançar Custo / Peça"}
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
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
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

                  {/* Preço Vitrine e Margem Projetada (quando em estoque) */}
                  {!isSold && Boolean(nb.asking_price_cents && nb.asking_price_cents > 0) && (
                    <div className="mt-2.5 flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-2.5 py-1 text-xs">
                      <span className="text-xs text-cyan-300 font-medium">Preço Vitrine:</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-bold text-cyan-400">{formatCentsToBrl(nb.asking_price_cents!)}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          (Margem est.: {formatProfitMargin(nb.asking_price_cents! - expenses, nb.asking_price_cents!)})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Indicador de Dias em Estoque */}
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="size-3" />
                      {isSold ? "Tempo até vender:" : "Dias em estoque:"}
                    </span>
                    <span className={`font-mono ${isStale ? "text-amber-400 font-bold" : "text-foreground"}`}>
                      {daysInStock} {daysInStock === 1 ? "dia" : "dias"}
                      {isStale && (
                        <span className="ml-1 inline-flex items-center rounded bg-amber-500/10 px-1 py-0.2 text-xs text-amber-400 border border-amber-500/30">
                          estagnado
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Ficha da Venda (se já vendido) */}
                  {isSold && (
                    <div className="mt-2 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Comprador:</span>
                        <span className="font-medium text-foreground">{nb.buyer_name || "Não informado"}</span>
                      </div>
                      {nb.buyer_contact && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">WhatsApp:</span>
                          <span className="font-mono text-muted-foreground">{nb.buyer_contact}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <ShieldCheckIcon className="size-3 text-emerald-400" />
                          Garantia:
                        </span>
                        <span className={`font-medium ${isWarrantyActive ? "text-emerald-400" : "text-muted-foreground"}`}>
                          {nb.warranty_days}d {isWarrantyActive ? `(até ${warrantyEndDateStr})` : "(expirada)"}
                        </span>
                      </div>
                      {Boolean(nb.machine_fee_cents && nb.machine_fee_cents > 0) && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Taxa Cartão:</span>
                          <span className="font-mono text-rose-400">-{formatCentsToBrl(nb.machine_fee_cents)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notas / Observações */}
                  {nb.notes && (
                    <div className="mt-2 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground/80 line-clamp-2">
                      {nb.notes}
                    </div>
                  )}
                </div>

                {/* Bloco de Economia Unitária (Unit Economics) */}
                <div className="mt-3 border-t border-border/50 pt-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-xs text-muted-foreground">Custo Total:</span>
                      <div className="font-mono font-medium text-rose-400 tabular-nums">
                        {formatCentsToBrl(expenses)}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">
                        {isSold ? "Vendido por:" : "Receita Vinculada:"}
                      </span>
                      <div className="font-mono font-medium text-foreground tabular-nums">
                        {income > 0 ? formatCentsToBrl(income) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Resultado: Lucro e Margem */}
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {isSold ? "Lucro Realizado:" : "Resultado Atual:"}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums">
                      <span className={profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {formatCentsToBrl(profit)}
                      </span>
                      {income > 0 && (
                        <span className="text-xs text-muted-foreground font-normal">
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
                      onClick={() => onAddCostToNotebook(nb, isSold ? "Peça garantia pós-venda" : undefined)}
                      className="h-7 flex-1 text-xs gap-1"
                    >
                      <PlusIcon className="size-3" />
                      {isSold ? "+ Custo Garantia" : "Add Custo"}
                    </Button>
                    {!isSold ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onRecordSale(nb)}
                        className="h-7 flex-1 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
                        className="h-7 flex-1 text-xs gap-1"
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
