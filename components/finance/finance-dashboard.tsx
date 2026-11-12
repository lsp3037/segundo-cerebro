"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CalendarIcon,
  FileSpreadsheetIcon,
  LandmarkIcon,
  LaptopIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PieChartIcon,
  PlusIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  TagIcon,
  TargetIcon,
} from "lucide-react";

import type {
  FinanceCategory,
  FinanceSummary,
  Notebook,
  PaymentMethod,
  Transaction,
} from "@/lib/data/finance";
import type { HouseholdData } from "@/lib/data/finance-family";
import { todayIso } from "@/lib/dates";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { AccountsCardsView } from "./accounts-cards-view";
import { BudgetsView } from "./budgets-view";
import { CategoriesDialog } from "./categories-dialog";
import { CategoryBreakdown } from "./category-breakdown";
import { HouseholdOverview } from "./household-overview";
import { type LedgerType } from "./meta";
import { MetricsCards } from "./metrics-cards";
import { MonthlyChart } from "./monthly-chart";
import { NotebookDialog } from "./notebook-dialog";
import { NotebooksTracker } from "./notebooks-tracker";
import { OfxImportDialog } from "./ofx-import-dialog";
import { RecurringBillsDialog } from "./recurring-bills-dialog";
import { ReportsComparisonsView } from "./reports-comparisons-view";
import { SaleNotebookDialog } from "./sale-notebook-dialog";
import { TransactionDialog } from "./transaction-dialog";
import { TransactionsTable } from "./transactions-table";

interface FinanceDashboardProps {
  initialSummary: FinanceSummary;
  initialTransactions: Transaction[];
  initialNotebooks: Notebook[];
  householdData: HouseholdData;
  categories: FinanceCategory[];
  paymentMethods: PaymentMethod[];
  currentMonth: string; // YYYY-MM
  currentLedger: LedgerType;
  currentMember: string | null;
  baseFolderId?: string;
}

