"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertLedgerAllowed, getFinanceScope } from "@/lib/finance/scope";
import { ensureMonthBills } from "@/lib/data/finance-family";
import {
  formatDayMonth,
  isMovementKind,
  loadInvestmentState,
  movementsWithout,
  newOverdrawnDate,
} from "@/lib/data/finance-investment-state";
import { todayIso } from "@/lib/dates";
import { monthKey } from "@/lib/finance/household";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

// Ações usadas pelo botão "Desfazer" dos avisos de Finanças.
// Tudo o que é excluído em Finanças vai para a lixeira (deleted_at), então desfazer = limpar deleted_at.

const uuidSchema = z.string().uuid("ID inválido.");

// Marca um lançamento como pago ou pendente de forma explícita (não alterna),
// para o "Desfazer" voltar exatamente ao estado anterior mesmo com cliques repetidos.
export async function setTransactionPaid(
  transactionId: string,
  paid: boolean,
): Promise<ActionResult<{ status: "paid" | "pending" }>> {
  const scope = await getFinanceScope();
  if (!uuidSchema.safeParse(transactionId).success) return fail("Lançamento inválido.");

  const status = paid ? "paid" : "pending";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ status, paid_at: paid ? todayIso() : null, updated_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("user_id", scope.ownerId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("setTransactionPaid error:", error);
    return fail("Não foi possível atualizar o lançamento.");
  }

  revalidatePath("/", "layout");
  return ok({ status });
}

const restoreSchema = z.object({
  kind: z.enum([
    "transaction",
    "notebook",
    "category",
    "account",
    "recurring_bill",
    "investment",
    "investment_movement",
  ]),
  id: uuidSchema,
});

const TABLE_BY_KIND = {
  transaction: "transactions",
  notebook: "notebooks",
  category: "finance_categories",
  account: "finance_accounts",
  recurring_bill: "finance_recurring_bills",
  investment: "finance_investments",
  investment_movement: "finance_investment_movements",
} as const;

export type RestorableFinanceKind = z.infer<typeof restoreSchema>["kind"];

// Restaurar um movimento de investimento não pode deixar o saldo negativo em nenhuma data.
// Devolve a mensagem de erro, ou null se pode restaurar.
async function investmentMovementRestoreError(ownerId: string, movementId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("finance_investment_movements")
    .select("investment_id, kind, date, amount_cents")
    .eq("id", movementId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) console.error("investmentMovementRestoreError error:", error);
  if (!row || !isMovementKind(row.kind)) return "Não foi possível desfazer.";

  const loaded = await loadInvestmentState(ownerId, row.investment_id, [row.date]);
  if (!loaded.ok) return loaded.error;
  const state = loaded.data;
  const restored = { date: row.date, kind: row.kind, amountCents: row.amount_cents };
  const date = newOverdrawnDate(state, [...movementsWithout(state, movementId), restored]);
  return date ? `Não dá para desfazer: o saldo ficaria negativo em ${formatDayMonth(date, state.today)}.` : null;
}

export async function restoreFinanceItem(kind: RestorableFinanceKind, itemId: string): Promise<ActionResult> {
  const scope = await getFinanceScope();
  const parsed = restoreSchema.safeParse({ kind, id: itemId });
  if (!parsed.success) return fail("Item inválido.");
  if (parsed.data.kind === "notebook") {
    const denied = assertLedgerAllowed(scope, "trustcare");
    if (denied) return fail(denied);
  }

  if (parsed.data.kind === "investment_movement") {
    const blocker = await investmentMovementRestoreError(scope.ownerId, parsed.data.id);
    if (blocker) return fail(blocker);
  }

  const supabase = await createClient();
  const { data: restored, error } =
    parsed.data.kind === "recurring_bill"
      ? await supabase
          .from("finance_recurring_bills")
          .update({ deleted_at: null, active: true })
          .eq("id", parsed.data.id)
          .eq("user_id", scope.ownerId)
          .select("id")
      : await supabase
          .from(TABLE_BY_KIND[parsed.data.kind])
          .update({ deleted_at: null })
          .eq("id", parsed.data.id)
          .eq("user_id", scope.ownerId)
          .select("id");
  // Sem linha alterada = item que não existe mais ou que quem está logado não pode ver (RLS).
  if (error || !restored || restored.length === 0) {
    if (error) console.error("restoreFinanceItem error:", error);
    return fail("Não foi possível desfazer.");
  }

  // Uma entrada pessoal restaurada muda a base do Dízimo do mês, como acontece ao excluir.
  if (parsed.data.kind === "transaction") {
    const { data } = await supabase
      .from("transactions")
      .select("ledger, kind, date")
      .eq("id", parsed.data.id)
      .eq("user_id", scope.ownerId)
      .maybeSingle();
    if (data?.ledger === "pessoal" && data.kind === "income") {
      await ensureMonthBills(scope.ownerId, monthKey(data.date));
    }
  }

  revalidatePath("/", "layout");
  return ok();
}
