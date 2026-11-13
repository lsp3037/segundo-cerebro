// Formato dos dados da aba Investimentos, compartilhado entre o loader (servidor)
// e a tela (cliente). Só tipos: sem "use client" e sem "server-only".
import type { IsoDate } from "@/lib/dates";
import type { InvestmentSummary, MovementKind, NonBusinessReason, RateEntry, RateTier } from "@/lib/finance/investments";

export type InvestmentMovementView = {
  id: string;
  date: IsoDate;
  kind: MovementKind;
  amountCents: number;
  note: string | null;
};

export type InvestmentView = {
  id: string;
  name: string;
  ownerLabel: string | null;
  notes: string | null;
  rates: RateEntry[];
  summary: InvestmentSummary;
  // Mais recentes primeiro.
  movements: InvestmentMovementView[];
};

export type InvestmentsTotals = {
  valueCents: number;
  depositedCents: number;
  withdrawnCents: number;
  yieldTodayCents: number;
  yieldMonthCents: number;
  yieldTotalCents: number;
  nextCreditCents: number;
};

export type CdiInfo = {
  // Último dia com CDI guardado (AAAA-MM-DD) e a taxa desse dia.
  lastDate: IsoDate | null;
  dailyPercent: number | null; // 0.050788 = 0,050788% ao dia
  annualPercent: number | null; // ((1 + diário)^252 - 1) × 100
  // true quando a busca no Banco Central falhou e estamos usando a cópia guardada.
  stale: boolean;
};

export type InvestmentsData = {
  investments: InvestmentView[];
  totals: InvestmentsTotals;
  cdi: CdiInfo;
  today: IsoDate;
  todayIsBusinessDay: boolean;
  todayReason: NonBusinessReason | null;
  error?: true;
};

// Taxa enviada pelo formulário ao criar/editar (a data "from" é decidida pela action).
export type InvestmentRateInput =
  | { mode: "cdi"; tiers: RateTier[] }
  | { mode: "annual"; annualPercent: number };

export type SaveInvestmentInput = {
  id?: string;
  name: string;
  ownerLabel: string | null;
  notes?: string | null;
  // Só na criação: quanto tem hoje e desde quando (vira o primeiro aporte).
  initial?: { amountCents: number; date: IsoDate };
  // Na criação é obrigatória; na edição é ignorada (mudança de taxa é a etapa 5).
  rate?: InvestmentRateInput;
};
