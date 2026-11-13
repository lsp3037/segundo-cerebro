import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// Cartão da coluna lateral da aba Hoje. Todos os cartões usam este molde para ficarem iguais.
export function AsideCard({
  icon: Icon,
  title,
  meta,
  action,
  tone,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  // Texto curto ao lado do título (ex.: "2/3").
  meta?: React.ReactNode;
  action?: { label: string; href: string };
  tone?: "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        tone === "warning" && "border-amber-500/30",
        tone === "danger" && "border-rose-500/30",
        className,
      )}
    >
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
        <Icon
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            tone === "warning" && "text-amber-500",
            tone === "danger" && "text-rose-400",
          )}
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta !== undefined && meta !== null && <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>}
        {action && (
          <Link href={action.href} className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground">
            {action.label}
          </Link>
        )}
      </header>
      <div className="px-1.5 pb-1.5">{children}</div>
    </section>
  );
}

// Texto de cartão vazio, alinhado ao conteúdo do cartão.
export function AsideEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pt-1 pb-2.5 text-sm text-muted-foreground">{children}</p>;
}
