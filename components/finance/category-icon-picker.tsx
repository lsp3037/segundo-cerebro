"use client";

import { CATEGORY_ICON_KEYS, categoryIconKey, type CategoryIconKey } from "@/lib/finance/category-icons";
import { CATEGORY_ICON_COMPONENTS } from "./category-icon";
import { CATEGORY_ICON_LABELS } from "./category-icon-labels";

interface CategoryIconPickerProps {
  value: CategoryIconKey | null;
  onChange: (icon: CategoryIconKey | null) => void;
  name: string;
  kind: "income" | "expense";
  color: string;
}

const MUTED_COLOR = "#94a3b8";

// Grade de escolha do ícone. "Automático" usa o ícone deduzido pelo nome digitado.
export function CategoryIconPicker({ value, onChange, name, kind, color }: CategoryIconPickerProps) {
  const autoKey = categoryIconKey(name, kind, null);
  const AutoIcon = CATEGORY_ICON_COMPONENTS[autoKey];
  const autoSelected = value === null;
  const currentLabel = autoSelected
    ? `Automático: ${CATEGORY_ICON_LABELS[autoKey]}`
    : CATEGORY_ICON_LABELS[value];

  return (
    <div>
      <div role="radiogroup" aria-label="Ícone da categoria" className="mt-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          role="radio"
          aria-checked={autoSelected}
          aria-label={`Automático (hoje: ${CATEGORY_ICON_LABELS[autoKey]})`}
          title={`Automático: o app escolhe pelo nome. Hoje seria ${CATEGORY_ICON_LABELS[autoKey]}`}
          onClick={() => onChange(null)}
          className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
            autoSelected
              ? "border-primary bg-muted ring-2 ring-primary/60"
              : "border-border text-muted-foreground hover:bg-muted/60"
          }`}
        >
          <AutoIcon
            aria-hidden="true"
            className="size-[17px] shrink-0"
            style={{ color: autoSelected ? color : MUTED_COLOR }}
          />
          Automático
        </button>
        {CATEGORY_ICON_KEYS.map((key) => {
          const Icon = CATEGORY_ICON_COMPONENTS[key];
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={CATEGORY_ICON_LABELS[key]}
              title={CATEGORY_ICON_LABELS[key]}
              onClick={() => onChange(key)}
              className={`flex size-9 items-center justify-center rounded-md border transition-colors ${
                selected ? "border-primary bg-muted ring-2 ring-primary/60" : "border-border hover:bg-muted/60"
              }`}
            >
              <Icon
                aria-hidden="true"
                className="size-[17px]"
                style={{ color: selected ? color : MUTED_COLOR }}
              />
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{currentLabel}</p>
    </div>
  );
}
