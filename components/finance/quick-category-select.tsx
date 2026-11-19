"use client";

import type { FinanceCategory } from "@/lib/data/finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { NONE_VALUE, type QuickKind } from "./quick-entry";

interface QuickCategorySelectProps {
  categories: FinanceCategory[];
  kind: QuickKind;
  value: string;
  onChange: (categoryId: string) => void;
  className?: string;
}

// Categoria com o ícone colorido, usada na linha rápida e na folha do celular.
export function QuickCategorySelect({ categories, kind, value, onChange, className }: QuickCategorySelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Categoria" className={cn("w-full text-[13px]", className)}>
        <SelectValue placeholder="Categoria" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE} className="text-[13px]">
          Sem categoria
        </SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-[13px]">
            <CategoryIcon name={c.name} kind={kind} color={c.color} className="size-4" />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