export function FinanceDashboard({
  initialSummary,
  initialTransactions,
  initialNotebooks,
  householdData,
  categories,
  paymentMethods,
  currentMonth,
  currentLedger,
  currentMember,
}: FinanceDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const defaultTab = currentLedger === "pessoal" ? "visao" : "fluxo";
  const activeTab = searchParams.get("tab") || defaultTab;

  // Diálogos de criação / edição
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txToEdit, setTxToEdit] = useState<Tables<"transactions"> | null>(null);
  const [txDefaultLedger, setTxDefaultLedger] = useState<"pessoal" | "trustcare">(
    currentLedger === "trustcare" ? "trustcare" : "pessoal"
  );
  const [txDefaultNotebookId, setTxDefaultNotebookId] = useState<string | null>(null);
  const [txDefaultDescription, setTxDefaultDescription] = useState<string | null>(null);

  const [nbDialogOpen, setNbDialogOpen] = useState(false);
  const [nbToEdit, setNbToEdit] = useState<Notebook | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [nbToSell, setNbToSell] = useState<Notebook | null>(null);
  const [ofxDialogOpen, setOfxDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [fluxoStatusFilter, setFluxoStatusFilter] = useState<"all" | "pending" | "paid">("all");

  // Mês atual real em Cuiabá
  const realCurrentMonth = todayIso().slice(0, 7);

  // Atualiza parâmetros de navegação na URL
  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null) params.delete(key);
      else params.set(key, val);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Navegação de Mês
  const handlePrevMonth = () => {
    const [yStr, mStr] = currentMonth.split("-");
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    const nextMonthStr = `${y}-${String(m).padStart(2, "0")}`;
    updateParams({ m: nextMonthStr });
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = currentMonth.split("-");
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const nextMonthStr = `${y}-${String(m).padStart(2, "0")}`;
    updateParams({ m: nextMonthStr });
  };

  const handleResetCurrentMonth = () => {
    updateParams({ m: realCurrentMonth });
  };

  // Formatação bonita do nome do mês (ex: "Novembro de 2026")
  const formattedMonthLabel = (() => {
    const [yStr, mStr] = currentMonth.split("-");
    const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  // Handlers para ações diretas
  const handleOpenNewTransaction = (prefLedger?: "pessoal" | "trustcare") => {
    setTxToEdit(null);
    setTxDefaultLedger(prefLedger || (currentLedger === "trustcare" ? "trustcare" : "pessoal"));
    setTxDialogOpen(true);
  };

  const handleEditTransaction = (tx: Tables<"transactions">) => {
    setTxToEdit(tx);
    setTxDialogOpen(true);
  };

  const handleAddCostToNotebook = (nb: Notebook, defaultDescription?: string) => {
    setTxToEdit(null);
    setTxDefaultLedger("trustcare");
    setTxDefaultNotebookId(nb.id);
    setTxDefaultDescription(defaultDescription || `Peça / Upgrade ${nb.brand ? `${nb.brand} ` : ""}${nb.model}`);
    setTxDialogOpen(true);
  };

  const handleRecordSale = (nb: Notebook) => {
    setNbToSell(nb);
    setSaleDialogOpen(true);
  };

  const handleOpenNewNotebook = () => {
    setNbToEdit(null);
    setNbDialogOpen(true);
  };

  const handleEditNotebook = (nb: Notebook) => {
    setNbToEdit(nb);
    setNbDialogOpen(true);
  };

  return (
    <div className="space-y-6 px-4 py-4 md:px-6">
      {/* 1. Barra de Controles Superiores (Ledger Switcher, Mês e Ações) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Alternador de Conta / Ledger (Pills elegantes estilo Linear) */}
        <div className="inline-flex rounded-xl bg-muted/40 p-1 border border-border/60">
          {(["all", "pessoal", "trustcare"] as LedgerType[]).map((ldg) => {
            const isSelected = currentLedger === ldg;
            return (
              <button
                key={ldg}
                type="button"
                onClick={() =>
                  updateParams({
                    ledger: ldg,
                    tab: ldg === "pessoal" ? "visao" : ldg === "trustcare" ? "fluxo" : activeTab,
                  })
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-background text-foreground shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ldg === "all"
                  ? "Consolidado Geral"
                  : ldg === "pessoal"
                    ? "Pessoal & Familiar"
                    : "Trust Care"}
              </button>
            );
          })}
        </div>

        {/* Navegador de Mês & Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Mês */}
          <div className="flex items-center rounded-xl border border-border/70 bg-card/60 p-1 shadow-xs backdrop-blur-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              title="Mês anterior"
            >
              <ArrowLeftIcon className="size-3.5" />
            </Button>

            <div className="flex items-center gap-1.5 px-3 font-mono text-xs font-medium text-foreground">
              <CalendarIcon className="size-3.5 text-muted-foreground" />
              <span>{formattedMonthLabel}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              title="Próximo mês"
            >
              <ArrowRightIcon className="size-3.5" />
            </Button>
          </div>

          {currentMonth !== realCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetCurrentMonth}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcwIcon className="size-3" />
              Mês Atual
            </Button>
          )}

          {/* Contas Fixas & Dízimo (Pessoal/Familiar) */}
          {currentLedger !== "trustcare" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecurringDialogOpen(true)}
              className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ListChecksIcon className="size-3.5" />
              Contas Fixas &amp; Dízimo
            </Button>
          )}

          {/* Importar Extrato OFX */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOfxDialogOpen(true)}
            className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <FileSpreadsheetIcon className="size-3.5" />
            Importar Extrato (.OFX)
          </Button>

          {/* Gerenciar Categorias */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatDialogOpen(true)}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <TagIcon className="size-3.5" />
            Categorias
          </Button>

          {/* Botões de Ação Primária */}
          {(currentLedger === "all" || currentLedger === "trustcare") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenNewNotebook}
              className="h-8 gap-1.5 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              <LaptopIcon className="size-3.5" />
              + Notebook
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleOpenNewTransaction()}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <PlusIcon className="size-3.5" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* 2. Cards de Métricas (omitido quando na Visão Geral Pessoal, que já exibe os 4 KPIs familiares) */}
      {activeTab !== "visao" && (
        <MetricsCards
          totalIncomeCents={initialSummary.totalIncomeCents}
          totalExpenseCents={initialSummary.totalExpenseCents}
          netBalanceCents={initialSummary.netBalanceCents}
          profitMarginPercent={initialSummary.profitMarginPercent}
          transactionCount={initialSummary.transactionCount}
          ledger={currentLedger}
        />
      )}

      {/* 3. Sub-abas + Filtro de Pessoa */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60">
          <nav className="-mb-px flex gap-5 overflow-x-auto" aria-label="Abas financeiras">
            {currentLedger !== "trustcare" && (
              <button
                type="button"
                onClick={() => updateParams({ tab: "visao" })}
                className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === "visao"
                    ? "border-emerald-400 text-emerald-400"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <LayoutDashboardIcon className="size-4" />
                Visão Geral
              </button>
            )}

            {currentLedger !== "trustcare" && (
              <button
                type="button"
                onClick={() => updateParams({ tab: "contas" })}
                className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === "contas"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <LandmarkIcon className="size-4" />
                Contas &amp; Cartões
              </button>
            )}

            {currentLedger !== "trustcare" && (
              <button
                type="button"
                onClick={() => updateParams({ tab: "orcamentos" })}
                className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === "orcamentos"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <TargetIcon className="size-4" />
                Orçamentos
              </button>
            )}

            {currentLedger !== "trustcare" && (
              <button
                type="button"
                onClick={() => updateParams({ tab: "relatorios" })}
                className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === "relatorios"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <BarChart3Icon className="size-4" />
                Relatórios &amp; KPIs
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setFluxoStatusFilter("all");
                updateParams({ tab: "fluxo" });
              }}
              className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "fluxo"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <ReceiptTextIcon className="size-4" />
              Fluxo &amp; Vencimentos
            </button>

            {(currentLedger === "all" || currentLedger === "trustcare") && (
              <button
                type="button"
                onClick={() => updateParams({ tab: "notebooks" })}
                className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === "notebooks"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <LaptopIcon className="size-4" />
                Revenda de Notebooks
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-400">
                  {initialNotebooks.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => updateParams({ tab: "categorias" })}
              className={`flex items-center gap-1.5 border-b-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "categorias"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <PieChartIcon className="size-4" />
              Categorias
            </button>
          </nav>

          {currentLedger !== "trustcare" && (
            <div className="flex items-center gap-1 pb-2 text-xs">
              <span className="text-[11px] text-muted-foreground mr-1">Pessoa:</span>
              <button
                type="button"
                onClick={() => updateParams({ member: null })}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  !currentMember
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {HOUSEHOLD_MEMBERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateParams({ member: m })}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    currentMember === m
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tela 1: Visão Geral (Cockpit Pessoal & Familiar) */}
        {activeTab === "visao" && (
          <HouseholdOverview
            data={householdData}
            onGoToPendingFluxo={() => {
              setFluxoStatusFilter("pending");
              updateParams({ tab: "fluxo" });
            }}
            onOpenRecurringDialog={() => setRecurringDialogOpen(true)}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {/* Tela 2: Contas & Cartões */}
        {activeTab === "contas" && <AccountsCardsView accounts={householdData.accounts} />}

        {/* Tela 3: Orçamentos da Casa */}
        {activeTab === "orcamentos" && <BudgetsView budgets={householdData.budgets} categories={categories} />}

        {/* Tela 4: Relatórios, KPIs & Comparativos */}
        {activeTab === "relatorios" && <ReportsComparisonsView data={householdData} />}

        {/* Tela 5: Fluxo & Vencimentos */}
        {activeTab === "fluxo" && (
          <div className="space-y-6">
            <MonthlyChart data={initialSummary.monthlyTrend} />
            <TransactionsTable
              key={fluxoStatusFilter}
              transactions={
                currentMember
                  ? initialTransactions.filter((t) => t.member_label === currentMember)
                  : initialTransactions
              }
              categories={categories}
              paymentMethods={paymentMethods}
              initialStatusFilter={fluxoStatusFilter}
              onEditTransaction={handleEditTransaction}
              onNewTransaction={() => handleOpenNewTransaction()}
            />
          </div>
        )}

        {/* Conteúdo da Aba 2: Revenda de Notebooks (Trust Care) */}
        {activeTab === "notebooks" && (
          <NotebooksTracker
            notebooks={initialNotebooks}
            categories={categories}
            paymentMethods={paymentMethods}
            onNewNotebook={handleOpenNewNotebook}
            onEditNotebook={handleEditNotebook}
            onAddCostToNotebook={handleAddCostToNotebook}
            onRecordSale={handleRecordSale}
          />
        )}

        {/* Conteúdo da Aba 3: Relatório por Categoria */}
        {activeTab === "categorias" && (
          <CategoryBreakdown categoriesBreakdown={initialSummary.categoriesBreakdown} />
        )}
      </div>

      {/* Diálogos */}
      <TransactionDialog
        open={txDialogOpen}
        onOpenChange={(open) => {
          setTxDialogOpen(open);
          if (!open) {
            setTxDefaultNotebookId(null);
            setTxDefaultDescription(null);
          }
        }}
        categories={categories}
        paymentMethods={paymentMethods}
        notebooks={initialNotebooks}
        accounts={householdData.accounts}
        defaultLedger={txDefaultLedger}
        defaultNotebookId={txDefaultNotebookId}
        defaultDescription={txDefaultDescription}
        transactionToEdit={txToEdit}
      />

      <RecurringBillsDialog
        open={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
        bills={householdData.recurringBills}
        categories={categories}
        accounts={householdData.accounts}
        currentMonth={currentMonth}
      />

      <NotebookDialog
        open={nbDialogOpen}
        onOpenChange={setNbDialogOpen}
        categories={categories}
        paymentMethods={paymentMethods}
        notebookToEdit={nbToEdit}
      />

      <SaleNotebookDialog
        open={saleDialogOpen}
        onOpenChange={setSaleDialogOpen}
        notebook={nbToSell}
        paymentMethods={paymentMethods}
      />

      <OfxImportDialog
        open={ofxDialogOpen}
        onOpenChange={setOfxDialogOpen}
        categories={categories}
        paymentMethods={paymentMethods}
        defaultLedger={currentLedger === "trustcare" ? "trustcare" : "pessoal"}
      />

      <CategoriesDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        categories={categories}
        defaultLedger={currentLedger === "trustcare" ? "trustcare" : "pessoal"}
      />
    </div>
  );
}
