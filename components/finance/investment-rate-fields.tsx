"use client";

import { useId, useState } from "react";

import {
  COFRINHO_DEFAULT_TIERS,
  fixedDailyFactor,
  tieredDailyYield,
  type RateEntry,
  type RateTier,
} from "@/lib/finance/investments";
import type { InvestmentRateInput } from "@/lib/finance/investments-data";
import { centsToInput, inputToCents } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Campos "Quanto rende" usados no cadastro do investimento e no "Mudar taxa".

type RateMode = "cdi" | "annual";

export type RateFieldValues = {
  mode: RateMode;
  lowPercentStr: string;
  capStr: string;
  highPercentStr: string;
  annualStr: string;
};

export type RateResult = { ok: true; value: InvestmentRateInput } | { ok: false; error: string };

const [DEFAULT_LOW_TIER, DEFAULT_HIGH_TIER] = COFRINHO_DEFAULT_TIERS;

function parsePercent(text: string): number {
  const value = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

function formatPercentInput(value: number): string {
  return String(value).replace(".", ",");
}

// Valores iniciais dos campos: padrão do Cofrinho, ou a taxa informada (ex.: a vigente).
// Faixas do CDI viram "até o teto" (primeira) e "acima" (última); com uma faixa só, as duas iguais.
function initialRateFieldValues(rate: RateEntry | null): RateFieldValues {
  const defaults: RateFieldValues = {
    mode: "cdi",
    lowPercentStr: formatPercentInput(DEFAULT_LOW_TIER.ofCdiPercent),
    capStr: centsToInput(DEFAULT_LOW_TIER.upToCents),
    highPercentStr: formatPercentInput(DEFAULT_HIGH_TIER.ofCdiPercent),
    annualStr: "",
  };
  if (!rate) return defaults;
  if (rate.mode === "annual") return { ...defaults, mode: "annual", annualStr: formatPercentInput(rate.annualPercent) };

  const first = rate.tiers[0];
  const last = rate.tiers[rate.tiers.length - 1];
  if (!first || !last) return defaults;
  return {
    ...defaults,
    lowPercentStr: formatPercentInput(first.ofCdiPercent),
    capStr: first.upToCents === null ? defaults.capStr : centsToInput(first.upToCents),
    highPercentStr: formatPercentInput(last.ofCdiPercent),
  };
}

export function buildRate(fields: RateFieldValues): RateResult {
  if (fields.mode === "annual") {
    const annualPercent = parsePercent(fields.annualStr);
    if (!(annualPercent > 0)) return { ok: false, error: "Informe a taxa ao ano (maior que zero)." };
    return { ok: true, value: { mode: "annual", annualPercent } };
  }
  const low = parsePercent(fields.lowPercentStr);
  const high = parsePercent(fields.highPercentStr);
  const capCents = inputToCents(fields.capStr);
  if (!(low >= 0) || !(high >= 0)) return { ok: false, error: "Informe os percentuais do CDI." };
  if (capCents <= 0) return { ok: false, error: "Informe o teto da primeira faixa (maior que R$ 0,00)." };
  const tiers: RateTier[] = [
    { upToCents: capCents, ofCdiPercent: low },
    { upToCents: null, ofCdiPercent: high },
  ];
  return { ok: true, value: { mode: "cdi", tiers } };
}

// Estado dos campos de taxa + a taxa já montada (ou o erro do primeiro campo inválido).
export function useRateFields(initial: RateEntry | null = null) {
  const [values, setValues] = useState<RateFieldValues>(() => initialRateFieldValues(initial));
  const update = (patch: Partial<RateFieldValues>) => setValues((current) => ({ ...current, ...patch }));
  return { values, update, rate: buildRate(values) };
}

// Entrada do histórico → formato aceito pelas actions (usado no "Desfazer" da remoção).
export function rateEntryToInput(entry: RateEntry): InvestmentRateInput {
  return entry.mode === "annual"
    ? { mode: "annual", annualPercent: entry.annualPercent }
    : { mode: "cdi", tiers: entry.tiers };
}

// Rendimento estimado de um dia útil, em centavos (sem arredondar), ou null sem CDI disponível.
export function estimateDailyYield(
  amountCents: number,
  rate: InvestmentRateInput,
  cdiDailyPercent: number | null,
): number | null {
  if (rate.mode === "annual") return amountCents * fixedDailyFactor(rate.annualPercent);
  if (cdiDailyPercent === null) return null;
  return tieredDailyYield(amountCents, rate.tiers, cdiDailyPercent / 100);
}

interface RateFieldsProps {
  values: RateFieldValues;
  onChange: (patch: Partial<RateFieldValues>) => void;
}

export function RateFields({ values, onChange }: RateFieldsProps) {
  const idPrefix = useId();
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium text-foreground">Quanto rende</legend>
      <Select value={values.mode} onValueChange={(value) => onChange({ mode: value as RateMode })}>
        <SelectTrigger className="w-full text-xs" aria-label="Tipo de taxa">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cdi" className="text-xs">CDI em faixas (como o Cofrinho)</SelectItem>
          <SelectItem value="annual" className="text-xs">Taxa fixa ao ano</SelectItem>
        </SelectContent>
      </Select>

      {values.mode === "cdi" ? (
        <>
          <p className="text-xs text-muted-foreground">
            O CDI é a taxa de referência dos bancos. O padrão do Cofrinho é 120% do CDI até R$ 10.000 e 100% no que passar.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PercentField
              id={`${idPrefix}-tier-low`}
              label="% do CDI até o teto"
              value={values.lowPercentStr}
              onChange={(lowPercentStr) => onChange({ lowPercentStr })}
            />
            <div>
              <Label htmlFor={`${idPrefix}-tier-cap`} className="text-xs">Teto (R$)</Label>
              <Input
                id={`${idPrefix}-tier-cap`}
                inputMode="decimal"
                value={values.capStr}
                onChange={(e) => onChange({ capStr: e.target.value })}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <PercentField
              id={`${idPrefix}-tier-high`}
              label="% do CDI acima"
              value={values.highPercentStr}
              onChange={(highPercentStr) => onChange({ highPercentStr })}
            />
          </div>
        </>
      ) : (
        <PercentField
          id={`${idPrefix}-annual-rate`}
          label="Taxa ao ano (%)"
          value={values.annualStr}
          onChange={(annualStr) => onChange({ annualStr })}
          placeholder="Ex: 10,5"
        />
      )}
    </fieldset>
  );
}

function PercentField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 font-mono text-sm"
      />
    </div>
  );
}
