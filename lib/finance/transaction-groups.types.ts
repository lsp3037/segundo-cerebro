// Contrato da lista de Lançamentos (grupos, totais, situação de cada linha).
// Só tipos: sem "use client" e sem "server-only". A implementação fica em
// `lib/finance/transaction-groups.ts` (funções puras) e é usada pela tela.
import type { Transaction } from "@/lib/data/finance";

// "todo" = falta resolver (a pagar / a receber); "done" = já feito.
export type TxSection = "todo" | "done";

export type TxGroup = {
  // Estável entre renders: "overdue" | "week" | "later" | "nodue" | "day:AAAA-MM-DD" | "month:AAAA-MM".
  id: string;
  section: TxSection;
  // "late" só no grupo Atrasado.
  tone: "late" | "normal";
  // Ex.: "Atrasado", "Esta semana", "Mais adiante", "Quinta, 19 de novembro", "Antes, em novembro".
  title: string;
  // Ex.: "1 conta", "20 a 22 de novembro · 2 contas", "hoje · 2 itens". Pode ser null.
  subtitle: string | null;
  items: Transaction[];
  // Somas do grupo, em centavos (sem sinal).
  incomeCents: number;
  expenseCents: number;
};

export type TxGroups = {
  todo: TxGroup[];
  done: TxGroup[];
};

export type TxSituationTone = "late" | "soon" | "mute" | "in";

// Linha de situação sob a descrição: "Venceu em 10/11, 9 dias de atraso", "Vence amanhã, sexta (20/11)",
// "A receber em 27/11", "Pago hoje", "Recebido em 17/11"...
export type TxSituation = { text: string; tone: TxSituationTone };

export type TotalsPart = {
  totalCents: number;
  doneCents: number; // já recebido / já pago
  pendingCents: number; // falta receber / falta pagar
  pendingCount: number;
};

export type MonthTotals = {
  income: TotalsPart;
  expense: TotalsPart;
  // Entradas − saídas do mês inteiro (previsto).
  netCents: number;
  // Já na conta: recebido − pago.
  inHandCents: number;
};

// Como a tela diz se um lançamento já foi dado baixa (estado otimista de `usePayToggle`).
export type IsPaidFn = (tx: Transaction) => boolean;
