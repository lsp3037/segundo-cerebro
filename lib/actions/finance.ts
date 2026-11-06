"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
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
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export async function createTransaction(input: TransactionInput): Promise<ActionResult<Tables<"transactions">>> {
  const user = await getCurrentUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      ledger: parsed.data.ledger,
      kind: parsed.data.kind,
      amount_cents: parsed.data.amount_cents,
      date: parsed.data.date,
      description: parsed.data.description,
      category_id: parsed.data.category_id ?? null,
      payment_method_id: parsed.data.payment_method_id ?? null,
      notebook_id: parsed.data.notebook_id ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createTransaction error:", error);
    return fail("Não foi possível salvar o lançamento.");
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

  const parsed = transactionSchema.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...parsed.data,
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

  revalidatePath("/", "layout");
  return ok(data);
}

export async function trashTransaction(transactionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!id.safeParse(transactionId).success) return fail("Lançamento inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    console.error("trashTransaction error:", error);
    return fail("Não foi possível excluir o lançamento.");
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
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type NotebookInput = z.infer<typeof notebookSchema>;

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
    await supabase.from("transactions").insert({
      user_id: user.id,
      ledger: "trustcare",
      kind: "expense",
      amount_cents: initialPurchase.amount_cents,
      date: initialPurchase.date,
      description: `Compra notebook ${notebook.brand ? `${notebook.brand} ` : ""}${notebook.model}`,
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
