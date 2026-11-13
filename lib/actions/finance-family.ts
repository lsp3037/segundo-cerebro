"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ensureMonthBills } from "@/lib/data/finance-family";
import { todayIso } from "@/lib/dates";
import { HOUSEHOLD_TEMPLATE } from "@/lib/finance/household-template";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const uuidSchema = z.string().uuid("ID inválido.");
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido.");

// ---------------------------------------------------------------------------
// Baixa Rápida (Pago <-> Pendente)
// ---------------------------------------------------------------------------

export async function toggleTransactionPaid(transactionId: string): Promise<ActionResult<{ status: string }>> {
  const user = await getCurrentUser();
  if (!uuidSchema.safeParse(transactionId).success) return fail("Lançamento inválido.");

  const supabase = await createClient();
  const { data: current, error: fetchErr } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !current) return fail("Lançamento não encontrado.");

  const nextStatus = current.status === "paid" ? "pending" : "paid";
  const nextPaidAt = nextStatus === "paid" ? todayIso() : null;

  const { error } = await supabase
    .from("transactions")
    .update({
      status: nextStatus,
      paid_at: nextPaidAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    console.error("toggleTransactionPaid error:", error);
    return fail("Não foi possível atualizar o status.");
  }

  revalidatePath("/", "layout");
  return ok({ status: nextStatus });
}

// ---------------------------------------------------------------------------
// Contas Bancárias & Cartões de Crédito
// ---------------------------------------------------------------------------

const accountSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, "Informe o nome da conta ou cartão.").max(100),
  type: z.enum(["checking", "savings", "cash", "credit_card"]),
  owner_label: z.string().trim().max(40).nullable().optional(),
  opening_balance_cents: z.number().int().optional(),
  credit_limit_cents: z.number().int().min(0).nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
});

export type FinanceAccountInput = z.infer<typeof accountSchema>;

export async function saveFinanceAccount(input: FinanceAccountInput): Promise<ActionResult<Tables<"finance_accounts">>> {
  const user = await getCurrentUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const d = parsed.data;

  const payload = {
    name: d.name,
    type: d.type,
    owner_label: d.owner_label || null,
    opening_balance_cents: d.opening_balance_cents ?? 0,
    credit_limit_cents: d.type === "credit_card" ? (d.credit_limit_cents ?? null) : null,
    due_day: d.type === "credit_card" ? (d.due_day ?? null) : null,
    updated_at: new Date().toISOString(),
  };

  if (d.id) {
    const { data, error } = await supabase
      .from("finance_accounts")
      .update(payload)
      .eq("id", d.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("updateFinanceAccount error:", error);
      return fail("Não foi possível atualizar a conta.");
    }
    revalidatePath("/", "layout");
    return ok(data);
  }

  const { data, error } = await supabase
    .from("finance_accounts")
    .insert({ ...payload, user_id: user.id })
    .select("*")
    .single();

  if (error) {
    console.error("createFinanceAccount error:", error);
    return fail("Não foi possível criar a conta.");
  }

  revalidatePath("/", "layout");
  return ok(data);
}

export async function deleteFinanceAccount(accountId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!uuidSchema.safeParse(accountId).success) return fail("Conta inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteFinanceAccount error:", error);
    return fail("Não foi possível remover a conta.");
  }

  revalidatePath("/", "layout");
  return ok();
}

const transferSchema = z.object({
  fromAccountId: uuidSchema,
  toAccountId: uuidSchema,
  amount_cents: z.number().int().positive("Informe um valor maior que zero."),
});

