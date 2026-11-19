// Última escolha de pessoa, conta e forma de pagamento, lembrada neste aparelho.
// Só é chamada em eventos e efeitos do navegador (usa localStorage).
const LAST_CHOICES_KEY = "segundo-cerebro:finance-last-choices";

export interface LastChoices {
  memberLabel?: string;
  accountId?: string;
  paymentMethodId?: string;
}

export function readLastChoices(): LastChoices | null {
  try {
    const raw = window.localStorage.getItem(LAST_CHOICES_KEY);
    return raw ? (JSON.parse(raw) as LastChoices) : null;
  } catch {
    return null;
  }
}

export function saveLastChoices(choices: LastChoices) {
  try {
    window.localStorage.setItem(LAST_CHOICES_KEY, JSON.stringify(choices));
  } catch {
    // Sem armazenamento local (aba anônima, por exemplo): só não lembra a escolha.
  }
}
