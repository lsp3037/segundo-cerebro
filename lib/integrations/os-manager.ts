import "server-only";

// Resumo do Gerenciador de O.S. (projeto "trustcare"), lido pela API pública dele
// (GET /api/v1/orders) com uma chave só de leitura (escopo orders:read).
// Só os números saem daqui: nada de cliente, problema ou valor é guardado ou mostrado.

const CLOSED = new Set(["Finalizado", "Cancelado"]);
const WAITING_PARTS = "Aguardando Peças";
// A API não informa a data prevista de entrega; "atrasada" = aberta há mais de 7 dias.
export const LATE_AFTER_DAYS = 7;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export type OsSummary =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      open: number;
      late: number;
      waitingParts: number;
      byStatus: { status: string; count: number }[];
      fetchedAt: string;
    };

type Order = { status: string; created_at: string };

export function osManagerUrl() {
  return (process.env.OS_API_URL ?? "").replace(/\/+$/, "") || null;
}

export async function getOsSummary(): Promise<OsSummary> {
  const base = osManagerUrl();
  const key = process.env.OS_API_KEY;
  if (!base || !key) return { status: "not_configured" };

  try {
    const orders: Order[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${base}/api/v1/orders?limit=${PAGE_SIZE}&page=${page}`, {
        headers: { "x-api-key": key },
        // Guarda por 5 minutos: a API do Gerenciador limita 30 chamadas por minuto.
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 || res.status === 403) return { status: "error", message: "Chave recusada pelo Gerenciador." };
      if (res.status === 429) return { status: "error", message: "Muitas consultas seguidas. Tente em um minuto." };
      if (!res.ok) return { status: "error", message: `O Gerenciador respondeu com erro ${res.status}.` };

      const body = (await res.json()) as { orders: Order[]; pagination: { totalPages: number } };
      orders.push(...body.orders);
      if (page >= body.pagination.totalPages) break;
    }

    const cutoff = Date.now() - LATE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const open = orders.filter((o) => !CLOSED.has(o.status));
    const counts = new Map<string, number>();
    for (const o of open) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);

    return {
      status: "ok",
      open: open.length,
      late: open.filter((o) => new Date(o.created_at).getTime() < cutoff).length,
      waitingParts: counts.get(WAITING_PARTS) ?? 0,
      byStatus: [...counts].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("getOsSummary", error);
    return { status: "error", message: "Não foi possível falar com o Gerenciador agora." };
  }
}
