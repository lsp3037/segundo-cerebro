// Utilitários de formatação e manipulação monetária em centavos (BRL).
// Não usa "use client" para ser compartilhado com segurança entre cliente e servidor.

export function formatCentsToBrl(cents: number | bigint | null | undefined): string {
  const value = Number(cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parseBrlToCents(val: string | number | null | undefined): number {
  if (typeof val === "number") return Math.round(val * 100);
  if (!val) return 0;
  
  // Se já for numérico simples com ponto (ex: "150.50")
  if (/^\d+(\.\d+)?$/.test(val.trim())) {
    return Math.round(parseFloat(val.trim()) * 100);
  }

  // Remove caracteres que não sejam dígitos
  const clean = val.replace(/[^\d]/g, "");
  return parseInt(clean, 10) || 0;
}

// Converte centavos para string no formato do input decimal (ex: 15050 -> "150,50")
export function centsToInput(cents: number | bigint | null | undefined): string {
  if (cents === null || cents === undefined || cents === 0) return "";
  const value = Number(cents) / 100;
  return value.toFixed(2).replace(".", ",");
}

// Converte texto digitado no input (ex: "150,50", "150.50", "1.250,00") para centavos
export function inputToCents(input: string): number {
  if (!input) return 0;
  const sanitized = input.trim().replace(/\s+/g, "");
  
  // Formato brasileiro com vírgula decimal (ex: 1.250,50 ou 150,50)
  if (sanitized.includes(",")) {
    const withoutThousands = sanitized.replace(/\./g, "");
    const parts = withoutThousands.split(",");
    const integerPart = parseInt(parts[0] || "0", 10) || 0;
    const decimalPart = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
    return integerPart * 100 + parseInt(decimalPart, 10);
  }

  // Se tem ponto decimal
  if (sanitized.includes(".")) {
    const parts = sanitized.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      const integerPart = parseInt(parts[0] || "0", 10) || 0;
      const decimalPart = parts[1].padEnd(2, "0").slice(0, 2);
      return integerPart * 100 + parseInt(decimalPart, 10);
    }
  }

  // Se são apenas dígitos inteiros
  const clean = sanitized.replace(/[^\d]/g, "");
  return (parseInt(clean, 10) || 0) * 100;
}

export function formatProfitMargin(profitCents: number, incomeCents: number): string {
  if (!incomeCents || incomeCents <= 0) return "0,0%";
  const margin = (profitCents / incomeCents) * 100;
  return `${margin.toFixed(1).replace(".", ",")}%`;
}
