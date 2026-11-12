import type { Metadata } from "next";

import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { getAreaFilter } from "@/lib/data/area-filter";
import {
  ensureDefaultFinanceData,
  getFinanceCategories,
  getFinanceSummary,
  getNotebooks,
  getPaymentMethods,
  getTransactions,
} from "@/lib/data/finance";
import { ensureMonthBills, getHouseholdData } from "@/lib/data/finance-family";
import { todayIso } from "@/lib/dates";
import { TABS } from "@/lib/modules";

const tab = TABS[7];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/financas">) {
  const user = await getCurrentUser();
  await ensureDefaultFinanceData(user.id);

  const searchParams = await props.searchParams;
  const area = await getAreaFilter(props.searchParams);

  // Mês padrão: Mês atual em Cuiabá (ex: "2026-11")
  const currentMonth =
    typeof searchParams.m === "string" && /^\d{4}-\d{2}$/.test(searchParams.m)
      ? searchParams.m
      : todayIso().slice(0, 7);

  await ensureMonthBills(user.id, currentMonth);

  // Ledger padrão: Pessoal & Familiar (prioridade da casa)
  let currentLedger: "all" | "pessoal" | "trustcare" = "pessoal";
  if (searchParams.ledger === "all" || searchParams.ledger === "pessoal" || searchParams.ledger === "trustcare") {
    currentLedger = searchParams.ledger;
  } else if (area?.slug === "trustcare" || area?.slug === "profissional") {
    currentLedger = "trustcare";
  }

  const currentMember = typeof searchParams.member === "string" && searchParams.member.trim() ? searchParams.member.trim() : null;

  const [summary, transactions, notebooks, categories, paymentMethods, householdData] = await Promise.all([
    getFinanceSummary({ ledger: currentLedger, month: currentMonth }),
    getTransactions({ ledger: currentLedger, month: currentMonth }),
    getNotebooks(),
    getFinanceCategories(),
    getPaymentMethods(),
    getHouseholdData({ month: currentMonth, member: currentMember }),
  ]);

  return (
    <FinanceDashboard
      initialSummary={summary}
      initialTransactions={transactions}
      initialNotebooks={notebooks}
      householdData={householdData}
      categories={categories}
      paymentMethods={paymentMethods}
      currentMonth={currentMonth}
      currentLedger={currentLedger}
      currentMember={currentMember}
    />
  );
}
