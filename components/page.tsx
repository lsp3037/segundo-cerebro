import { CheckIcon } from "lucide-react";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  icon,
  accent,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: string | null;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50"
            style={accent ? { color: accent } : undefined}
          >
            <Icon name={icon} className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
      </div>
      {children}
    </header>
  );
}

// Espaço reservado das telas que chegam nas próximas fases.
export function PhasePlaceholder({
  phase,
  items,
  className,
}: {
  phase: number;
  items: string[];
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-8", className)}>
      <div className="max-w-xl rounded-xl border border-dashed p-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Chega na Fase {phase}</p>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
