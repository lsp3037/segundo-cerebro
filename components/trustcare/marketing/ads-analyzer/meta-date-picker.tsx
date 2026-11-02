"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  todayIso,
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  type IsoDate,
} from "@/lib/dates";

export type MetaDatePreset =
  | "today"
  | "yesterday"
  | "today_yesterday"
  | "last_7d"
  | "last_14d"
  | "last_28d"
  | "last_30d"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "maximum"
  | "custom";

export interface MetaDateRangeValue {
  preset: MetaDatePreset;
  startDate: IsoDate;
  endDate: IsoDate;
  label: string;
}

interface MetaDatePickerProps {
  value?: MetaDateRangeValue;
  onChange: (value: MetaDateRangeValue) => void;
  className?: string;
}

const PRESET_OPTIONS: { id: MetaDatePreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "today_yesterday", label: "Hoje e ontem" },
  { id: "last_7d", label: "Últimos 7 dias" },
  { id: "last_14d", label: "Últimos 14 dias" },
  { id: "last_28d", label: "Últimos 28 dias" },
  { id: "last_30d", label: "Últimos 30 dias" },
  { id: "this_week", label: "Esta semana" },
  { id: "last_week", label: "Semana passada" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "maximum", label: "Máximo" },
  { id: "custom", label: "Personalizado" },
];

const MONTH_NAMES_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function computeRangeForPreset(preset: MetaDatePreset, refToday = todayIso()): {
  startDate: IsoDate;
  endDate: IsoDate;
  label: string;
} {
  switch (preset) {
    case "today":
      return { startDate: refToday, endDate: refToday, label: "Hoje" };
    case "yesterday": {
      const y = addDays(refToday, -1);
      return { startDate: y, endDate: y, label: "Ontem" };
    }
    case "today_yesterday":
      return { startDate: addDays(refToday, -1), endDate: refToday, label: "Hoje e ontem" };
    case "last_7d":
      return { startDate: addDays(refToday, -6), endDate: refToday, label: "Últimos 7 dias" };
    case "last_14d":
      return { startDate: addDays(refToday, -13), endDate: refToday, label: "Últimos 14 dias" };
    case "last_28d":
      return { startDate: addDays(refToday, -27), endDate: refToday, label: "Últimos 28 dias" };
    case "last_30d":
      return { startDate: addDays(refToday, -29), endDate: refToday, label: "Últimos 30 dias" };
    case "this_week":
      return { startDate: startOfWeek(refToday), endDate: refToday, label: "Esta semana" };
    case "last_week": {
      const prevMon = addDays(startOfWeek(refToday), -7);
      const prevSun = addDays(prevMon, 6);
      return { startDate: prevMon, endDate: prevSun, label: "Semana passada" };
    }
    case "this_month":
      return { startDate: startOfMonth(refToday), endDate: refToday, label: "Este mês" };
    case "last_month": {
      const prevMonthRef = addMonths(refToday, -1);
      return {
        startDate: startOfMonth(prevMonthRef),
        endDate: endOfMonth(prevMonthRef),
        label: "Mês passado",
      };
    }
    case "maximum":
      return { startDate: "2024-01-01", endDate: refToday, label: "Máximo" };
    case "custom":
    default:
      return { startDate: addDays(refToday, -29), endDate: refToday, label: "Personalizado" };
  }
}

function formatDatePtBr(iso: IsoDate): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const monthName = MONTH_NAMES_SHORT[month - 1] || "";
  return `${day} de ${monthName} de ${year}`;
}

