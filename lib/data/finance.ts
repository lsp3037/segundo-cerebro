import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Transaction = Tables<"transactions"> & {
  category?: { name: string; color: string | null } | null;
  payment_method?: { name: string; type: string | null } | null;
  notebook?: { model: string; brand: string | null } | null;
};

export type FinanceCategory = Tables<"finance_categories">;
export type PaymentMethod = Tables<"payment_methods">;
export type FinanceRule = Tables<"finance_rules">;
export type Notebook = Tables<"notebooks"> & {
  income_cents?: number | null;
  expense_cents?: number | null;
  profit_cents?: number | null;
};

export type MonthlyPoint = {
  month: string; // YYYY-MM
  label: string; // Ex: "Out/26"
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
};

export type FinanceSummary = {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netBalanceCents: number;
  profitMarginPercent: number;
  transactionCount: number;
  monthlyTrend: MonthlyPoint[];
  categoriesBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    color: string | null;
    kind: "income" | "expense";
    totalCents: number;
    percentage: number;
  }>;
};

// Retorna o primeiro e o último dia válido de um mês no formato YYYY-MM
function getMonthRange(monthStr: string): { start: string; end: string } {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${yearStr}-${monthNumStr}-01`,
    end: `${yearStr}-${monthNumStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

// Categorias padrão para seed automático
export const DEFAULT_CATEGORIES: Array<{
  ledger: "pessoal" | "trustcare";
  kind: "income" | "expense";
  name: string;
  color: string;
  sort_order: number;
}> = [
  // Pessoal / Familiar - Receitas (Entradas)
  { ledger: "pessoal", kind: "income", name: "Salário", color: "#10b981", sort_order: 1 },
  { ledger: "pessoal", kind: "income", name: "Aluguel", color: "#059669", sort_order: 2 },
  { ledger: "pessoal", kind: "income", name: "Dividendos & Investimentos", color: "#3b82f6", sort_order: 3 },
  { ledger: "pessoal", kind: "income", name: "Pró-labore & Serviços", color: "#06b6d4", sort_order: 4 },
  { ledger: "pessoal", kind: "income", name: "Benefícios & Bonificações", color: "#8b5cf6", sort_order: 5 },
  { ledger: "pessoal", kind: "income", name: "Outras Entradas", color: "#6b7280", sort_order: 6 },

  // Pessoal / Familiar - Despesas (Saídas)
  { ledger: "pessoal", kind: "expense", name: "Moradia (Aluguel/Condomínio)", color: "#ef4444", sort_order: 1 },
  { ledger: "pessoal", kind: "expense", name: "Contas de Consumo (Luz/Água/Net)", color: "#f97316", sort_order: 2 },
  { ledger: "pessoal", kind: "expense", name: "Alimentação & Mercado", color: "#f59e0b", sort_order: 3 },
  { ledger: "pessoal", kind: "expense", name: "Transporte & Veículo", color: "#eab308", sort_order: 4 },
  { ledger: "pessoal", kind: "expense", name: "Saúde & Farmácia", color: "#ec4899", sort_order: 5 },
  { ledger: "pessoal", kind: "expense", name: "Família & Educação", color: "#8b5cf6", sort_order: 6 },
  { ledger: "pessoal", kind: "expense", name: "Lazer & Assinaturas", color: "#06b6d4", sort_order: 7 },
  { ledger: "pessoal", kind: "expense", name: "Compras & Vestuário", color: "#a855f7", sort_order: 8 },
  { ledger: "pessoal", kind: "expense", name: "Investimentos & Reserva", color: "#10b981", sort_order: 9 },
  { ledger: "pessoal", kind: "expense", name: "Outras Despesas", color: "#6b7280", sort_order: 10 },

  // Trust Care - Receitas
  { ledger: "trustcare", kind: "income", name: "Serviços & Manutenção", color: "#10b981", sort_order: 1 },
  { ledger: "trustcare", kind: "income", name: "Venda de Notebooks", color: "#3b82f6", sort_order: 2 },
  { ledger: "trustcare", kind: "income", name: "Venda de Peças / Acessórios", color: "#06b6d4", sort_order: 3 },

  // Trust Care - Despesas
  { ledger: "trustcare", kind: "expense", name: "Compra de Notebooks (Estoque)", color: "#3b82f6", sort_order: 1 },
  { ledger: "trustcare", kind: "expense", name: "Peças & Upgrades (SSD/RAM/Bateria)", color: "#f59e0b", sort_order: 2 },
  { ledger: "trustcare", kind: "expense", name: "Insumos & Pasta Térmica", color: "#f97316", sort_order: 3 },
  { ledger: "trustcare", kind: "expense", name: "Ferramentas de Bancada", color: "#8b5cf6", sort_order: 4 },
  { ledger: "trustcare", kind: "expense", name: "Marketing & Anúncios Meta Ads", color: "#ef4444", sort_order: 5 },
  { ledger: "trustcare", kind: "expense", name: "Taxas & Operacional", color: "#6b7280", sort_order: 6 },
];

const DEFAULT_PAYMENT_METHODS: Array<{
  name: string;
  type: "pix" | "credit" | "debit" | "cash" | "transfer" | "boleto" | "other";
}> = [
  { name: "PIX", type: "pix" },
  { name: "Cartão de Crédito", type: "credit" },
  { name: "Cartão de Débito", type: "debit" },
  { name: "Dinheiro", type: "cash" },
  { name: "Transferência Bancária", type: "transfer" },
  { name: "Boleto", type: "boleto" },
];

// Limpa e unifica categorias duplicadas no banco de dados, remapeando transações para a categoria canônica
export async function cleanupDuplicateCategories(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: allCats } = await supabase
      .from("finance_categories")
      .select("id, ledger, kind, name, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!allCats || allCats.length === 0) return;

    const seen = new Map<string, string>(); // key -> canonicalId
    const toDeleteIds: string[] = [];
    const remappings: Array<{ oldId: string; newId: string }> = [];

    for (const cat of allCats) {
      const key = `${cat.ledger}:${cat.kind}:${cat.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        const canonicalId = seen.get(key)!;
        toDeleteIds.push(cat.id);
        remappings.push({ oldId: cat.id, newId: canonicalId });
      } else {
        seen.set(key, cat.id);
      }
    }

    // Remapeia transações que usavam as categorias duplicadas
    for (const { oldId, newId } of remappings) {
      await supabase
        .from("transactions")
        .update({ category_id: newId })
        .eq("category_id", oldId)
        .eq("user_id", userId);
    }

    // Exclui fisicamente as categorias duplicadas
    if (toDeleteIds.length > 0) {
      await supabase
        .from("finance_categories")
        .delete()
        .in("id", toDeleteIds)
        .eq("user_id", userId);
    }
  } catch (err) {
    console.error("cleanupDuplicateCategories error:", err);
  }
}

// Garante que o usuário possua categorias e métodos de pagamento padrão (sem duplicar)
export async function ensureDefaultFinanceData(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    // 1. Limpa duplicidades existentes primeiro
    await cleanupDuplicateCategories(userId);

    // 2. Busca todas as categorias existentes do usuário (ativas)
    const { data: existingCats } = await supabase
      .from("finance_categories")
      .select("id, name, ledger, kind")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const existingList = existingCats ?? [];
    const existingNames = new Set(existingList.map((c) => `${c.ledger}:${c.kind}:${c.name.trim().toLowerCase()}`));

    // Se já existem categorias, só adiciona as que realmente faltam se a lista estiver muito vazia
    if (existingList.length === 0) {
      const toInsert = DEFAULT_CATEGORIES.map((c) => ({
        user_id: userId,
        ledger: c.ledger,
        kind: c.kind,
        name: c.name,
        color: c.color,
        sort_order: c.sort_order,
      }));
      await supabase.from("finance_categories").insert(toInsert);
    }

    // Métodos de pagamento
    const { data: existingMethods } = await supabase
      .from("payment_methods")
      .select("id, name")
      .eq("user_id", userId);

    if (!existingMethods || existingMethods.length === 0) {
      const methodsToInsert = DEFAULT_PAYMENT_METHODS.map((m) => ({
        user_id: userId,
        name: m.name,
        type: m.type,
        active: true,
      }));
      await supabase.from("payment_methods").insert(methodsToInsert);
    }
  } catch (err) {
    console.error("ensureDefaultFinanceData error:", err);
  }
}

export async function getFinanceCategories(ledger?: "pessoal" | "trustcare" | "all"): Promise<FinanceCategory[]> {
  const supabase = await createClient();
  let query = supabase
    .from("finance_categories")
    .select("*")
    .is("deleted_at", null)
    .order("ledger")
    .order("kind", { ascending: false })
    .order("sort_order");

  if (ledger && ledger !== "all") {
    query = query.eq("ledger", ledger);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Deduplica em memória por chave (ledger + kind + name) para garantia absoluta de 0 repetições na UI
  const uniqueCats: FinanceCategory[] = [];
  const seenKeys = new Set<string>();

  for (const cat of data ?? []) {
    const key = `${cat.ledger}:${cat.kind}:${cat.name.trim().toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCats.push(cat);
    }
  }

  return uniqueCats;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getFinanceRules(ledger?: "pessoal" | "trustcare" | "all"): Promise<FinanceRule[]> {
  const supabase = await createClient();
  let query = supabase.from("finance_rules").select("*").order("created_at", { ascending: false });

  if (ledger && ledger !== "all") {
    query = query.eq("ledger", ledger);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getFinanceRules error:", error);
    return [];
  }
  return data ?? [];
}

export async function getTransactions(params?: {
  ledger?: "pessoal" | "trustcare" | "all";
  month?: string; // YYYY-MM
  categoryId?: string;
  kind?: "income" | "expense";
  notebookId?: string;
  query?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params?.ledger && params.ledger !== "all") {
    query = query.eq("ledger", params.ledger);
  }

  if (params?.month) {
    const { start, end } = getMonthRange(params.month);
    query = query.gte("date", start).lte("date", end);
  }

  if (params?.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }

  if (params?.kind) {
    query = query.eq("kind", params.kind);
  }

  if (params?.notebookId) {
    query = query.eq("notebook_id", params.notebookId);
  }

  if (params?.query && params.query.trim()) {
    query = query.ilike("description", `%${params.query.trim()}%`);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(1000);
  }

  const [txRes, catsRes, methodsRes, notebooksRes] = await Promise.all([
    query,
    supabase.from("finance_categories").select("id, name, color"),
    supabase.from("payment_methods").select("id, name, type"),
    supabase.from("notebooks").select("id, model, brand"),
  ]);

  if (txRes.error) throw txRes.error;

  const catsMap = new Map((catsRes.data ?? []).map((c) => [c.id, c]));
  const methodsMap = new Map((methodsRes.data ?? []).map((m) => [m.id, m]));
  const notebooksMap = new Map((notebooksRes.data ?? []).map((n) => [n.id, n]));

  return (txRes.data ?? []).map((t) => ({
    ...t,
    category: t.category_id ? catsMap.get(t.category_id) ?? null : null,
    payment_method: t.payment_method_id ? methodsMap.get(t.payment_method_id) ?? null : null,
    notebook: t.notebook_id ? notebooksMap.get(t.notebook_id) ?? null : null,
  })) as Transaction[];
}

export async function getNotebooks(params?: {
  status?: "bought" | "repair" | "for_sale" | "sold" | "all";
}): Promise<Notebook[]> {
  const supabase = await createClient();

  let query = supabase
    .from("notebooks")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const [notebooksRes, profitRes] = await Promise.all([
    query,
    supabase.from("notebook_profit").select("notebook_id, income_cents, expense_cents, profit_cents"),
  ]);

  if (notebooksRes.error) throw notebooksRes.error;

  const profitMap = new Map<
    string,
    { income_cents: number | null; expense_cents: number | null; profit_cents: number | null }
  >();

  for (const p of profitRes.data ?? []) {
    if (p.notebook_id) {
      profitMap.set(p.notebook_id, p);
    }
  }

  return (notebooksRes.data ?? []).map((n) => {
    const pData = profitMap.get(n.id);
    return {
      ...n,
      income_cents: pData?.income_cents ?? 0,
      expense_cents: pData?.expense_cents ?? 0,
      profit_cents: pData?.profit_cents ?? 0,
    };
  });
}

export async function getFinanceSummary(params?: {
  ledger?: "pessoal" | "trustcare" | "all";
  month?: string; // YYYY-MM
}): Promise<FinanceSummary> {
  const supabase = await createClient();

  // 1. Busca transações do período e categorias
  let query = supabase
    .from("transactions")
    .select("id, kind, amount_cents, date, ledger, category_id")
    .is("deleted_at", null);

  if (params?.ledger && params.ledger !== "all") {
    query = query.eq("ledger", params.ledger);
  }

  if (params?.month) {
    const { start, end } = getMonthRange(params.month);
    query = query.gte("date", start).lte("date", end);
  }

  const [txRes, catsRes] = await Promise.all([
    query,
    supabase.from("finance_categories").select("id, name, color"),
  ]);

  if (txRes.error) throw txRes.error;

  const transactions = txRes.data ?? [];
  const catsMap = new Map((catsRes.data ?? []).map((c) => [c.id, c]));

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  const categoriesMap = new Map<
    string,
    { categoryId: string | null; name: string; color: string | null; kind: "income" | "expense"; totalCents: number }
  >();

  for (const t of transactions) {
    const amount = t.amount_cents || 0;
    if (t.kind === "income") {
      totalIncomeCents += amount;
    } else {
      totalExpenseCents += amount;
    }

    const catObj = t.category_id ? catsMap.get(t.category_id) : null;
    const catId = t.category_id || "sem_categoria";
    const catName = catObj?.name || (t.kind === "income" ? "Outras Entradas" : "Outras Despesas");
    const catColor = catObj?.color || "#94a3b8";

    const prev = categoriesMap.get(catId) ?? {
      categoryId: t.category_id,
      name: catName,
      color: catColor,
      kind: t.kind as "income" | "expense",
      totalCents: 0,
    };
    prev.totalCents += amount;
    categoriesMap.set(catId, prev);
  }

  const netBalanceCents = totalIncomeCents - totalExpenseCents;
  const profitMarginPercent = totalIncomeCents > 0 ? (netBalanceCents / totalIncomeCents) * 100 : 0;

  // Breakdown de categorias com porcentagem
  const categoriesBreakdown = Array.from(categoriesMap.values())
    .map((c) => {
      const base = c.kind === "income" ? totalIncomeCents : totalExpenseCents;
      const percentage = base > 0 ? (c.totalCents / base) * 100 : 0;
      return {
        categoryId: c.categoryId,
        categoryName: c.name,
        color: c.color,
        kind: c.kind,
        totalCents: c.totalCents,
        percentage: Number(percentage.toFixed(1)),
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  // 2. Histórico dos últimos 6 meses para o gráfico de tendência
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(mStr);
  }

  const oldestDate = `${months[0]}-01`;
  let trendQuery = supabase
    .from("transactions")
    .select("kind, amount_cents, date")
    .is("deleted_at", null)
    .gte("date", oldestDate);

  if (params?.ledger && params.ledger !== "all") {
    trendQuery = trendQuery.eq("ledger", params.ledger);
  }

  const { data: trendTx } = await trendQuery;

  const monthlyPointsMap = new Map<string, { incomeCents: number; expenseCents: number }>();
  for (const m of months) {
    monthlyPointsMap.set(m, { incomeCents: 0, expenseCents: 0 });
  }

  for (const t of trendTx ?? []) {
    const mKey = t.date.slice(0, 7);
    if (monthlyPointsMap.has(mKey)) {
      const p = monthlyPointsMap.get(mKey)!;
      if (t.kind === "income") p.incomeCents += t.amount_cents;
      else p.expenseCents += t.amount_cents;
    }
  }

  const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthlyTrend: MonthlyPoint[] = months.map((m) => {
    const [year, monthNum] = m.split("-");
    const mIdx = parseInt(monthNum, 10) - 1;
    const p = monthlyPointsMap.get(m) ?? { incomeCents: 0, expenseCents: 0 };
    return {
      month: m,
      label: `${MONTH_NAMES[mIdx]}/${year.slice(2)}`,
      incomeCents: p.incomeCents,
      expenseCents: p.expenseCents,
      balanceCents: p.incomeCents - p.expenseCents,
    };
  });

  return {
    totalIncomeCents,
    totalExpenseCents,
    netBalanceCents,
    profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
    transactionCount: transactions.length,
    monthlyTrend,
    categoriesBreakdown,
  };
}
