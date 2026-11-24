"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getFinanceScope } from "@/lib/finance/scope";
import {
  formatDayMonth,
  loadInvestmentState,
  movementsWithout,
  newOverdrawnDate,
  valueOn,
  type InvestmentState,
} from "@/lib/data/finance-investment-state";
import { addDays, todayIso } from "@/lib/dates";
import { serializeRateChanges, type InvestmentMovement, type MovementKind, type RateEntry } from "@/lib/finance/investments";
import type {
  DeleteInvestmentRateInput,
  InvestmentRateInput,
  ReconcileInvestmentInput,
  ReconcileInvestmentResult,
  SaveInvestmentInput,
  SaveInvestmentMovementInput,
  SaveInvestmentRateInput,
} from "@/lib/finance/investments-data";
import { formatCentsToBrl } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

// Arquivo "use server": só exporta funções assíncronas (schemas e constantes ficam internos).

const MAX_PERCENT = 1000;
const MAX_ANNUAL_PERCENT = 100;
// Mudança de taxa agendada: no máximo cerca de 1 ano à frente.
const MAX_RATE_DAYS_AHEAD = 366;
const MAX_TIERS = 10;
// R$ 1 bilhão: teto de sanidade para valores digitados.
const MAX_AMOUNT_CENTS = 100_000_000_000;
const RECONCILE_NOTE = "Acerto com o app";

const MOVEMENT_NOUN: Record<MovementKind, string> = { deposit: "aporte", withdrawal: "resgate", adjustment: "ajuste" };

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

const taxSchema = z.enum(["none", "regressive"], { error: "Escolha se desconta imposto de renda." }).default("none");

const rateSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({ mode: z.literal("cdi"), tax: taxSchema, tiers: tiersSchema }),
    z.object({
      mode: z.literal("annual"),
      tax: taxSchema,
      annualPercent: z
        .number({ error: "Informe a taxa ao ano." })
        .min(0, "A taxa não pode ser negativa.")
        .max(MAX_ANNUAL_PERCENT, `A taxa ao ano vai até ${MAX_ANNUAL_PERCENT}%.`),
    }),
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

const saveMovementSchema = z.object({
  id: uuidSchema.optional(),
  investmentId: uuidSchema,
  kind: z.enum(["deposit", "withdrawal"], { error: "Escolha se você guardou ou resgatou." }),
  amountCents: z
    .number({ error: "Informe o valor." })
    .int("Valor inválido.")
    .positive("O valor deve ser maior que zero.")
    .max(MAX_AMOUNT_CENTS, "Valor alto demais."),
  date: isoDateSchema,
  note: z.string().trim().max(500, "Use até 500 caracteres na observação.").nullable().optional(),
});

type ParsedMovement = z.infer<typeof saveMovementSchema>;

const reconcileSchema = z.object({
  investmentId: uuidSchema,
  appValueCents: z
    .number({ error: "Informe o valor que aparece no app." })
    .int("Valor inválido.")
    .min(0, "O valor não pode ser negativo.")
    .max(MAX_AMOUNT_CENTS, "Valor alto demais."),
});

const saveRateSchema = z.object({
  investmentId: uuidSchema,
  from: isoDateSchema,
  rate: rateSchema,
});

const deleteRateSchema = z.object({
  investmentId: uuidSchema,
  from: isoDateSchema,
});

function toRateEntry(rate: InvestmentRateInput, from: string): RateEntry {
  const tax = rate.tax ?? "none";
  return rate.mode === "cdi"
    ? { from, mode: "cdi", tax, tiers: rate.tiers }
    : { from, mode: "annual", tax, annualPercent: rate.annualPercent };
}

function investmentFields(d: ParsedInvestment) {
  return {
    name: d.name,
    owner_label: d.ownerLabel || null,
    // Na edição, observação ausente mantém a atual.
    ...(d.notes !== undefined && { notes: d.notes || null }),
  };
}

