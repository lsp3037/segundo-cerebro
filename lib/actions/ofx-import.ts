"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { parseOfx } from "@/lib/finance/ofx-parser";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export interface AnalyzedOfxItem {
  fitid: string;
  date: string; // YYYY-MM-DD
  amount_cents: number;
  kind: "income" | "expense";
  raw_description: string;
  clean_description: string;
  type: string;
  status: "new" | "matched_existing" | "already_imported";
  matchedTransaction?: {
    id: string;
    date: string;
    description: string;
    amount_cents: number;
  } | null;
  suggestedCategoryId: string | null;
  rulePatternSuggestion: string;
}

export interface OfxAnalysisReport {
  bankId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  targetLedger: "pessoal" | "trustcare";
  items: AnalyzedOfxItem[];
  summary: {
    total: number;
    newCount: number;
    matchedCount: number;
    alreadyImportedCount: number;
    totalIncomeCents: number;
    totalExpenseCents: number;
  };
}

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * Heurística rápida de fallback para categorizar nomes comuns de estabelecimentos
 */
function heuristicCategoryMatch(
  description: string,
  kind: "income" | "expense",
  categories: Tables<"finance_categories">[],
): string | null {
  const d = description.toLowerCase();

  const matchCat = (keywords: string[], catNamePart: string) => {
    if (keywords.some((k) => d.includes(k))) {
      const found = categories.find((c) => c.kind === kind && c.name.toLowerCase().includes(catNamePart));
      if (found) return found.id;
    }
    return null;
  };

  if (kind === "expense") {
    return (
      matchCat(["mercado", "supermercado", "hipermercado", "acougue", "padaria", "panificadora", "restaurante", "ifood", "lanche", "burger", "pizza"], "alimentação") ??
      matchCat(["posto", "combustivel", "gasolina", "etanol", "uber", "99app", "estacionamento", "pedagio"], "transporte") ??
      matchCat(["farmacia", "drogaria", "medicamento", "hospital", "clinica", "medico", "consulta"], "saúde") ??
      matchCat(["aluguel", "condominio", "iptu"], "moradia") ??
      matchCat(["energisa", "luz", "agua", "sanepar", "claro", "vivo", "tim", "internet", "fibra"], "consumo") ??
      matchCat(["netflix", "spotify", "amazon prime", "disney", "youtube", "cinema", "show"], "lazer") ??
      matchCat(["kabum", "pichau", "terabyte", "ssd", "ram", "display", "bateria", "teclado", "aliexpress"], "peças") ??
      matchCat(["google ads", "facebook", "meta ads", "anuncio"], "marketing") ??
      matchCat(["tarifa", "anuidade", "taxa", "iof"], "taxa") ??
      null
    );
  } else {
    return (
      matchCat(["salario", "folha", "vencimento", "remuneracao", "ses-mt"], "salário") ??
      matchCat(["notebook", "computador", "aparelho", "venda"], "notebook") ??
      matchCat(["manutencao", "formatacao", "conserto", "reparo", "limpeza"], "serviços") ??
      matchCat(["dividendo", "rendimento", "juros", "cdi", "tesouro"], "investimento") ??
      null
    );
  }
}

/**
 * 1. Analisa o arquivo OFX sem gravar nada, cruzando com FITIDs e regras do banco
 */
