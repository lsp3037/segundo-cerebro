"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DayMode } from "./quick-entry";

interface QuickDaySelectProps {
  value: DayMode;
  onChange: (mode: DayMode) => void;
  className?: string;
}

// "Hoje", "Ontem" ou "Outro dia" (quem usa mostra o campo de data no último caso).
export function QuickDaySelect({ value, onChange, className }: QuickDaySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DayMode)}>
      <SelectTrigger aria-label="Dia" className={cn("text-[13px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today" className="text-[13px]">
          Hoje
        </SelectItem>
        <SelectItem value="yesterday" className="text-[13px]">
          Ontem
        </SelectItem>
        <SelectItem value="other" className="text-[13px]">
          Outro dia
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
