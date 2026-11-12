"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TagIcon,
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
import { formatCentsToBrl } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountsCardsView } from "./accounts-cards-view";
import { BudgetsView } from "./budgets-view";
import { CategoriesDialog } from "./categories-dialog";
import { CategoryBreakdown } from "./category-breakdown";
import { ConsolidatedOverview } from "./consolidated-overview";
import { FinanceHero, FinanceKpiStrip, signedResult } from "./finance-hierarchy";
import { HouseholdOverview } from "./household-overview";
import { LEDGER_TABS, type FinanceTab, type LedgerType } from "./meta";
import { MonthDiagnosticCard } from "./month-diagnostic-card";
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
  contextLabel?: string;
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
  contextLabel,
}: FinanceDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const allowedTabs = LEDGER_TABS[currentLedger];
  const rawTab = searchParams.get("tab") as FinanceTab | null;
  const activeTab: FinanceTab =
    rawTab && allowedTabs.some((t) => t.id === rawTab) ? rawTab : "visao";
  const activeMember = currentLedger === "pessoal" ? currentMember : null;

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

  // Formatação compacta do mês (ex: "Nov 2026")
  const formattedMonthLabel = (() => {
    const [yStr, mStr] = currentMonth.split("-");
    const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const shortMonth = d
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "");
    return `${shortMonth.charAt(0).toUpperCase()}${shortMonth.slice(1)} ${yStr}`;
  })();

  const handleSwitchLedger = (nextLedger: LedgerType) => {
    const nextAllowed = LEDGER_TABS[nextLedger];
    const nextTab = nextAllowed.some((t) => t.id === activeTab) ? activeTab : "visao";
    updateParams({
      ledger: nextLedger,
      tab: nextTab,
      member: nextLedger === "pessoal" ? activeMember : null,
    });
  };

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

  const isNotebooksPrimary = currentLedger === "trustcare" && activeTab === "notebooks";

  return (
    <div className="px-4 pb-8 md:px-6">
      {/* 1. Workspace Header único (~56px no desktop) */}
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border/70 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            {contextLabel && (
              <span className="text-xs text-muted-foreground">{contextLabel} /</span>
            )}
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              Finanças
            </h1>
          </div>

          {/* Seletor de Conta / Ledger */}
          <div
            role="tablist"
            aria-label="Contexto financeiro"
            className="inline-flex h-8 items-center rounded-md border border-border bg-card p-0.5 text-xs"
          >
            {(["pessoal", "trustcare", "all"] as LedgerType[]).map((ldg) => {
              const isSelected = currentLedger === ldg;
              return (
                <button
                  key={ldg}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSwitchLedger(ldg)}
                  className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ldg === "pessoal"
                    ? "Pessoal"
                    : ldg === "trustcare"
                      ? "Trust Care"
                      : "Consolidado"}
                </button>
              );
            })}
          </div>

          {/* Seletor de Mês compacto + Hoje inline */}
          <div className="flex items-center gap-1.5">
            <div className="inline-flex h-8 items-center rounded-md border border-border bg-card px-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                className="size-7 p-0 text-muted-foreground hover:text-foreground"
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <span className="min-w-[74px] px-1.5 text-center text-xs font-medium tabular-nums text-foreground">
                {formattedMonthLabel}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                className="size-7 p-0 text-muted-foreground hover:text-foreground"
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>

            {currentMonth !== realCurrentMonth && (
              <button
                type="button"
                onClick={handleResetCurrentMonth}
                className="cursor-pointer rounded px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Hoje
              </button>
            )}
          </div>
        </div>

        {/* Ações do Workspace: 1 menu Configurar + 1 CTA primário invertido */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontalIcon className="size-3.5" />
                <span>Configurar</span>
                <ChevronDownIcon className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {currentLedger !== "trustcare" && (
                <>
                  <DropdownMenuItem onSelect={() => setRecurringDialogOpen(true)}>
                    <ListChecksIcon className="size-4" />
                    <span>Contas Fixas &amp; Dízimo</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => setOfxDialogOpen(true)}>
                <FileSpreadsheetIcon className="size-4" />
                <span>Importar Extrato (.OFX)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCatDialogOpen(true)}>
                <TagIcon className="size-4" />
                <span>Gerenciar Categorias</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            onClick={
              isNotebooksPrimary
                ? handleOpenNewNotebook
                : () => handleOpenNewTransaction()
            }
            className="h-8 gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90"
          >
            <PlusIcon className="size-3.5" />
            <span>{isNotebooksPrimary ? "Novo Notebook" : "Lançamento"}</span>
          </Button>
        </div>
      </header>

      {/* 2. Sub-abas (~40px) + Filtro de Pessoa exclusivo de Pessoal */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70">
        <nav
          className="-mb-px flex items-center gap-5 overflow-x-auto"
          aria-label="Abas financeiras"
        >
          {allowedTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === "fluxo") setFluxoStatusFilter("all");
                  updateParams({ tab: tab.id });
                }}
                className={`flex h-10 cursor-pointer items-center gap-1.5 border-b-2 text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === "notebooks" && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {initialNotebooks.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {currentLedger === "pessoal" && (
          <div className="flex items-center gap-1 py-1.5 text-xs">
            <span className="mr-1 text-[11px] text-muted-foreground">Pessoa:</span>
            <button
              type="button"
              onClick={() => updateParams({ member: null })}
              className={`cursor-pointer rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                !activeMember
                  ? "border-foreground/30 bg-muted text-foreground"
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
                className={`cursor-pointer rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  activeMember === m
                    ? "border-foreground/30 bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Conteúdo da Aba Ativa */}
      <div className="pt-5">
        {/* Visão Geral Pessoal / Familiar */}
        {activeTab === "visao" && currentLedger === "pessoal" && (
          <HouseholdOverview
            data={householdData}
            onGoToPendingFluxo={() => {
              setFluxoStatusFilter("pending");
              updateParams({ tab: "fluxo" });
            }}
            onGoToAllFluxo={() => {
              setFluxoStatusFilter("all");
              updateParams({ tab: "fluxo" });
            }}
            onOpenRecurringDialog={() => setRecurringDialogOpen(true)}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {/* Resumo Trust Care */}
        {activeTab === "visao" && currentLedger === "trustcare" && (
          <div className="space-y-5">
            <FinanceHero
              eyebrow="Resultado Trust Care no mês"
              value={signedResult(initialSummary.netBalanceCents).value}
              tone={signedResult(initialSummary.netBalanceCents).tone}
              subtitle={
                <span className="tabular-nums">
                  Entradas {formatCentsToBrl(initialSummary.totalIncomeCents)} − Saídas{" "}
                  {formatCentsToBrl(initialSummary.totalExpenseCents)} ·{" "}
                  {initialSummary.transactionCount}{" "}
                  {initialSummary.transactionCount === 1 ? "lançamento" : "lançamentos"}
                </span>
              }
            />
            <FinanceKpiStrip
              columns={3}
              items={[
                {
                  id: "tc-income",
                  label: "Entradas",
                  value: formatCentsToBrl(initialSummary.totalIncomeCents),
                  tone: initialSummary.totalIncomeCents > 0 ? "positive" : "default",
                  subtext: "Recebimentos e vendas no mês",
                },
                {
                  id: "tc-expense",
                  label: "Saídas & custos",
                  value: formatCentsToBrl(initialSummary.totalExpenseCents),
                  tone: initialSummary.totalExpenseCents > 0 ? "negative" : "default",
                  subtext: "Compras, peças e operação",
                },
                {
                  id: "tc-pending",
                  label: "Contas pendentes",
                  value: formatCentsToBrl(initialSummary.pendingExpenseCents),
                  tone: initialSummary.pendingExpenseCents > 0 ? "warning" : "default",
                  subtext: `Margem ${initialSummary.profitMarginPercent}% no mês`,
                },
              ]}
            />
            <MonthlyChart data={initialSummary.monthlyTrend} currentMonth={currentMonth} />
          </div>
        )}

        {/* Resumo Geral Consolidado (Pessoal + Trust Care) */}
        {activeTab === "visao" && currentLedger === "all" && (
          <ConsolidatedOverview summary={initialSummary} currentMonth={currentMonth} />
        )}

        {/* Tela 2: Contas & Cartões */}
        {activeTab === "contas" && <AccountsCardsView accounts={householdData.accounts} />}

        {/* Tela 3: Orçamentos da Casa */}
        {activeTab === "orcamentos" && <BudgetsView budgets={householdData.budgets} categories={categories} />}

        {/* Tela 4: Relatórios, KPIs & Categorias */}
        {activeTab === "relatorios" && currentLedger === "pessoal" && (
          <div className="space-y-5">
            <MonthDiagnosticCard
              month={currentMonth}
              ledger={currentLedger}
              member={activeMember}
            />
            <ReportsComparisonsView
              data={householdData}
              categoriesBreakdown={initialSummary.categoriesBreakdown}
              currentMonth={currentMonth}
            />
          </div>
        )}
        {activeTab === "relatorios" && currentLedger !== "pessoal" && (
          <div className="space-y-5">
            <MonthDiagnosticCard
              month={currentMonth}
              ledger={currentLedger}
              member={activeMember}
            />
            <MonthlyChart data={initialSummary.monthlyTrend} currentMonth={currentMonth} />
            <CategoryBreakdown categoriesBreakdown={initialSummary.categoriesBreakdown} />
          </div>
        )}

        {/* Tela 5: Fluxo & Vencimentos */}
        {activeTab === "fluxo" && (
          <TransactionsTable
            key={fluxoStatusFilter}
            transactions={
              activeMember
                ? initialTransactions.filter((t) => t.member_label === activeMember)
                : initialTransactions
            }
            categories={categories}
            initialStatusFilter={fluxoStatusFilter}
            onEditTransaction={handleEditTransaction}
            onNewTransaction={() => handleOpenNewTransaction()}
          />
        )}

        {/* Notebooks Trust Care */}
        {activeTab === "notebooks" && (
          <NotebooksTracker
            notebooks={initialNotebooks}
            onNewNotebook={handleOpenNewNotebook}
            onEditNotebook={handleEditNotebook}
            onAddCostToNotebook={handleAddCostToNotebook}
            onRecordSale={handleRecordSale}
          />
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