async function updateInvestment(ownerId: string, id: string, d: ParsedInvestment): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investments")
    .update({ ...investmentFields(d), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId)
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
async function createInvestment(ownerId: string, d: ParsedInvestment): Promise<ActionResult<{ id: string }>> {
  if (!d.rate) return fail("Informe a taxa do investimento.");
  if (!d.initial) return fail("Informe quanto você tem lá hoje e desde quando.");
  if (d.initial.date > todayIso()) return fail("A data não pode ser no futuro.");

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("finance_investments")
    .insert({
      ...investmentFields(d),
      user_id: ownerId,
      rate_changes: serializeRateChanges([toRateEntry(d.rate, d.initial.date)]),
    })
    .select("id")
    .single();
  if (error) {
    console.error("createInvestment error:", error);
    return fail("Não foi possível criar o investimento.");
  }

  const { error: movementError } = await supabase.from("finance_investment_movements").insert({
    user_id: ownerId,
    investment_id: created.id,
    kind: "deposit",
    date: d.initial.date,
    amount_cents: d.initial.amountCents,
  });
  if (movementError) {
    console.error("createInvestment initial deposit error:", movementError);
    await supabase.from("finance_investments").delete().eq("id", created.id).eq("user_id", ownerId);
    return fail("Não foi possível registrar o valor inicial do investimento.");
  }
  return ok({ id: created.id });
}

export async function saveInvestment(input: SaveInvestmentInput): Promise<ActionResult<{ id: string }>> {
  const scope = await getFinanceScope();
  const parsed = saveInvestmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const result = parsed.data.id
    ? await updateInvestment(scope.ownerId, parsed.data.id, parsed.data)
    : await createInvestment(scope.ownerId, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// Vai para a lixeira (deleted_at); o "Desfazer" usa `restoreFinanceItem("investment", id)`.
export async function deleteInvestment(investmentId: string): Promise<ActionResult> {
  const scope = await getFinanceScope();
  if (!uuidSchema.safeParse(investmentId).success) return fail("Investimento inválido.");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("finance_investments")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", investmentId)
    .eq("user_id", scope.ownerId)
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

// ---------------------------------------------------------------------------
// Guardei / Resgatei
// ---------------------------------------------------------------------------

// Na edição, o movimento precisa ser deste investimento, estar ativo e não ser um ajuste.
function editBlocker(state: InvestmentState, movementId: string): string | null {
  const current = state.movements.find((movement) => movement.id === movementId);
  if (!current) return "Movimento não encontrado.";
  if (current.kind === "adjustment") return 'Ajustes não podem ser editados. Exclua o ajuste e use "Acertar com o app" de novo.';
  return null;
}

// Mensagem quando a mudança deixaria o saldo negativo em alguma data; null se está tudo certo.
function movementOverdraftError(state: InvestmentState, d: ParsedMovement): string | null {
  const others = movementsWithout(state, d.id ?? null);
  const change: InvestmentMovement = { date: d.date, kind: d.kind, amountCents: d.amountCents };
  const date = newOverdrawnDate(state, [...others, change]);
  if (date === null) return null;
  const day = formatDayMonth(date, state.today);
  if (d.kind === "withdrawal" && date === d.date) {
    return `Você só tem ${formatCentsToBrl(Math.max(0, valueOn(state, others, date)))} em ${day}.`;
  }
  return `${d.id ? "Com essa mudança" : "Com esse resgate"}, o saldo ficaria negativo em ${day}.`;
}

async function insertMovement(ownerId: string, d: ParsedMovement): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .insert({
      user_id: ownerId,
      investment_id: d.investmentId,
      kind: d.kind,
      date: d.date,
      amount_cents: d.amountCents,
      note: d.note || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("insertMovement error:", error);
    return fail("Não foi possível registrar o movimento.");
  }
  return ok({ id: data.id });
}

async function updateMovement(ownerId: string, movementId: string, d: ParsedMovement): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .update({
      kind: d.kind,
      date: d.date,
      amount_cents: d.amountCents,
      // Observação ausente mantém a atual.
      ...(d.note !== undefined && { note: d.note || null }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", movementId)
    .eq("user_id", ownerId)
    .eq("investment_id", d.investmentId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("updateMovement error:", error);
    return fail("Não foi possível atualizar o movimento.");
  }
  if (!data) return fail("Movimento não encontrado.");
  return ok({ id: data.id });
}

// "Guardei" / "Resgatei" (cria) ou edição de um aporte/resgate (com `id`). Recusa se o saldo ficar negativo.
export async function saveInvestmentMovement(input: SaveInvestmentMovementInput): Promise<ActionResult<{ id: string }>> {
  const scope = await getFinanceScope();
  const parsed = saveMovementSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.date > todayIso()) return fail("A data não pode ser no futuro.");

  const loaded = await loadInvestmentState(scope.ownerId, d.investmentId, [d.date]);
  if (!loaded.ok) return loaded;
  const blocker = (d.id ? editBlocker(loaded.data, d.id) : null) ?? movementOverdraftError(loaded.data, d);
  if (blocker) return fail(blocker);

  const result = d.id ? await updateMovement(scope.ownerId, d.id, d) : await insertMovement(scope.ownerId, d);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// Investimento de um movimento ativo do usuário.
async function findMovementInvestmentId(ownerId: string, movementId: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .select("investment_id")
    .eq("id", movementId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("findMovementInvestmentId error:", error);
    return fail("Não foi possível excluir o movimento.");
  }
  return data ? ok(data.investment_id) : fail("Movimento não encontrado.");
}

function deletionOverdraftError(state: InvestmentState, movementId: string): string | null {
  const movement = state.movements.find((item) => item.id === movementId);
  if (!movement) return "Movimento não encontrado.";
  const date = newOverdrawnDate(state, movementsWithout(state, movementId));
  return date ? `Sem esse ${MOVEMENT_NOUN[movement.kind]}, o saldo ficaria negativo em ${formatDayMonth(date, state.today)}.` : null;
}

async function softDeleteMovement(ownerId: string, movementId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", movementId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("softDeleteMovement error:", error);
    return fail("Não foi possível excluir o movimento.");
  }
  return data ? ok() : fail("Movimento não encontrado.");
}

// Vai para a lixeira; o "Desfazer" usa `restoreFinanceItem("investment_movement", id)`.
// Excluir o único movimento é permitido (o investimento fica zerado).
export async function deleteInvestmentMovement(movementId: string): Promise<ActionResult> {
  const scope = await getFinanceScope();
  if (!uuidSchema.safeParse(movementId).success) return fail("Movimento inválido.");

  const investment = await findMovementInvestmentId(scope.ownerId, movementId);
  if (!investment.ok) return investment;
  const loaded = await loadInvestmentState(scope.ownerId, investment.data);
  if (!loaded.ok) return loaded;
  const blocker = deletionOverdraftError(loaded.data, movementId);
  if (blocker) return fail(blocker);

  const result = await softDeleteMovement(scope.ownerId, movementId);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// ---------------------------------------------------------------------------
// Acertar com o app
// ---------------------------------------------------------------------------

async function insertAdjustment(ownerId: string, investmentId: string, adjustment: InvestmentMovement): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .insert({
      user_id: ownerId,
      investment_id: investmentId,
      kind: "adjustment",
      date: adjustment.date,
      amount_cents: adjustment.amountCents,
      note: RECONCILE_NOTE,
    })
    .select("id")
    .single();
  if (error) {
    console.error("insertAdjustment error:", error);
    return fail("Não foi possível acertar o valor.");
  }
  return ok(data.id);
}

// Grava hoje um ajuste com a diferença entre o app do banco e a nossa estimativa (nada, se já bate).
// Como o valor do app é >= 0, o saldo depois do ajuste não fica negativo.
export async function reconcileInvestment(input: ReconcileInvestmentInput): Promise<ActionResult<ReconcileInvestmentResult>> {
  const scope = await getFinanceScope();
  const parsed = reconcileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const loaded = await loadInvestmentState(scope.ownerId, parsed.data.investmentId);
  if (!loaded.ok) return loaded;
  const state = loaded.data;
  const adjustmentCents = parsed.data.appValueCents - valueOn(state, state.movements, state.today);
  if (adjustmentCents === 0) return ok({ adjustmentId: null, adjustmentCents: 0 });

  const adjustment: InvestmentMovement = { date: state.today, kind: "adjustment", amountCents: adjustmentCents };
  const inserted = await insertAdjustment(scope.ownerId, parsed.data.investmentId, adjustment);
  if (!inserted.ok) return inserted;
  revalidatePath("/", "layout");
  return ok({ adjustmentId: inserted.data, adjustmentCents });
}

// ---------------------------------------------------------------------------
// Mudar taxa / histórico de taxas
// ---------------------------------------------------------------------------

// Entrada de taxa como o formulário envia (e como o "Desfazer" devolve para `saveInvestmentRate`).
type RateChangeInput = Omit<SaveInvestmentRateInput, "investmentId">;

function toRateChangeInput(entry: RateEntry): RateChangeInput {
  const rate: InvestmentRateInput =
    entry.mode === "cdi"
      ? { mode: "cdi", tax: entry.tax, tiers: entry.tiers }
      : { mode: "annual", tax: entry.tax, annualPercent: entry.annualPercent };
  return { from: entry.from, rate };
}

// Mudar a taxa no passado refaz o rendimento desde então; se um resgate gravado passar a ser maior
// que o saldo, a mudança é barrada (mesma regra dos movimentos).
function rateOverdraftError(state: InvestmentState, rates: RateEntry[], prefix: string): string | null {
  const date = newOverdrawnDate(state, state.movements, rates);
  return date ? `${prefix}, o saldo ficaria negativo em ${formatDayMonth(date, state.today)}. Ajuste o resgate antes.` : null;
}

async function writeRates(ownerId: string, investmentId: string, rates: RateEntry[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_investments")
    .update({ rate_changes: serializeRateChanges(rates), updated_at: new Date().toISOString() })
    .eq("id", investmentId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("writeRates error:", error);
    return fail("Não foi possível salvar a taxa.");
  }
  return data ? ok() : fail("Investimento não encontrado.");
}

// "Mudar taxa": vale de `from` em diante (passado ou até ~1 ano à frente). A mesma data substitui a entrada.
export async function saveInvestmentRate(input: SaveInvestmentRateInput): Promise<ActionResult<null>> {
  const scope = await getFinanceScope();
  const parsed = saveRateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.from > addDays(todayIso(), MAX_RATE_DAYS_AHEAD)) return fail("A data pode ser no máximo daqui a um ano.");

  const loaded = await loadInvestmentState(scope.ownerId, d.investmentId);
  if (!loaded.ok) return loaded;
  const state = loaded.data;
  const rates = [...state.rates.filter((rate) => rate.from !== d.from), toRateEntry(d.rate, d.from)].sort((a, b) =>
    a.from.localeCompare(b.from),
  );
  const blocker = rateOverdraftError(state, rates, "Com essa taxa");
  if (blocker) return fail(blocker);

  const result = await writeRates(scope.ownerId, d.investmentId, rates);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return ok(null);
}

// Remove uma entrada do histórico de taxas (nunca a única). Devolve a entrada removida no formato de
// `saveInvestmentRate` para o "Desfazer": saveInvestmentRate({ investmentId, ...removed }).
export async function deleteInvestmentRate(input: DeleteInvestmentRateInput): Promise<ActionResult<{ removed: RateChangeInput }>> {
  const scope = await getFinanceScope();
  const parsed = deleteRateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const loaded = await loadInvestmentState(scope.ownerId, d.investmentId);
  if (!loaded.ok) return loaded;
  const state = loaded.data;
  // Na mesma data vale a última entrada (como em `parseRateChanges`).
  const removed = state.rates.filter((rate) => rate.from === d.from).at(-1);
  if (!removed) return fail("Essa taxa não foi encontrada.");
  const rates = state.rates.filter((rate) => rate.from !== d.from);
  if (rates.length === 0) return fail("O investimento precisa ter pelo menos uma taxa.");
  const blocker = rateOverdraftError(state, rates, "Sem essa taxa");
  if (blocker) return fail(blocker);

  const result = await writeRates(scope.ownerId, d.investmentId, rates);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return ok({ removed: toRateChangeInput(removed) });
}
