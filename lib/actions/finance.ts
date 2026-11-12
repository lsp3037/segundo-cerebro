"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ensureMonthBills } from "@/lib/data/finance-family";
import { addMonths, todayIso } from "@/lib/dates";
import { monthKey, splitInstallments } from "@/lib/finance/household";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.string().uuid("ID inválido.");

// ---------------------------------------------------------------------------
// Transações (Lançamentos)
// ---------------------------------------------------------------------------

const transactionSchema = z.object({
  ledger: z.enum(["pessoal", "trustcare"]),
  kind: z.enum(["income", "expense"]),
  amount_cents: z.number().int().positive("O valor deve ser maior que zero."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD."),
  description: z.string().trim().min(1, "Informe a descrição do lançamento.").max(300),
  category_id: z.string().uuid().nullable().optional(),
  payment_method_id: z.string().uuid().nullable().optional(),
  notebook_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["paid", "pending"]).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  member_label: z.string().trim().max(40).nullable().optional(),
  installment_total: z.number().int().min(2).max(120).optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export async function createTransaction(input: TransactionInput): Promise<ActionResult<Tables<"transactions">>> {
  const user = await getCurrentUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const d = parsed.data;
  const status = d.status ?? "paid";
  const basePaidAt = status === "paid" ? (d.paid_at ?? todayIso()) : null;

  // Compra parcelada (2x a 120x): gera uma linha por mês mantendo o total exato
  if (d.installment_total && d.installment_total >= 2) {
    const parts = splitInstallments(d.amount_cents, d.installment_total);
    const groupId = crypto.randomUUID();
    const rows: TablesInsert<"transactions">[] = parts.map((amount, idx) => {
      const firstPaid = idx === 0 && status === "paid";
      return {
        user_id: user.id,
        ledger: d.ledger,
        kind: d.kind,
        amount_cents: amount,
        date: addMonths(d.date, idx),
        due_date: d.due_date ? addMonths(d.due_date, idx) : addMonths(d.date, idx),
        paid_at: firstPaid ? basePaidAt : null,
        status: firstPaid ? "paid" : "pending",
        description: `${d.description} (${idx + 1}/${d.installment_total})`,
        category_id: d.category_id ?? null,
        payment_method_id: d.payment_method_id ?? null,
        account_id: d.account_id ?? null,
        member_label: d.member_label ?? null,
        notebook_id: d.notebook_id ?? null,
        notes: d.notes ?? null,
        installment_group_id: groupId,
        installment_index: idx + 1,
        installment_total: d.installment_total,
      };
    });

    const { data, error } = await supabase.from("transactions").insert(rows).select("*");
    if (error || !data || data.length === 0) {
      console.error("createTransaction (installments) error:", error);
      return fail("Não foi possível salvar as parcelas.");
    }

    if (d.ledger === "pessoal" && d.kind === "income") {
      await ensureMonthBills(user.id, monthKey(d.date));
    }

    revalidatePath("/", "layout");
    return ok(data[0]);
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      ledger: d.ledger,
      kind: d.kind,
      amount_cents: d.amount_cents,
      date: d.date,
      due_date: d.due_date ?? null,
      paid_at: basePaidAt,
      status,
      description: d.description,
      category_id: d.category_id ?? null,
      payment_method_id: d.payment_method_id ?? null,
      account_id: d.account_id ?? null,
      member_label: d.member_label ?? null,
      notebook_id: d.notebook_id ?? null,
      notes: d.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createTransaction error:", error);
    return fail("Não foi possível salvar o lançamento.");
  }

  if (d.ledger === "pessoal" && d.kind === "income") {
    await ensureMonthBills(user.id, monthKey(d.date));
  }

  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateTransaction(
  transactionId: string,
  patch: Partial<TransactionInput>,
): Promise<ActionResult<Tables<"transactions">>> {
  const user = await getCurrentUser();
  if (!id.safeParse(transactionId).success) return fail("Lançamento inválido.");

  const parsed = transactionSchema.omit({ installment_total: true }).partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const nextPatch = { ...parsed.data };
  if (nextPatch.status === "paid" && nextPatch.paid_at === undefined) {
    nextPatch.paid_at = todayIso();
  } else if (nextPatch.status === "pending") {
    nextPatch.paid_at = null;
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...nextPatch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("updateTransaction error:", error);
    return fail("Não foi possível atualizar o lançamento.");
  }

  if (data.ledger === "pessoal" && data.kind === "income") {
    await ensureMonthBills(user.id, monthKey(data.date));
  }

  revalidatePath("/", "layout");
  return ok(data);
}

export async function trashTransaction(transactionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!id.safeParse(transactionId).success) return fail("Lançamento inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .select("ledger, kind, date")
    .maybeSingle();

  if (error) {
    console.error("trashTransaction error:", error);
    return fail("Não foi possível excluir o lançamento.");
  }

  if (data?.ledger === "pessoal" && data.kind === "income") {
    await ensureMonthBills(user.id, monthKey(data.date));
  }

  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Notebooks (Revenda e Lucro por Unidade • Trust Care)
// ---------------------------------------------------------------------------

const notebookSchema = z.object({
  model: z.string().trim().min(1, "Informe o modelo do notebook.").max(120),
  brand: z.string().trim().max(60).nullable().optional(),
  specs: z.string().trim().max(300).nullable().optional(),
  status: z.enum(["bought", "repair", "for_sale", "sold"]).default("bought"),
  asking_price_cents: z.number().int().min(0).nullable().optional(),
  buyer_name: z.string().trim().max(120).nullable().optional(),
  buyer_contact: z.string().trim().max(80).nullable().optional(),
  warranty_days: z.number().int().min(0).max(1825).default(90).optional(),
  sold_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable().optional(),
  machine_fee_cents: z.number().int().min(0).default(0).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type NotebookInput = z.input<typeof notebookSchema>;

export async function createNotebook(
  input: NotebookInput,
  initialPurchase?: {
    amount_cents: number;
    date: string;
    payment_method_id?: string | null;
  },
): Promise<ActionResult<Tables<"notebooks">>> {
  const user = await getCurrentUser();
  const parsed = notebookSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();

  const { data: notebook, error } = await supabase
    .from("notebooks")
    .insert({
      user_id: user.id,
      model: parsed.data.model,
      brand: parsed.data.brand ?? null,
      specs: parsed.data.specs ?? null,
      status: parsed.data.status,
      asking_price_cents: parsed.data.asking_price_cents ?? null,
      warranty_days: parsed.data.warranty_days ?? 90,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !notebook) {
    console.error("createNotebook error:", error);
    return fail("Não foi possível cadastrar o notebook.");
  }

  // Se houver valor inicial de compra informado, já cria o lançamento de despesa vinculado
  if (initialPurchase && initialPurchase.amount_cents > 0) {
    const { data: stockCat } = await supabase
      .from("finance_categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("ledger", "trustcare")
      .eq("kind", "expense")
      .ilike("name", "%estoque%")
      .limit(1)
      .maybeSingle();

    await supabase.from("transactions").insert({
      user_id: user.id,
      ledger: "trustcare",
      kind: "expense",
      amount_cents: initialPurchase.amount_cents,
      date: initialPurchase.date,
      description: `Compra notebook ${notebook.brand ? `${notebook.brand} ` : ""}${notebook.model}`,
      category_id: stockCat?.id ?? null,
      notebook_id: notebook.id,
      payment_method_id: initialPurchase.payment_method_id ?? null,
    });
  }

  revalidatePath("/", "layout");
  return ok(notebook);
}

export async function updateNotebook(
  notebookId: string,
  patch: Partial<NotebookInput>,
): Promise<ActionResult<Tables<"notebooks">>> {
  const user = await getCurrentUser();
  if (!id.safeParse(notebookId).success) return fail("Notebook inválido.");

  const parsed = notebookSchema.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notebooks")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", notebookId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("updateNotebook error:", error);
    return fail("Não foi possível atualizar o notebook.");
  }

  revalidatePath("/", "layout");
  return ok(data);
}

const recordSaleSchema = z.object({
  notebook_id: z.string().uuid("ID de notebook inválido"),
  sold_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de venda inválida"),
  sale_amount_cents: z.number().int().positive("Valor de venda deve ser maior que zero"),
  payment_method_id: z.string().uuid().nullable().optional(),
  machine_fee_cents: z.number().int().min(0).default(0),
  buyer_name: z.string().trim().max(120).nullable().optional(),
  buyer_contact: z.string().trim().max(80).nullable().optional(),
  warranty_days: z.number().int().min(0).max(1825).default(90),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type RecordSaleInput = z.infer<typeof recordSaleSchema>;

export async function recordNotebookSale(
  input: RecordSaleInput,
): Promise<ActionResult<Tables<"notebooks">>> {
  const user = await getCurrentUser();
  const parsed = recordSaleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();

  // 1. Busca o notebook
  const { data: nb, error: nbErr } = await supabase
    .from("notebooks")
    .select("*")
    .eq("id", parsed.data.notebook_id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (nbErr || !nb) return fail("Notebook não encontrado.");

  // 2. Atualiza os dados de venda no notebook
  const { data: updatedNotebook, error: updateErr } = await supabase
    .from("notebooks")
    .update({
      status: "sold",
      sold_at: parsed.data.sold_at,
      buyer_name: parsed.data.buyer_name || null,
      buyer_contact: parsed.data.buyer_contact || null,
      warranty_days: parsed.data.warranty_days,
      machine_fee_cents: parsed.data.machine_fee_cents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nb.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateErr || !updatedNotebook) {
    console.error("recordNotebookSale updateErr:", updateErr);
    return fail("Não foi possível atualizar o status do notebook.");
  }

  // 3. Busca categoria de receita "Venda de Notebooks" da Trust Care
  const { data: saleCat } = await supabase
    .from("finance_categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("ledger", "trustcare")
    .eq("kind", "income")
    .ilike("name", "%notebook%")
    .limit(1)
    .maybeSingle();

  // 4. Cria o lançamento de receita da venda
  const nbTitle = nb.brand ? `${nb.brand} ${nb.model}` : nb.model;
  const warrantyDesc = `Garantia: ${parsed.data.warranty_days} dias`;
  const buyerDesc = parsed.data.buyer_name ? `Comprador: ${parsed.data.buyer_name}` : "";
  const saleNotesCombined = [buyerDesc, warrantyDesc, parsed.data.notes].filter(Boolean).join(" | ");

  await supabase.from("transactions").insert({
    user_id: user.id,
    ledger: "trustcare",
    kind: "income",
    amount_cents: parsed.data.sale_amount_cents,
    date: parsed.data.sold_at,
    description: `Venda notebook: ${nbTitle}`,
    category_id: saleCat?.id ?? null,
    payment_method_id: parsed.data.payment_method_id ?? null,
    notebook_id: nb.id,
    notes: saleNotesCombined || null,
  });

  // 5. Se houver taxa de maquininha, cria lançamento de despesa financeira vinculado
  if (parsed.data.machine_fee_cents > 0) {
    const { data: feeCat } = await supabase
      .from("finance_categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("ledger", "trustcare")
      .eq("kind", "expense")
      .ilike("name", "%taxa%")
      .limit(1)
      .maybeSingle();

    await supabase.from("transactions").insert({
      user_id: user.id,
      ledger: "trustcare",
      kind: "expense",
      amount_cents: parsed.data.machine_fee_cents,
      date: parsed.data.sold_at,
      description: `Taxa maquininha: ${nbTitle}`,
      category_id: feeCat?.id ?? null,
      payment_method_id: parsed.data.payment_method_id ?? null,
      notebook_id: nb.id,
      notes: "Taxa de intermediação de cartão sobre a venda",
    });
  }

  revalidatePath("/", "layout");
  return ok(updatedNotebook);
}

export async function trashNotebook(notebookId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!id.safeParse(notebookId).success) return fail("Notebook inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notebooks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", notebookId)
    .eq("user_id", user.id);

  if (error) {
    console.error("trashNotebook error:", error);
    return fail("Não foi possível excluir o notebook.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Categorias de Finanças
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  ledger: z.enum(["pessoal", "trustcare"]),
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(1, "Informe o nome da categoria.").max(80),
  color: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export async function createFinanceCategory(input: CategoryInput): Promise<ActionResult<Tables<"finance_categories">>> {
  const user = await getCurrentUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_categories")
    .insert({
      user_id: user.id,
      ledger: parsed.data.ledger,
      kind: parsed.data.kind,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createFinanceCategory error:", error);
    return fail("Não foi possível criar a categoria.");
  }

  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateFinanceCategory(
  categoryId: string,
  patch: Partial<CategoryInput>
): Promise<ActionResult<Tables<"finance_categories">>> {
  const user = await getCurrentUser();
  if (!id.safeParse(categoryId).success) return fail("Categoria inválida.");

  const parsed = categorySchema.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_categories")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", categoryId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("updateFinanceCategory error:", error);
    return fail("Não foi possível atualizar a categoria.");
  }

  revalidatePath("/", "layout");
  return ok(data);
}

export async function trashFinanceCategory(categoryId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!id.safeParse(categoryId).success) return fail("Categoria inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", categoryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("trashFinanceCategory error:", error);
    return fail("Não foi possível excluir a categoria.");
  }

  revalidatePath("/", "layout");
  return ok();
}
