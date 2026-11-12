"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ensureMonthBills } from "@/lib/data/finance-family";
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
  const user = await getCurrentUser();
  if (!uuidSchema.safeParse(transactionId).success) return fail("Lançamento inválido.");

  const status = paid ? "paid" : "pending";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ status, paid_at: paid ? todayIso() : null, updated_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("user_id", user.id)
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
  kind: z.enum(["transaction", "notebook", "category", "account", "recurring_bill"]),
  id: uuidSchema,
});

const TABLE_BY_KIND = {
  transaction: "transactions",
  notebook: "notebooks",
  category: "finance_categories",
  account: "finance_accounts",
  recurring_bill: "finance_recurring_bills",
} as const;

export type RestorableFinanceKind = z.infer<typeof restoreSchema>["kind"];

export async function restoreFinanceItem(kind: RestorableFinanceKind, itemId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = restoreSchema.safeParse({ kind, id: itemId });
  if (!parsed.success) return fail("Item inválido.");

  const supabase = await createClient();
  const { error } =
    parsed.data.kind === "recurring_bill"
      ? await supabase
          .from("finance_recurring_bills")
          .update({ deleted_at: null, active: true })
          .eq("id", parsed.data.id)
          .eq("user_id", user.id)
      : await supabase
          .from(TABLE_BY_KIND[parsed.data.kind])
          .update({ deleted_at: null })
          .eq("id", parsed.data.id)
          .eq("user_id", user.id);
  if (error) {
    console.error("restoreFinanceItem error:", error);
    return fail("Não foi possível desfazer.");
  }

  // Uma entrada pessoal restaurada muda a base do Dízimo do mês, como acontece ao excluir.
  if (parsed.data.kind === "transaction") {
    const { data } = await supabase
      .from("transactions")
      .select("ledger, kind, date")
      .eq("id", parsed.data.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.ledger === "pessoal" && data.kind === "income") {
      await ensureMonthBills(user.id, monthKey(data.date));
    }
  }

  revalidatePath("/", "layout");
  return ok();
}
