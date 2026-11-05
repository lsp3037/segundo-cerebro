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

// Categorias padrão para seed automático
const DEFAULT_CATEGORIES: Array<{
  ledger: "pessoal" | "trustcare";
  kind: "income" | "expense";
  name: string;
  color: string;
  sort_order: number;
}> = [
  // Pessoal - Receitas
  { ledger: "pessoal", kind: "income", name: "Salário SES-MT", color: "#10b981", sort_order: 1 },
  { ledger: "pessoal", kind: "income", name: "Bolsa / Mestrado", color: "#3b82f6", sort_order: 2 },
  { ledger: "pessoal", kind: "income", name: "Outras Entradas", color: "#6b7280", sort_order: 3 },

  // Pessoal - Despesas
  { ledger: "pessoal", kind: "expense", name: "Moradia & Contas", color: "#ef4444", sort_order: 1 },
  { ledger: "pessoal", kind: "expense", name: "Alimentação & Mercado", color: "#f97316", sort_order: 2 },
  { ledger: "pessoal", kind: "expense", name: "Transporte & Combustível", color: "#eab308", sort_order: 3 },
  { ledger: "pessoal", kind: "expense", name: "Saúde & Farmácia", color: "#ec4899", sort_order: 4 },
  { ledger: "pessoal", kind: "expense", name: "Educação & Livros", color: "#8b5cf6", sort_order: 5 },
  { ledger: "pessoal", kind: "expense", name: "Lazer & Assinaturas", color: "#06b6d4", sort_order: 6 },
  { ledger: "pessoal", kind: "expense", name: "Outras Despesas", color: "#6b7280", sort_order: 7 },

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

// Garante que o usuário possua categorias e métodos de pagamento padrão
export async function ensureDefaultFinanceData(userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existingCats } = await supabase
    .from("finance_categories")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (!existingCats || existingCats.length === 0) {
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

  const { data: existingMethods } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (!existingMethods || existingMethods.length === 0) {
    const toInsert = DEFAULT_PAYMENT_METHODS.map((m) => ({
      user_id: userId,
      name: m.name,
      type: m.type,
      active: true,
    }));
    await supabase.from("payment_methods").insert(toInsert);
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
  return data ?? [];
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
    .select(`
      id, user_id, ledger, kind, amount_cents, date, description, notes, category_id, payment_method_id, notebook_id, created_at, updated_at, deleted_at,
      category:finance_categories(name, color),
      payment_method:payment_methods(name, type),
      notebook:notebooks(model, brand)
    `)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params?.ledger && params.ledger !== "all") {
    query = query.eq("ledger", params.ledger);
  }

  if (params?.month) {
    // Formato YYYY-MM
    const start = `${params.month}-01`;
    // Fim do mês (aproximado seguro usando 31 dias)
    const end = `${params.month}-31`;
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

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as Transaction[]) ?? [];
}

export async function getNotebooks(params?: {
  status?: "bought" | "repair" | "for_sale" | "sold" | "all";
}): Promise<Notebook[]> {
  const supabase = await createClient();

  let query = supabase
    .from("notebooks")
    .select(`
      id, user_id, brand, model, specs, status, notes, created_at, updated_at, deleted_at,
      profit_data:notebook_profit(income_cents, expense_cents, profit_cents)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((n) => {
    // profit_data vem como objeto ou array da relação da view
    const pData = Array.isArray(n.profit_data) ? n.profit_data[0] : n.profit_data;
    return {
      id: n.id,
      user_id: n.user_id,
      brand: n.brand,
      model: n.model,
      specs: n.specs,
      status: n.status,
      notes: n.notes,
      created_at: n.created_at,
      updated_at: n.updated_at,
      deleted_at: n.deleted_at,
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

  // 1. Busca transações do período
  let query = supabase
    .from("transactions")
    .select(`
      id, kind, amount_cents, date, ledger, category_id,
      category:finance_categories(name, color)
    `)
    .is("deleted_at", null);

  if (params?.ledger && params.ledger !== "all") {
    query = query.eq("ledger", params.ledger);
  }

  if (params?.month) {
    const start = `${params.month}-01`;
    const end = `${params.month}-31`;
    query = query.gte("date", start).lte("date", end);
  }

  const { data: transactions, error } = await query;
  if (error) throw error;

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  const categoriesMap = new Map<
    string,
    { categoryId: string | null; name: string; color: string | null; kind: "income" | "expense"; totalCents: number }
  >();

  for (const t of transactions ?? []) {
    const amount = t.amount_cents || 0;
    if (t.kind === "income") {
      totalIncomeCents += amount;
    } else {
      totalExpenseCents += amount;
    }

    const catObj = Array.isArray(t.category) ? t.category[0] : t.category;
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
    transactionCount: transactions?.length ?? 0,
    monthlyTrend,
    categoriesBreakdown,
  };
}
