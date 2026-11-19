// Formatação usada pela aba Investimentos (cartões, histórico e diálogos).
import { formatShortDate, type IsoDate } from "@/lib/dates";
import type { RateEntry } from "@/lib/finance/investments";
import { formatCentsToBrl } from "@/lib/money";

// "+R$ 5,32", "-R$ 0,12" ou "R$ 0,00".
export function signedBrl(cents: number): string {
  return cents > 0 ? `+${formatCentsToBrl(cents)}` : formatCentsToBrl(cents);
}

// "12 nov" no ano de hoje; "12 nov 2025" nos outros anos.
export function formatMovementDate(iso: IsoDate, today: IsoDate): string {
  const short = formatShortDate(iso);
  return iso.slice(0, 4) === today.slice(0, 4) ? short : `${short} ${iso.slice(0, 4)}`;
}

// "2026-11-12" → "12/11/2026"
export function formatFullDate(iso: IsoDate): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const wholeBrl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// "R$ 10.000" quando não há centavos; senão "R$ 10.000,50".
function formatBrlCompact(cents: number): string {
  return cents % 100 === 0 ? wholeBrl.format(cents / 100) : formatCentsToBrl(cents);
}

export function formatPercent(value: number, fractionDigits?: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 2,
  });
}

// "120% do CDI até R$ 10.000, 100% acima, depois do imposto" ou "10,00% ao ano".
export function describeRate(rate: RateEntry | null): string {
  if (!rate) return "Taxa não informada";
  const taxSuffix = rate.tax === "regressive" ? ", depois do imposto" : "";
  return `${describeRateBase(rate)}${taxSuffix}`;
}

function describeRateBase(rate: RateEntry): string {
  if (rate.mode === "annual") return `${formatPercent(rate.annualPercent, 2)}% ao ano`;
  if (rate.tiers.length === 1) return `${formatPercent(rate.tiers[0].ofCdiPercent)}% do CDI`;
  return rate.tiers
    .map((tier, index) => {
      const percent = `${formatPercent(tier.ofCdiPercent)}%${index === 0 ? " do CDI" : ""}`;
      return tier.upToCents === null ? `${percent} acima` : `${percent} até ${formatBrlCompact(tier.upToCents)}`;
    })
    .join(", ");
}
