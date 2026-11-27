import "server-only";

import { addDays, todayIso } from "@/lib/dates";
import type { MonthKpis } from "@/lib/finance/household";
import type { UpcomingBill } from "@/lib/data/finance-family";

export type PersonalFinanceSummary =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      month: string;
      today: string;
      kpis: MonthKpis;
      upcoming: UpcomingBill[];
    };

export function financeAppUrl(): string | null {
  return (process.env.FINANCE_API_URL ?? "").trim().replace(/\/+$/, "") || null;
}

export async function getPersonalFinanceSummary(month?: string): Promise<PersonalFinanceSummary> {
  const base = financeAppUrl();
  const key = process.env.FINANCE_API_KEY?.trim();
  if (!base || !key) return { status: "not_configured" };

  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  try {
    const res = await fetch(`${base}/api/v1/summary${query}`, {
      headers: { "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      return { status: "error", message: "Chave recusada pelo Minhas Finanças." };
    }
    if (!res.ok) {
      return { status: "error", message: `Minhas Finanças respondeu com erro ${res.status}.` };
    }

    const body = (await res.json()) as {
      month: string;
      today: string;
      kpis: MonthKpis;
      upcoming: UpcomingBill[];
    };

    return {
      status: "ok",
      month: body.month,
      today: body.today,
      kpis: body.kpis,
      upcoming: body.upcoming ?? [],
    };
  } catch (error) {
    console.error("getPersonalFinanceSummary:", error);
    return { status: "error", message: "Não foi possível conectar ao Minhas Finanças agora." };
  }
}

export async function getUpcomingPersonalBillsFromApi(days = 7, limit = 8): Promise<UpcomingBill[]> {
  const res = await getPersonalFinanceSummary();
  if (res.status !== "ok") return [];
  const cutoff = addDays(res.today || todayIso(), days);
  return res.upcoming
    .filter((b) => b.due_date && b.due_date <= cutoff)
    .slice(0, limit);
}

export async function payPersonalTransactionViaApi(
  transactionId: string,
  paid?: boolean,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const base = financeAppUrl();
  const key = process.env.FINANCE_API_KEY?.trim();
  if (!base || !key) {
    return { ok: false, error: "Integração com Minhas Finanças não configurada." };
  }

  try {
    const res = await fetch(`${base}/api/v1/transactions/${encodeURIComponent(transactionId)}/pay`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
      },
      body: paid === undefined ? undefined : JSON.stringify({ paid }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { ok: false, error: "Não foi possível atualizar a conta no Minhas Finanças." };
    }

    const body = (await res.json()) as { status: string };
    return { ok: true, status: body.status };
  } catch (error) {
    console.error("payPersonalTransactionViaApi:", error);
    return { ok: false, error: "Falha de comunicação com o Minhas Finanças." };
  }
}
