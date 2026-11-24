import type { Metadata } from "next";

import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { getAreaFilter } from "@/lib/data/area-filter";
import {
  ensureDefaultFinanceData,
  getFinanceCategories,
  getFinanceSummary,
  getNotebooks,
  getOverdueTransactions,
  getPaymentMethods,
  getTransactions,
  type Transaction,
} from "@/lib/data/finance";
import { ensureMonthBills, getHouseholdData } from "@/lib/data/finance-family";
import { getInvestmentsData } from "@/lib/data/finance-investments";
import { startOfMonth, todayIso } from "@/lib/dates";
import { getFinanceScope } from "@/lib/finance/scope";
import { TABS } from "@/lib/modules";

const tab = TABS[7];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/financas">) {
  const scope = await getFinanceScope();
  // Membro usa as categorias do dono: não cria nem limpa nada.
  if (!scope.isMember) await ensureDefaultFinanceData(scope.ownerId);

  const searchParams = await props.searchParams;
  const area = await getAreaFilter(props.searchParams);

  // Mês padrão: Mês atual em Cuiabá (ex: "2026-11")
  const currentMonth =
    typeof searchParams.m === "string" && /^\d{4}-\d{2}$/.test(searchParams.m)
      ? searchParams.m
      : todayIso().slice(0, 7);

  await ensureMonthBills(scope.ownerId, currentMonth);

  // Ledger padrão: Pessoal & Familiar (prioridade da casa). Membro: sempre o Pessoal, ignora ?ledger=.
  let currentLedger: "all" | "pessoal" | "trustcare" = "pessoal";
  if (scope.isMember) {
    currentLedger = "pessoal";
  } else if (searchParams.ledger === "all" || searchParams.ledger === "pessoal" || searchParams.ledger === "trustcare") {
    currentLedger = searchParams.ledger;
  } else if (area?.slug === "trustcare" || area?.slug === "profissional") {
    currentLedger = "trustcare";
  }

  const currentMember = typeof searchParams.member === "string" && searchParams.member.trim() ? searchParams.member.trim() : null;
  const effectiveMember = currentLedger === "pessoal" ? currentMember : null;
  const showInvestments = currentLedger === "pessoal" && searchParams.tab === "investimentos";

  // Atrasados de meses anteriores só entram na lista quando se olha o mês atual de verdade.
  const today = todayIso();
  const showOverdueEarlier = searchParams.tab === "fluxo" && currentMonth === today.slice(0, 7);

  const [summary, transactions, overdueEarlier, notebooks, categories, paymentMethods, householdData, investmentsData] = await Promise.all([
    getFinanceSummary({ ledger: currentLedger, month: currentMonth, member: effectiveMember }),
    getTransactions({ ledger: currentLedger, month: currentMonth, member: effectiveMember }),
    showOverdueEarlier
      ? getOverdueTransactions({ ledger: currentLedger, member: effectiveMember, beforeDate: startOfMonth(today) })
      : Promise.resolve([] as Transaction[]),
    scope.isMember ? [] : getNotebooks(),
    getFinanceCategories(),
    getPaymentMethods(),
    getHouseholdData({ month: currentMonth, member: effectiveMember }),
    showInvestments ? getInvestmentsData({ month: currentMonth, member: effectiveMember }) : null,
  ]);

  return (
    <FinanceDashboard
      initialSummary={summary}
      initialTransactions={transactions}
      overdueEarlier={overdueEarlier}
      initialNotebooks={notebooks}
      householdData={householdData}
      investmentsData={investmentsData}
      categories={categories}
      paymentMethods={paymentMethods}
      currentMonth={currentMonth}
      currentLedger={currentLedger}
      currentMember={effectiveMember}
    />
  );
}
