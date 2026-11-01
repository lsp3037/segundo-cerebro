// Esconde dados pessoais antes de um texto sair do sistema (ex.: para a IA).
// Roda no servidor antes do envio e no navegador para mostrar a prévia; o texto original
// fica só no banco do Luan.

export type MaskKind = "email" | "cpf" | "cnpj" | "phone" | "cep" | "address";

export const MASK_LABELS: Record<MaskKind, { tag: string; one: string; many: string }> = {
  email: { tag: "[EMAIL]", one: "e-mail", many: "e-mails" },
  cpf: { tag: "[CPF]", one: "CPF", many: "CPFs" },
  cnpj: { tag: "[CNPJ]", one: "CNPJ", many: "CNPJs" },
  phone: { tag: "[TELEFONE]", one: "telefone", many: "telefones" },
  cep: { tag: "[CEP]", one: "CEP", many: "CEPs" },
  address: { tag: "[ENDEREÇO]", one: "endereço", many: "endereços" },
};

// A ordem importa: CNPJ e CPF antes de telefone, para 11/14 dígitos não virarem telefone.
const RULES: [MaskKind, RegExp][] = [
  ["email", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["cnpj", /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g],
  ["cpf", /\b\d{3}\.\d{3}\.\d{3}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-\d{2}\b/g],
  ["cep", /\b\d{5}-\d{3}\b/g],
  // (65) 99999-1234, +55 65 99999 1234, 65999991234, 9999-1234
  ["phone", /(?<![\d/])(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}(?![\d/])/g],
  // Sequência solta de 10 a 13 dígitos (telefone ou CPF sem pontuação).
  ["phone", /(?<!\d)\d{10,13}(?!\d)/g],
  // Rua das Flores, 123 · Av. Brasil 45 · Travessa X, nº 10 (até a vírgula/linha seguinte ao número)
  [
    "address",
    /\b(?:rua|r\.|avenida|av\.?|travessa|tv\.?|alameda|al\.|rodovia|estrada|pra[çc]a|quadra|qd\.?)\s+[^\n,]{2,60}?,?\s*(?:n[º°o.]?\s*)?\d{1,5}\b/gi,
  ],
];

export function maskPersonalData(text: string) {
  const counts: Partial<Record<MaskKind, number>> = {};
  let masked = text;
  for (const [kind, pattern] of RULES) {
    masked = masked.replace(pattern, (match) => {
      // Telefone precisa de pelo menos 8 dígitos; evita esconder valores e horários.
      if (kind === "phone" && match.replace(/\D/g, "").length < 8) return match;
      counts[kind] = (counts[kind] ?? 0) + 1;
      return MASK_LABELS[kind].tag;
    });
  }
  return { masked, counts };
}

// "2 telefones e 1 e-mail"
export function describeMaskCounts(counts: Partial<Record<MaskKind, number>>) {
  const parts = (Object.entries(counts) as [MaskKind, number][]).map(([kind, n]) => `${n} ${n > 1 ? MASK_LABELS[kind].many : MASK_LABELS[kind].one}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}
