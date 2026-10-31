// Todas as datas aparecem no horário de Cuiabá, não no do servidor (que roda em UTC).
export const TIME_ZONE = "America/Cuiaba";

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: TIME_ZONE });
const shortDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });

// "Sábado, 31 de outubro de 2026"
export function formatLongDate(date: Date) {
  const text = longDate.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "31/10/2026, 18:40"
export function formatDateTime(date: Date | string) {
  return shortDateTime.format(typeof date === "string" ? new Date(date) : date);
}
