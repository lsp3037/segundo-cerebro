import { ShieldAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Lembrete discreto nos formulários das áreas marcadas com "mostrar aviso LGPD".
export function LgpdNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <ShieldAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
      Não registre dados de pacientes aqui (LGPD). Este conteúdo também não é enviado para a IA.
    </p>
  );
}
