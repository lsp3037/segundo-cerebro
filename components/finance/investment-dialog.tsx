"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveInvestment } from "@/lib/actions/finance-investments";
import { todayIso, type IsoDate } from "@/lib/dates";
import { HOUSEHOLD_MEMBERS } from "@/lib/finance/household";
import {
  COFRINHO_DEFAULT_TIERS,
  fixedDailyFactor,
  tieredDailyYield,
  type RateTier,
} from "@/lib/finance/investments";
import type { InvestmentRateInput, InvestmentView } from "@/lib/finance/investments-data";
import { centsToInput, formatCentsToBrl, inputToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NO_OWNER = "none";
const DEFAULT_NAME = "Cofrinho";

type RateMode = "cdi" | "annual";

interface InvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null = criação.
  investmentToEdit: InvestmentView | null;
  // CDI diário em % (0.050788 = 0,050788% ao dia), para a prévia do rendimento.
  cdiDailyPercent: number | null;
  today: IsoDate | null;
  defaultOwner: string | null;
}

// Diálogo "Novo investimento" / "Editar investimento". O formulário é montado a cada abertura
// (o conteúdo do Dialog sai da tela ao fechar), então o estado inicial vem direto das props.
export function InvestmentDialog({
  open,
  onOpenChange,
  investmentToEdit,
  cdiDailyPercent,
  today,
  defaultOwner,
}: InvestmentDialogProps) {
  const isEditing = investmentToEdit !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{isEditing ? "Editar investimento" : "Novo investimento"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Aqui você muda o nome, o responsável e as observações."
              : "Informe quanto você tem lá hoje. O app calcula sozinho quanto rende por dia útil."}
          </DialogDescription>
        </DialogHeader>
        <InvestmentForm
          investmentToEdit={investmentToEdit}
          cdiDailyPercent={cdiDailyPercent}
          today={today ?? todayIso()}
          defaultOwner={defaultOwner}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface InvestmentFormProps {
  investmentToEdit: InvestmentView | null;
  cdiDailyPercent: number | null;
  today: IsoDate;
  defaultOwner: string | null;
  onDone: () => void;
}

function parsePercent(text: string): number {
  const value = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

function formatPercentInput(value: number): string {
  return String(value).replace(".", ",");
}

const [DEFAULT_LOW_TIER, DEFAULT_HIGH_TIER] = COFRINHO_DEFAULT_TIERS;

function InvestmentForm({ investmentToEdit, cdiDailyPercent, today, defaultOwner, onDone }: InvestmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = investmentToEdit !== null;

  const [name, setName] = useState(investmentToEdit?.name ?? DEFAULT_NAME);
  const [owner, setOwner] = useState(
    isEditing ? (investmentToEdit.ownerLabel ?? NO_OWNER) : (defaultOwner ?? HOUSEHOLD_MEMBERS[0]),
  );
  const [notes, setNotes] = useState(investmentToEdit?.notes ?? "");

  const [amountStr, setAmountStr] = useState("");
  const [startDate, setStartDate] = useState<IsoDate>(today);
  const [mode, setMode] = useState<RateMode>("cdi");
  const [lowPercentStr, setLowPercentStr] = useState(formatPercentInput(DEFAULT_LOW_TIER.ofCdiPercent));
  const [capStr, setCapStr] = useState(centsToInput(DEFAULT_LOW_TIER.upToCents));
  const [highPercentStr, setHighPercentStr] = useState(formatPercentInput(DEFAULT_HIGH_TIER.ofCdiPercent));
  const [annualStr, setAnnualStr] = useState("");

  const amountCents = inputToCents(amountStr);
  const rate = buildRate({ mode, lowPercentStr, capStr, highPercentStr, annualStr });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Dê um nome ao investimento.");
      return;
    }

    const ownerLabel = owner === NO_OWNER ? null : owner;
    if (investmentToEdit) {
      const { id } = investmentToEdit;
      startTransition(async () => {
        const res = await saveInvestment({
          id,
          name: trimmedName,
          ownerLabel,
          notes: notes.trim() || null,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Investimento atualizado.");
        onDone();
      });
      return;
    }

    const invalid = validateCreation(amountCents, startDate, today, rate);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (!rate.ok) return;

    startTransition(async () => {
      const res = await saveInvestment({
        name: trimmedName,
        ownerLabel,
        initial: { amountCents, date: startDate },
        rate: rate.value,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${trimmedName} cadastrado.`);
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="investment-name" className="text-xs">Nome</Label>
          <Input
            id="investment-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Cofrinho"
            maxLength={100}
            className="mt-1 text-sm"
            required
          />
        </div>
        <div>
          <Label className="text-xs">Responsável</Label>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="mt-1 w-full text-xs" aria-label="Responsável">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUSEHOLD_MEMBERS.map((member) => (
                <SelectItem key={member} value={member} className="text-xs">{member}</SelectItem>
              ))}
              <SelectItem value={NO_OWNER} className="text-xs">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isEditing ? (
        <div>
          <Label htmlFor="investment-notes" className="text-xs">Observações</Label>
          <Textarea
            id="investment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className="mt-1 text-sm"
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="investment-amount" className="text-xs">
                {startDate && startDate < today ? "Quanto você tinha lá nesse dia?" : "Quanto você tem lá hoje?"}
              </Label>
              <Input
                id="investment-amount"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="R$ 0,00"
                className="mt-1 font-mono text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="investment-date" className="text-xs">Desde que dia?</Label>
              <Input
                id="investment-date"
                type="date"
                value={startDate}
                max={today}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 text-sm"
                required
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {startDate && startDate < today
              ? "O app soma sozinho o que rendeu de lá até hoje."
              : "Se não tiver certeza, deixe hoje. O valor começa a render no próximo dia útil."}
          </p>

          <RateFields
            mode={mode}
            onModeChange={setMode}
            lowPercentStr={lowPercentStr}
            onLowPercentChange={setLowPercentStr}
            capStr={capStr}
            onCapChange={setCapStr}
            highPercentStr={highPercentStr}
            onHighPercentChange={setHighPercentStr}
            annualStr={annualStr}
            onAnnualChange={setAnnualStr}
          />

          <YieldPreview amountCents={amountCents} rate={rate.ok ? rate.value : null} cdiDailyPercent={cdiDailyPercent} />
        </>
      )}

      <DialogFooter className="pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : isEditing ? "Salvar" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type RateFieldsProps = {
  mode: RateMode;
  onModeChange: (mode: RateMode) => void;
  lowPercentStr: string;
  onLowPercentChange: (value: string) => void;
  capStr: string;
  onCapChange: (value: string) => void;
  highPercentStr: string;
  onHighPercentChange: (value: string) => void;
  annualStr: string;
  onAnnualChange: (value: string) => void;
};

function RateFields(props: RateFieldsProps) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium text-foreground">Quanto rende</legend>
      <Select value={props.mode} onValueChange={(value) => props.onModeChange(value as RateMode)}>
        <SelectTrigger className="w-full text-xs" aria-label="Tipo de taxa">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cdi" className="text-xs">CDI em faixas (como o Cofrinho)</SelectItem>
          <SelectItem value="annual" className="text-xs">Taxa fixa ao ano</SelectItem>
        </SelectContent>
      </Select>

      {props.mode === "cdi" ? (
        <>
          <p className="text-xs text-muted-foreground">
            O CDI é a taxa de referência dos bancos. Já vem com o padrão do Cofrinho: 120% do CDI até R$ 10.000 e 100% no que passar.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PercentField id="tier-low" label="% do CDI até o teto" value={props.lowPercentStr} onChange={props.onLowPercentChange} />
            <div>
              <Label htmlFor="tier-cap" className="text-xs">Teto (R$)</Label>
              <Input
                id="tier-cap"
                inputMode="decimal"
                value={props.capStr}
                onChange={(e) => props.onCapChange(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <PercentField id="tier-high" label="% do CDI acima" value={props.highPercentStr} onChange={props.onHighPercentChange} />
          </div>
        </>
      ) : (
        <PercentField id="annual-rate" label="Taxa ao ano (%)" value={props.annualStr} onChange={props.onAnnualChange} placeholder="Ex: 10,5" />
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

type RateResult = { ok: true; value: InvestmentRateInput } | { ok: false; error: string };

// Mensagem do primeiro problema do formulário de criação, ou null se estiver tudo certo.
function validateCreation(amountCents: number, startDate: IsoDate, today: IsoDate, rate: RateResult): string | null {
  if (amountCents <= 0) return "Informe quanto você tem lá hoje (maior que R$ 0,00).";
  if (!startDate || startDate > today) return "Escolha um dia até hoje.";
  return rate.ok ? null : rate.error;
}

function buildRate(fields: {
  mode: RateMode;
  lowPercentStr: string;
  capStr: string;
  highPercentStr: string;
  annualStr: string;
}): RateResult {
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

function YieldPreview({
  amountCents,
  rate,
  cdiDailyPercent,
}: {
  amountCents: number;
  rate: InvestmentRateInput | null;
  cdiDailyPercent: number | null;
}) {
  const message = previewMessage(amountCents, rate, cdiDailyPercent);
  return (
    <p aria-live="polite" className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      {message}
    </p>
  );
}

function previewMessage(amountCents: number, rate: InvestmentRateInput | null, cdiDailyPercent: number | null): string {
  if (amountCents <= 0) return "Digite o valor para ver quanto rende por dia útil.";
  if (!rate) return "Confira a taxa para ver quanto rende por dia útil.";
  if (rate.mode === "cdi" && cdiDailyPercent === null) {
    return "A prévia aparece quando o CDI do Banco Central estiver disponível.";
  }
  const daily =
    rate.mode === "annual"
      ? amountCents * fixedDailyFactor(rate.annualPercent)
      : tieredDailyYield(amountCents, rate.tiers, (cdiDailyPercent ?? 0) / 100);
  return `Rende cerca de ${formatCentsToBrl(Math.round(daily))} por dia útil.`;
}