export async function analyzeOfxContent(params: {
  content: string;
  targetLedger: "pessoal" | "trustcare";
}): Promise<ActionResult<OfxAnalysisReport>> {
  const user = await getCurrentUser();
  const parsed = parseOfx(params.content);

  if (!parsed.success || parsed.transactions.length === 0) {
    return fail(parsed.error || "Nenhuma transação financeira encontrada no arquivo.");
  }

  const supabase = await createClient();

  // 1. Busca FITIDs já importados anteriormente
  const fitids = parsed.transactions.map((t) => t.fitid).filter(Boolean);
  const { data: existingFitidsData } = await supabase
    .from("transactions")
    .select("bank_fitid")
    .eq("user_id", user.id)
    .in("bank_fitid", fitids)
    .is("deleted_at", null);

  const importedSet = new Set((existingFitidsData ?? []).map((x) => x.bank_fitid).filter(Boolean));

  // 2. Busca lançamentos manuais no mesmo intervalo de datas (+/- 3 dias) para sugestão de match
  const dates = parsed.transactions.map((t) => t.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const { data: candidateTransactions } = await supabase
    .from("transactions")
    .select("id, date, description, amount_cents, kind")
    .eq("user_id", user.id)
    .eq("ledger", params.targetLedger)
    .is("deleted_at", null)
    .is("bank_fitid", null)
    .gte("date", minDate)
    .lte("date", maxDate);

  // 3. Busca regras de auto-categorização do usuário e categorias ativas
  const [rulesRes, catsRes] = await Promise.all([
    supabase
      .from("finance_rules")
      .select("*")
      .eq("user_id", user.id)
      .eq("ledger", params.targetLedger),
    supabase
      .from("finance_categories")
      .select("*")
      .eq("user_id", user.id)
      .eq("ledger", params.targetLedger)
      .is("deleted_at", null),
  ]);

  const rules = rulesRes.data ?? [];
  const categories = catsRes.data ?? [];

  // 4. Analisa cada transação do extrato
  let newCount = 0;
  let matchedCount = 0;
  let alreadyImportedCount = 0;
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;

  const analyzedItems: AnalyzedOfxItem[] = [];

  for (const trn of parsed.transactions) {
    const isAlreadyImported = importedSet.has(trn.fitid);

    let status: AnalyzedOfxItem["status"] = "new";
    let matchedTransaction: AnalyzedOfxItem["matchedTransaction"] = null;

    if (isAlreadyImported) {
      status = "already_imported";
      alreadyImportedCount++;
    } else {
      // Procura correspondência em lançamentos manuais existentes sem FITID
      const candidate = (candidateTransactions ?? []).find((c) => {
        if (c.amount_cents !== trn.amount_cents) return false;
        if (c.kind !== trn.kind) return false;
        const diffMs = Math.abs(new Date(c.date).getTime() - new Date(trn.date).getTime());
        return diffMs <= 2 * 24 * 60 * 60 * 1000; // Até 2 dias de diferença
      });

      if (candidate) {
        status = "matched_existing";
        matchedTransaction = candidate;
        matchedCount++;
      } else {
        status = "new";
        newCount++;
      }

      if (trn.kind === "income") totalIncomeCents += trn.amount_cents;
      else totalExpenseCents += trn.amount_cents;
    }

    // Auto-categorização por regras aprendidas do usuário
    let suggestedCategoryId: string | null = null;
    const cleanLower = trn.clean_description.toLowerCase();

    for (const rule of rules) {
      if (rule.kind === trn.kind && cleanLower.includes(rule.pattern.toLowerCase())) {
        suggestedCategoryId = rule.category_id;
        break;
      }
    }

    // Se nenhuma regra do usuário bateu, usa heurística padrão
    if (!suggestedCategoryId) {
      suggestedCategoryId = heuristicCategoryMatch(trn.clean_description, trn.kind, categories);
    }

    // Sugere padrão limpo para memorizar (primeiras 2 ou 3 palavras significativas)
    const words = trn.clean_description.split(" ").filter((w) => w.length > 2);
    const rulePatternSuggestion = words.slice(0, 2).join(" ");

    analyzedItems.push({
      fitid: trn.fitid,
      date: trn.date,
      amount_cents: trn.amount_cents,
      kind: trn.kind,
      raw_description: trn.raw_description,
      clean_description: trn.clean_description,
      type: trn.type,
      status,
      matchedTransaction,
      suggestedCategoryId,
      rulePatternSuggestion: rulePatternSuggestion || trn.clean_description,
    });
  }

  return ok({
    bankId: parsed.bankId,
    accountId: parsed.accountId,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    targetLedger: params.targetLedger,
    items: analyzedItems,
    summary: {
      total: parsed.transactions.length,
      newCount,
      matchedCount,
      alreadyImportedCount,
      totalIncomeCents,
      totalExpenseCents,
    },
  });
}

const importBatchItemSchema = z.object({
  fitid: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  amount_cents: z.number().int().positive(),
  kind: z.enum(["income", "expense"]),
  description: z.string().trim().min(1).max(200),
  category_id: z.string().uuid().nullable().optional(),
  payment_method_id: z.string().uuid().nullable().optional(),
  ledger: z.enum(["pessoal", "trustcare"]),
  action: z.enum(["create", "link_existing", "ignore"]),
  matched_transaction_id: z.string().uuid().nullable().optional(),
  remember_rule: z.boolean().default(false),
  rule_pattern: z.string().trim().max(100).optional(),
});

const importOfxBatchSchema = z.object({
  ledger: z.enum(["pessoal", "trustcare"]),
  payment_method_id: z.string().uuid().nullable().optional(),
  items: z.array(importBatchItemSchema),
});

export type ImportOfxBatchInput = z.infer<typeof importOfxBatchSchema>;

/**
 * 2. Grava em lote as transações aprovadas na interface de revisão
 */
export async function importOfxBatchAction(
  input: ImportOfxBatchInput,
): Promise<ActionResult<{ created: number; linked: number; rulesSaved: number }>> {
  const user = await getCurrentUser();
  const parsed = importOfxBatchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();

  let created = 0;
  let linked = 0;
  let rulesSaved = 0;

  const toInsert: Array<{
    user_id: string;
    ledger: "pessoal" | "trustcare";
    kind: "income" | "expense";
    amount_cents: number;
    date: string;
    description: string;
    category_id: string | null;
    payment_method_id: string | null;
    bank_fitid: string;
  }> = [];

  for (const item of parsed.data.items) {
    if (item.action === "ignore") continue;

    const pmId = item.payment_method_id || parsed.data.payment_method_id || null;

    if (item.action === "link_existing" && item.matched_transaction_id) {
      // Mescla com transação manual existente (evita duplicar)
      const { error } = await supabase
        .from("transactions")
        .update({
          bank_fitid: item.fitid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.matched_transaction_id)
        .eq("user_id", user.id);

      if (!error) linked++;
    } else if (item.action === "create") {
      toInsert.push({
        user_id: user.id,
        ledger: item.ledger,
        kind: item.kind,
        amount_cents: item.amount_cents,
        date: item.date,
        description: item.description,
        category_id: item.category_id ?? null,
        payment_method_id: pmId,
        bank_fitid: item.fitid,
      });
      created++;
    }

    // Se o usuário pediu para memorizar a regra
    if (item.remember_rule && item.rule_pattern && item.category_id) {
      const pattern = item.rule_pattern.trim().toLowerCase();
      if (pattern.length >= 2) {
        const { error: ruleErr } = await supabase.from("finance_rules").upsert(
          {
            user_id: user.id,
            pattern,
            category_id: item.category_id,
            ledger: item.ledger,
            kind: item.kind,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, pattern, ledger" },
        );
        if (!ruleErr) rulesSaved++;
      }
    }
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("transactions").insert(toInsert);
    if (insertErr) {
      console.error("importOfxBatchAction insert error:", insertErr);
      return fail("Erro ao inserir transações no banco de dados.");
    }
  }

  revalidatePath("/", "layout");
  return ok({ created, linked, rulesSaved });
}
