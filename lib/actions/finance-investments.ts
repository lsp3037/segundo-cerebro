"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { addDays, todayIso } from "@/lib/dates";
import { serializeRateChanges, type RateEntry } from "@/lib/finance/investments";
import type { InvestmentRateInput, SaveInvestmentInput } from "@/lib/finance/investments-data";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

// Arquivo "use server": só exporta funções assíncronas (schemas e constantes ficam internos).

const MAX_PERCENT = 1000;
const MAX_TIERS = 10;

const uuidSchema = z.string().uuid("ID inválido.");

// "AAAA-MM-DD" que existe no calendário (recusa 2026-02-31).
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((iso) => addDays(iso, 0) === iso, "Data inválida.");

const percentSchema = z
  .number({ error: "Informe o percentual." })
  .min(0, "O percentual não pode ser negativo.")
  .max(MAX_PERCENT, `O percentual vai até ${MAX_PERCENT}%.`);

const tierSchema = z.object({
  upToCents: z.number().int().positive("O teto da faixa deve ser maior que zero.").nullable(),
  ofCdiPercent: percentSchema,
});

// Tetos em ordem crescente e só a última faixa sem teto (o que passa do último teto também rende).
const tiersSchema = z
  .array(tierSchema)
  .min(1, "Informe ao menos uma faixa.")
  .max(MAX_TIERS, `Use no máximo ${MAX_TIERS} faixas.`)
  // O zod roda os refine mesmo com a lista vazia (já barrada pelo min), por isso o `?.`.
  .refine((tiers) => tiers.at(-1)?.upToCents === null, "A última faixa não pode ter teto.")
  .refine(
    (tiers) => tiers.slice(0, -1).every((tier, index) => tier.upToCents !== null && (index === 0 || tier.upToCents > tiers[index - 1].upToCents!)),
    "Os tetos das faixas devem crescer, e só a última fica sem teto.",
  );

const rateSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({ mode: z.literal("cdi"), tiers: tiersSchema }),
    z.object({ mode: z.literal("annual"), annualPercent: percentSchema }),
  ],
  { error: "Escolha o tipo de taxa." },
);

const saveInvestmentSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, "Informe o nome do investimento.").max(100, "Use até 100 caracteres no nome."),
  ownerLabel: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(1000, "Use até 1000 caracteres nas observações.").nullable().optional(),
  initial: z
    .object({
      amountCents: z.number().int().positive("Informe quanto você tem lá hoje."),
      date: isoDateSchema,
    })
    .optional(),
  rate: rateSchema.optional(),
});

type ParsedInvestment = z.infer<typeof saveInvestmentSchema>;

function toRateEntry(rate: InvestmentRateInput, from: string): RateEntry {
  return rate.mode === "cdi" ? { from, mode: "cdi", tiers: rate.tiers } : { from, mode: "annual", annualPercent: rate.annualPercent };
}

function investmentFields(d: ParsedInvestment) {
  return {
    name: d.name,
    owner_label: d.ownerLabel || null,
    // Na edição, observação ausente mantém a atual.
    ...(d.notes !== undefined && { notes: d.notes || null }),
  };
}

async function updateInvestment(userId: string, id: string, d: ParsedInvestment): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investments")
    .update({ ...investmentFields(d), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("updateInvestment error:", error);
    return fail("Não foi possível atualizar o investimento.");
  }
  if (!data) return fail("Investimento não encontrado.");
  return ok({ id: data.id });
}

// Cria o investimento e o primeiro aporte ("quanto tem lá hoje"). Se o aporte falhar, desfaz o investimento.
async function createInvestment(userId: string, d: ParsedInvestment): Promise<ActionResult<{ id: string }>> {
  if (!d.rate) return fail("Informe a taxa do investimento.");
  if (!d.initial) return fail("Informe quanto você tem lá hoje e desde quando.");
  if (d.initial.date > todayIso()) return fail("A data não pode ser no futuro.");

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("finance_investments")
    .insert({
      ...investmentFields(d),
      user_id: userId,
      rate_changes: serializeRateChanges([toRateEntry(d.rate, d.initial.date)]),
    })
    .select("id")
    .single();
  if (error) {
    console.error("createInvestment error:", error);
    return fail("Não foi possível criar o investimento.");
  }

  const { error: movementError } = await supabase.from("finance_investment_movements").insert({
    user_id: userId,
    investment_id: created.id,
    kind: "deposit",
    date: d.initial.date,
    amount_cents: d.initial.amountCents,
  });
  if (movementError) {
    console.error("createInvestment initial deposit error:", movementError);
    await supabase.from("finance_investments").delete().eq("id", created.id).eq("user_id", userId);
    return fail("Não foi possível registrar o valor inicial do investimento.");
  }
  return ok({ id: created.id });
}

export async function saveInvestment(input: SaveInvestmentInput): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  const parsed = saveInvestmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const result = parsed.data.id
    ? await updateInvestment(user.id, parsed.data.id, parsed.data)
    : await createInvestment(user.id, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// Vai para a lixeira (deleted_at); o "Desfazer" usa `restoreFinanceItem("investment", id)`.
export async function deleteInvestment(investmentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!uuidSchema.safeParse(investmentId).success) return fail("Investimento inválido.");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("finance_investments")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", investmentId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("deleteInvestment error:", error);
    return fail("Não foi possível remover o investimento.");
  }
  if (!data) return fail("Investimento não encontrado.");

  revalidatePath("/", "layout");
  return ok();
}