export async function transferBetweenAccounts(input: z.infer<typeof transferSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { fromAccountId, toAccountId, amount_cents } = parsed.data;
  if (fromAccountId === toAccountId) return fail("Escolha contas diferentes.");

  const supabase = await createClient();
  const { data: accounts, error: fetchErr } = await supabase
    .from("finance_accounts")
    .select("id, type, opening_balance_cents")
    .in("id", [fromAccountId, toAccountId])
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (fetchErr || !accounts || accounts.length !== 2) {
    return fail("Contas não encontradas.");
  }

  const fromAcc = accounts.find((a) => a.id === fromAccountId);
  const toAcc = accounts.find((a) => a.id === toAccountId);
  if (!fromAcc || !toAcc || fromAcc.type === "credit_card" || toAcc.type === "credit_card") {
    return fail("Transferência válida apenas entre contas/reserva.");
  }

  const now = new Date().toISOString();
  const [res1, res2] = await Promise.all([
    supabase
      .from("finance_accounts")
      .update({ opening_balance_cents: fromAcc.opening_balance_cents - amount_cents, updated_at: now })
      .eq("id", fromAccountId)
      .eq("user_id", user.id),
    supabase
      .from("finance_accounts")
      .update({ opening_balance_cents: toAcc.opening_balance_cents + amount_cents, updated_at: now })
      .eq("id", toAccountId)
      .eq("user_id", user.id),
  ]);

  if (res1.error || res2.error) {
    console.error("transferBetweenAccounts error:", res1.error || res2.error);
    return fail("Não foi possível transferir entre as contas.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Orçamentos / Metas por Categoria
// ---------------------------------------------------------------------------

const budgetSchema = z.object({
  category_id: uuidSchema,
  amount_cents: z.number().int().positive("A meta deve ser maior que R$ 0,00."),
});

export async function upsertBudget(input: z.infer<typeof budgetSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("finance_budgets").upsert(
    {
      user_id: user.id,
      category_id: parsed.data.category_id,
      amount_cents: parsed.data.amount_cents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,category_id" },
  );

  if (error) {
    console.error("upsertBudget error:", error);
    return fail("Não foi possível salvar a meta.");
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteBudget(categoryId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!uuidSchema.safeParse(categoryId).success) return fail("Categoria inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_budgets")
    .delete()
    .eq("category_id", categoryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteBudget error:", error);
    return fail("Não foi possível remover a meta.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Contas Fixas Recorrentes & Modelo da Planilha da Casa
// ---------------------------------------------------------------------------

const recurringBillSchema = z.object({
  id: uuidSchema.optional(),
  kind: z.enum(["income", "expense"]),
  description: z.string().trim().min(1, "Informe a descrição.").max(160),
  amount_mode: z.enum(["fixed", "percent_of_income"]),
  amount_cents: z.number().int().min(0),
  percent_bp: z.number().int().min(1).max(10000).nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  category_id: uuidSchema.nullable().optional(),
  account_id: uuidSchema.nullable().optional(),
  member_label: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().optional(),
  month: monthSchema.optional(),
});

export type RecurringBillInput = z.infer<typeof recurringBillSchema>;

export async function saveRecurringBill(input: RecurringBillInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = recurringBillSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const d = parsed.data;
  if (d.amount_mode === "percent_of_income" && (!d.percent_bp || d.kind !== "expense")) {
    return fail("Informe o percentual válido para despesa.");
  }

  const supabase = await createClient();
  const payload = {
    kind: d.kind,
    description: d.description,
    amount_mode: d.amount_mode,
    amount_cents: d.amount_mode === "fixed" ? d.amount_cents : 0,
    percent_bp: d.amount_mode === "percent_of_income" ? d.percent_bp! : null,
    due_day: d.due_day ?? null,
    category_id: d.category_id ?? null,
    account_id: d.account_id ?? null,
    member_label: d.member_label || null,
    active: d.active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (d.id) {
    const { error } = await supabase
      .from("finance_recurring_bills")
      .update(payload)
      .eq("id", d.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("updateRecurringBill error:", error);
      return fail("Não foi possível atualizar a conta fixa.");
    }
  } else {
    const { error } = await supabase.from("finance_recurring_bills").insert({ ...payload, user_id: user.id });
    if (error) {
      console.error("createRecurringBill error:", error);
      return fail("Não foi possível salvar a conta fixa.");
    }
  }

  if (d.month) {
    await ensureMonthBills(user.id, d.month);
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteRecurringBill(billId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!uuidSchema.safeParse(billId).success) return fail("Conta fixa inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_recurring_bills")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", billId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteRecurringBill error:", error);
    return fail("Não foi possível remover a conta fixa.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// Carrega o modelo da planilha da casa (contas, os 4 cartões e as 19 linhas fixas/variáveis) sem duplicar
export async function bootstrapHouseholdTemplate(month: string): Promise<ActionResult<{ createdCount: number }>> {
  const user = await getCurrentUser();
  if (!monthSchema.safeParse(month).success) return fail("Mês inválido.");

  const supabase = await createClient();

  const [catsRes, accRes, billsRes] = await Promise.all([
    supabase.from("finance_categories").select("id, name, ledger, kind").eq("user_id", user.id).is("deleted_at", null),
    supabase.from("finance_accounts").select("id, name").eq("user_id", user.id).is("deleted_at", null),
    supabase.from("finance_recurring_bills").select("id, description").eq("user_id", user.id).is("deleted_at", null),
  ]);

  const catsMap = new Map(
    (catsRes.data ?? [])
      .filter((c) => c.ledger === "pessoal")
      .map((c) => [`${c.kind}:${c.name.trim().toLowerCase()}`, c.id]),
  );

  const accByName = new Map((accRes.data ?? []).map((a) => [a.name.trim().toLowerCase(), a.id]));
  const existingBillNames = new Set((billsRes.data ?? []).map((b) => b.description.trim().toLowerCase()));

  // 1. Garante contas bancárias base + os 4 cartões do modelo
  const seedAccounts: Array<{
    name: string;
    type: "checking" | "savings" | "credit_card";
    owner_label: string;
    due_day: number | null;
  }> = [
    { name: "Conta Principal (Casa)", type: "checking", owner_label: "Casa", due_day: null },
    { name: "Reserva da Família", type: "savings", owner_label: "Casa", due_day: null },
    ...HOUSEHOLD_TEMPLATE.filter((r) => r.isCard).map((r) => ({
      name: r.description,
      type: "credit_card" as const,
      owner_label: r.member ?? "Casa",
      due_day: r.dueDay,
    })),
  ];

  const missingAccounts = seedAccounts.filter((a) => !accByName.has(a.name.toLowerCase()));
  if (missingAccounts.length > 0) {
    const { data: insertedAcc } = await supabase
      .from("finance_accounts")
      .insert(missingAccounts.map((a, idx) => ({ ...a, user_id: user.id, sort_order: idx })))
      .select("id, name");

    for (const a of insertedAcc ?? []) {
      accByName.set(a.name.trim().toLowerCase(), a.id);
    }
  }

  // 2. Insere as contas/receitas fixas do modelo ainda não cadastradas (com valor 0 para Luan preencher)
  const missingBills = HOUSEHOLD_TEMPLATE.filter((r) => !existingBillNames.has(r.description.toLowerCase()));
  if (missingBills.length > 0) {
    const rows = missingBills.map((r, idx) => ({
      user_id: user.id,
      kind: r.kind,
      description: r.description,
      amount_mode: r.percentBp ? "percent_of_income" : "fixed",
      amount_cents: 0,
      percent_bp: r.percentBp ?? null,
      due_day: r.dueDay,
      category_id: catsMap.get(`${r.kind}:${r.categoryName.toLowerCase()}`) ?? null,
      account_id: r.isCard ? (accByName.get(r.description.toLowerCase()) ?? null) : null,
      member_label: r.member,
      active: true,
      sort_order: idx,
    }));

    const { error } = await supabase.from("finance_recurring_bills").insert(rows);
    if (error) {
      console.error("bootstrapHouseholdTemplate error:", error);
      return fail("Não foi possível carregar o modelo da planilha.");
    }
  }

  await ensureMonthBills(user.id, month);
  revalidatePath("/", "layout");
  return ok({ createdCount: missingBills.length });
}

// Atualiza rapidamente os valores das contas fixas e já gera no mês escolhido
const bulkValuesSchema = z.object({
  month: monthSchema,
  items: z.array(
    z.object({
      id: uuidSchema,
      amount_cents: z.number().int().min(0),
      due_day: z.number().int().min(1).max(31).nullable().optional(),
      active: z.boolean().optional(),
    }),
  ),
});

export async function saveRecurringValuesBatch(input: z.infer<typeof bulkValuesSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = bulkValuesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const now = new Date().toISOString();

  for (const item of parsed.data.items) {
    await supabase
      .from("finance_recurring_bills")
      .update({
        amount_cents: item.amount_cents,
        due_day: item.due_day ?? null,
        active: item.active ?? true,
        updated_at: now,
      })
      .eq("id", item.id)
      .eq("user_id", user.id);
  }

  await ensureMonthBills(user.id, parsed.data.month, { syncPendingFixed: true });
  revalidatePath("/", "layout");
  return ok();
}

export async function syncMonthTithe(month: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!monthSchema.safeParse(month).success) return fail("Mês inválido.");

  const supabase = await createClient();
  const { data: existingPercent } = await supabase
    .from("finance_recurring_bills")
    .select("id")
    .eq("user_id", user.id)
    .eq("amount_mode", "percent_of_income")
    .is("deleted_at", null)
    .limit(1);

  if (!existingPercent || existingPercent.length === 0) {
    const { data: titheCat } = await supabase
      .from("finance_categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("ledger", "pessoal")
      .eq("kind", "expense")
      .ilike("name", "%dízimo%")
      .is("deleted_at", null)
      .limit(1);

    const { error } = await supabase.from("finance_recurring_bills").insert({
      user_id: user.id,
      kind: "expense",
      description: "Dízimo",
      amount_mode: "percent_of_income",
      amount_cents: 0,
      percent_bp: 1000,
      due_day: null,
      category_id: titheCat?.[0]?.id ?? null,
      member_label: "Casa",
      active: true,
    });
    if (error) {
      console.error("syncMonthTithe error:", error);
      return fail("Não foi possível ativar o Dízimo automático.");
    }
  }

  const { titheTouched } = await ensureMonthBills(user.id, month, { allowPastTithe: true });
  revalidatePath("/", "layout");
  if (!titheTouched) {
    return fail("Nenhuma diferença de Dízimo para gerar neste mês.");
  }
  return ok();
}
