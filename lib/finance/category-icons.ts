// Ícone de cada categoria, escolhido pelo nome (sem mexer no banco). Puro: sem "use client".
export const CATEGORY_ICON_KEYS = [
  "banknote",
  "house",
  "receipt",
  "zap",
  "gift",
  "hand-heart",
  "graduation-cap",
  "heart-pulse",
  "credit-card",
  "utensils",
  "car",
  "shopping-bag",
  "film",
  "piggy-bank",
  "trending-up",
  "briefcase",
  "laptop",
  "wrench",
  "megaphone",
  "percent",
  "package",
  "baby",
  "paw-print",
  "plane",
  "shield",
  "circle-ellipsis",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

// Primeira regra que casar vence; por isso as mais específicas vêm antes.
const NAME_RULES: Array<[CategoryIconKey, RegExp]> = [
  ["laptop", /notebook/],
  ["package", /pecas|insumo|pasta termica|upgrade/],
  ["wrench", /ferramenta|manutencao/],
  ["megaphone", /marketing|anuncio/],
  ["percent", /taxa|operacional|imposto/],
  ["hand-heart", /dizimo|oferta|doac/],
  ["credit-card", /cartao|cartoes|fatura/],
  ["piggy-bank", /reserva|poupanca/],
  ["trending-up", /dividendo|investimento|rendimento/],
  ["briefcase", /pro-?labore|servico/],
  ["gift", /beneficio|bonifica|presente/],
  ["banknote", /salario|13o|ferias/],
  ["house", /aluguel|moradia|condominio|casa/],
  ["zap", /consumo|luz|energia|agua|internet/],
  ["utensils", /alimenta|mercado|restaurante|comida/],
  ["car", /transporte|veiculo|combustivel|carro/],
  ["heart-pulse", /saude|farmacia|medic/],
  ["graduation-cap", /educacao|estudo|bolsa|curso|escola/],
  ["baby", /filho|bebe|crianca/],
  ["paw-print", /\bpets?\b|animal/],
  ["plane", /viagem|passagem/],
  ["shield", /seguro/],
  ["film", /lazer|assinatura|streaming/],
  ["shopping-bag", /compra|vestuario|roupa/],
  ["circle-ellipsis", /^outras?\b/],
];

function normalize(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function isIconKey(value: string): value is CategoryIconKey {
  return (CATEGORY_ICON_KEYS as readonly string[]).includes(value);
}

export function categoryIconKey(
  name: string,
  kind: "income" | "expense",
  explicit?: string | null
): CategoryIconKey {
  if (explicit && isIconKey(explicit)) return explicit;
  const normalized = normalize(name);
  const match = NAME_RULES.find(([, pattern]) => pattern.test(normalized));
  if (match) {
    const [key] = match;
    // "Outras Despesas" é um recibo; "Outras Entradas" fica com as reticências.
    return key === "circle-ellipsis" && kind === "expense" ? "receipt" : key;
  }
  return kind === "income" ? "banknote" : "receipt";
}