export function MetaDatePicker({ value, onChange, className }: MetaDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => todayIso(), []);

  // Estado interno enquanto o modal está aberto
  const initial = useMemo(() => {
    if (value) return value;
    const computed = computeRangeForPreset("last_30d", today);
    return {
      preset: "last_30d" as MetaDatePreset,
      startDate: computed.startDate,
      endDate: computed.endDate,
      label: computed.label,
    };
  }, [value, today]);

  const [tempPreset, setTempPreset] = useState<MetaDatePreset>(initial.preset);
  const [tempStart, setTempStart] = useState<IsoDate>(initial.startDate);
  const [tempEnd, setTempEnd] = useState<IsoDate>(initial.endDate);

  // Mês visível no primeiro calendário (o segundo mostra month + 1)
  const [viewYearMonth, setViewYearMonth] = useState<[number, number]>(() => {
    const end = initial.endDate || today;
    const [y, m] = end.split("-").map(Number);
    // Mostra o mês anterior e o mês atual
    const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
    return [prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth()];
  });

  // Sincroniza se o valor mudar externamente
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && value) {
      setTempPreset(value.preset);
      setTempStart(value.startDate);
      setTempEnd(value.endDate);
    }
    setOpen(nextOpen);
  }, [value]);

  const handleSelectPreset = (preset: MetaDatePreset) => {
    setTempPreset(preset);
    if (preset !== "custom") {
      const computed = computeRangeForPreset(preset, today);
      setTempStart(computed.startDate);
      setTempEnd(computed.endDate);

      // Ajusta a visualização para o mês do fim do período
      const [y, m] = computed.endDate.split("-").map(Number);
      const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
      setViewYearMonth([prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth()]);
    }
  };

  const handleDayClick = (clickedIso: IsoDate) => {
    if (!tempStart || (tempStart && tempEnd && tempStart !== tempEnd)) {
      // Começa nova seleção
      setTempStart(clickedIso);
      setTempEnd(clickedIso);
      setTempPreset("custom");
    } else {
      // Fecha a seleção
      if (clickedIso < tempStart) {
        setTempEnd(tempStart);
        setTempStart(clickedIso);
      } else {
        setTempEnd(clickedIso);
      }
      setTempPreset("custom");
    }
  };

  const handleApply = () => {
    const presetObj = PRESET_OPTIONS.find((p) => p.id === tempPreset);
    onChange({
      preset: tempPreset,
      startDate: tempStart,
      endDate: tempEnd,
      label: presetObj?.label || "Personalizado",
    });
    setOpen(false);
  };

  const handleCancel = () => {
    if (value) {
      setTempPreset(value.preset);
      setTempStart(value.startDate);
      setTempEnd(value.endDate);
    }
    setOpen(false);
  };

  const navigateMonth = (direction: -1 | 1) => {
    setViewYearMonth(([y, m]) => {
      const next = new Date(Date.UTC(y, m + direction, 1));
      return [next.getUTCFullYear(), next.getUTCMonth()];
    });
  };

  // Calcula os dois meses visíveis
  const leftMonth = viewYearMonth;
  const rightMonth: [number, number] = useMemo(() => {
    const d = new Date(Date.UTC(leftMonth[0], leftMonth[1] + 1, 1));
    return [d.getUTCFullYear(), d.getUTCMonth()];
  }, [leftMonth]);

  // Renderizador de grade de dias de 1 mês
  const renderMonthDays = (year: number, month: number) => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    // 0 = domingo ... 6 = sábado -> ajusta para segunda-feira = 0
    let startDayOfWeek = (firstDay.getUTCDay() + 6) % 7;

    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }

    return (
      <div className="space-y-1">
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="size-8" />;
            }

            const monthStr = String(month + 1).padStart(2, "0");
            const dayStr = String(day).padStart(2, "0");
            const currentIso = `${year}-${monthStr}-${dayStr}`;

            const isStart = currentIso === tempStart;
            const isEnd = currentIso === tempEnd;
            const inRange = currentIso >= tempStart && currentIso <= tempEnd;
            const isToday = currentIso === today;

            return (
              <button
                type="button"
                key={currentIso}
                onClick={() => handleDayClick(currentIso)}
                className={`size-8 flex items-center justify-center font-medium text-xs transition relative
                  ${inRange && !isStart && !isEnd ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : ""}
                  ${isStart || isEnd ? "bg-[#0064e0] text-white font-bold rounded-md z-10 shadow-xs" : "hover:bg-muted rounded-md"}
                  ${isToday && !inRange ? "border border-blue-500 font-bold" : ""}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const currentLabel = value?.label || initial.label;
  const currentStart = value?.startDate || initial.startDate;
  const currentEnd = value?.endDate || initial.endDate;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 px-3 gap-2 text-xs font-medium border-border/80 bg-background/50 hover:bg-muted text-foreground ${className}`}
        >
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          <span className="truncate">
            <strong>{currentLabel}:</strong> {formatDatePtBr(currentStart)} a {formatDatePtBr(currentEnd)}
          </span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[95vw] sm:w-[680px] p-0 bg-popover rounded-xl border border-border shadow-2xl overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Coluna da Esquerda: Lista de Opções Pré-definidas */}
          <div className="w-full sm:w-[190px] shrink-0 p-3 space-y-1 max-h-[300px] sm:max-h-[380px] overflow-y-auto">
            {PRESET_OPTIONS.map((opt) => {
              const selected = tempPreset === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectPreset(opt.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition
                    ${selected ? "bg-[#0064e0]/10 text-[#0064e0] dark:text-blue-400 font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                  `}
                >
                  <span
                    className={`size-3.5 rounded-full border flex items-center justify-center shrink-0
                      ${selected ? "border-[#0064e0] bg-[#0064e0]" : "border-muted-foreground/40"}
                    `}
                  >
                    {selected && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Coluna da Direita: Calendários e Detalhes do Período */}
          <div className="flex-1 p-4 space-y-4">
            {/* Navegadores de Mês */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Calendário 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => navigateMonth(-1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <span className="text-xs font-bold capitalize">
                    {MONTH_NAMES_SHORT[leftMonth[1]]} {leftMonth[0]}
                  </span>
                  <div className="size-7" />
                </div>
                {renderMonthDays(leftMonth[0], leftMonth[1])}
              </div>

              {/* Calendário 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="size-7" />
                  <span className="text-xs font-bold capitalize">
                    {MONTH_NAMES_SHORT[rightMonth[1]]} {rightMonth[0]}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => navigateMonth(1)}
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
                {renderMonthDays(rightMonth[0], rightMonth[1])}
              </div>
            </div>

            {/* Inputs de Data e Resumo */}
            <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <input
                  type="checkbox"
                  id="compare-check"
                  disabled
                  className="rounded border-muted-foreground/30 text-blue-600 size-3.5"
                />
                <label htmlFor="compare-check" className="cursor-not-allowed text-[11px]">
                  Comparar períodos
                </label>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded border bg-background font-mono text-[11px] text-foreground">
                  {formatDatePtBr(tempStart)}
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="px-2 py-1 rounded border bg-background font-mono text-[11px] text-foreground">
                  {formatDatePtBr(tempEnd)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com Fuso Horário de Cuiabá e Botões */}
        <div className="bg-muted/40 px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            Fuso horário das datas: <strong>America/Cuiaba</strong>
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs px-3"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="h-8 text-xs px-4 bg-[#0064e0] hover:bg-[#0052b8] text-white font-medium"
            >
              Atualizar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
