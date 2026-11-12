"use server";

import { getAiProvider, isAiConfigured } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import { getFinanceSummary } from "@/lib/data/finance";
import { getHouseholdData } from "@/lib/data/finance-family";
import { formatCentsToBrl } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { LedgerType } from "@/components/finance/meta";
import { type ActionResult, fail, ok } from "./result";

export interface MonthDiagnosticResult {
  month: string;
  ledger: LedgerType;
  headline: string;
  summary: string;
  highlights: string[];
  actionTip: string;
  source: "local" | "ai";
}

function formatPct(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export async function generateMonthDiagnostic(input: {
  month: string;
  ledger: LedgerType;
  member?: string | null;
}): Promise<ActionResult<MonthDiagnosticResult>> {
  try {
    await getCurrentUser();
    const { month, ledger } = input;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return fail("Mês inválido para diagnóstico.");
    }

    const effectiveMember = ledger === "pessoal" ? (input.member ?? null) : null;
    const supabase = await createClient();

    const [{ data: finArea }, summary, household] = await Promise.all([
      supabase.from("areas").select("id, ai_enabled").eq("slug", "financas").maybeSingle(),
      getFinanceSummary({ ledger, month, member: effectiveMember }),
      ledger === "pessoal"
        ? getHouseholdData({ month, member: effectiveMember })
        : Promise.resolve(null),
    ]);

    const topExpense = summary.categoriesBreakdown.find((c) => c.kind === "expense");
    const pendingCount =
      household?.transactions.filter((t) => t.kind === "expense" && t.billStatus !== "paid").length ?? 0;
    const overdueCount =
      household?.transactions.filter((t) => t.kind === "expense" && t.billStatus === "overdue").length ?? 0;

    // Resumo determinístico local (sempre calculado no servidor; não vaza nada se Finanças estiver travada para IA).
    const buildLocalDiagnostic = (): MonthDiagnosticResult => {
      if (summary.transactionCount === 0) {
        return {
          month,
          ledger,
          headline: "Período ainda sem lançamentos registrados.",
          summary:
            "Adicione entradas e saídas deste mês ou importe um extrato .OFX para gerar o comparativo e o saldo projetado.",
          highlights: [
            "Entradas no mês: R$ 0,00 · Saídas no mês: R$ 0,00",
            "Contas fixas configuradas podem ser geradas automaticamente em Configurar → Contas Fixas & Dízimo.",
          ],
          actionTip:
            ledger === "pessoal"
              ? "Abra Configurar → Contas Fixas & Dízimo para carregar sua planilha mensal em 1 clique."
              : "Use + Lançamento no topo para registrar a primeira movimentação deste período.",
          source: "local",
        };
      }

      const netSign = summary.netBalanceCents >= 0 ? "+" : "";
      const headline =
        summary.netBalanceCents >= 0
          ? `Saldo positivo de ${netSign}${formatCentsToBrl(summary.netBalanceCents)} (${formatPct(summary.profitMarginPercent)} de margem).`
          : `Déficit de ${formatCentsToBrl(summary.netBalanceCents)} no período analisado.`;

      const highlights: string[] = [
        `Entradas somam ${formatCentsToBrl(summary.totalIncomeCents)} contra ${formatCentsToBrl(summary.totalExpenseCents)} em saídas (${summary.transactionCount} lançamentos).`,
      ];

      if (summary.pendingExpenseCents > 0) {
        highlights.push(
          `Pendências a pagar: ${formatCentsToBrl(summary.pendingExpenseCents)}${
            overdueCount > 0
              ? ` (${overdueCount} ${overdueCount === 1 ? "atrasada" : "atrasadas"})`
              : pendingCount > 0
                ? ` em ${pendingCount} ${pendingCount === 1 ? "conta" : "contas"}`
                : ""
          }.`
        );
      } else {
        highlights.push("Todas as saídas registradas neste mês estão quitadas.");
      }

      if (topExpense) {
        highlights.push(
          `Maior peso em saídas: ${topExpense.categoryName} com ${formatCentsToBrl(topExpense.totalCents)} (${topExpense.percentage}%).`
        );
      }

      if (household) {
        const biggestIncrease = household.comparison.find(
          (c) => c.changePercent !== null && c.changePercent >= 15
        );
        if (biggestIncrease) {
          highlights.push(
            `${biggestIncrease.categoryName} subiu ${biggestIncrease.changePercent}% em relação ao mês anterior.`
          );
        }
      }

      const actionTip =
        overdueCount > 0
          ? `Priorize a quitação das ${overdueCount} contas atrasadas em Lançamentos.`
          : summary.netBalanceCents < 0 && topExpense
            ? `Revise gastos em ${topExpense.categoryName} ou ajuste o teto mensal em Orçamentos.`
            : "Mantenha os recebimentos e faturas de cartão atualizados para preservar a previsibilidade do mês.";

      return {
        month,
        ledger,
        headline,
        summary: household
          ? `Poupança projetada em ${formatPct(household.kpis.savingsRatePercent)} com ${formatPct(household.kpis.fixedCommitmentPercent)} de comprometimento fixo.`
          : `Resultado calculado localmente a partir dos lançamentos reais do mês.`,
        highlights: highlights.slice(0, 4),
        actionTip,
        source: "local",
      };
    };

    // Se a área Finanças tiver ai_enabled = true E provedor configurado, valida trava com assertAreaAllowsAi.
    if (finArea?.id && finArea.ai_enabled && isAiConfigured()) {
      await assertAreaAllowsAi(finArea.id);
      const ai = getAiProvider();
      const aggregatePayload = {
        month,
        ledger,
        income: formatCentsToBrl(summary.totalIncomeCents),
        expense: formatCentsToBrl(summary.totalExpenseCents),
        net: formatCentsToBrl(summary.netBalanceCents),
        pendingExpense: formatCentsToBrl(summary.pendingExpenseCents),
        marginPercent: summary.profitMarginPercent,
        topExpenseCategory: topExpense ? `${topExpense.categoryName} (${topExpense.percentage}%)` : null,
      };

      const aiData = await ai.generateJson<{
        headline: string;
        summary: string;
        highlights: string[];
        actionTip: string;
      }>({
        system:
          "Você é um assistente financeiro conciso em português brasileiro. Nunca invente números além dos fornecidos.",
        prompt: `Resuma este mês financeiro em até 4 bullets práticos: ${JSON.stringify(aggregatePayload)}`,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            summary: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
            actionTip: { type: "string" },
          },
          required: ["headline", "summary", "highlights", "actionTip"],
        },
      });

      return ok({
        month,
        ledger,
        headline: aiData.headline,
        summary: aiData.summary,
        highlights: aiData.highlights.slice(0, 4),
        actionTip: aiData.actionTip,
        source: "ai",
      });
    }

    return ok(buildLocalDiagnostic());
  } catch (err) {
    console.error("generateMonthDiagnostic:", err);
    return fail("Não foi possível gerar o diagnóstico do mês.");
  }
}
