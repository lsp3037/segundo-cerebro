// Formatação usada pela aba Investimentos (cartões, histórico e diálogos).
import { formatShortDate, type IsoDate } from "@/lib/dates";
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
