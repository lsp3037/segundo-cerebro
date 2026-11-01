"use client";

import { AlertTriangleIcon, Loader2Icon, PlusIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/components/workspace";
import { disconnectGoogle, setCalendarArea, setCalendarSync, syncNow } from "@/lib/actions/events";
import type { ConnectionView } from "@/lib/data/google";
import { formatDateTime } from "@/lib/dates";

const NONE = "__none__";

const STATUS: Record<string, { tone: "ok" | "error"; text: string }> = {
  conectado: { tone: "ok", text: "Conta conectada. A primeira sincronização roda em segundo plano: recarregue a página em alguns segundos." },
  cancelado: { tone: "error", text: "A conexão foi cancelada na tela do Google." },
  "sem-permissao": { tone: "error", text: "Faltou marcar a permissão do Google Agenda na tela do Google. Tente de novo." },
  "sem-refresh": { tone: "error", text: "O Google não devolveu o acesso permanente. Remova o app em myaccount.google.com/permissions e conecte de novo." },
  "erro-seguranca": { tone: "error", text: "A conexão expirou ou veio de outra aba. Tente de novo." },
  "nao-configurado": { tone: "error", text: "Faltam as chaves do Google no servidor (veja o README, Fase 3)." },
  erro: { tone: "error", text: "Não foi possível conectar. Tente de novo em instantes." },
};

export function GoogleSettings({ connections, status }: { connections: ConnectionView[]; status: string | null }) {
  const router = useRouter();
  const { areas } = useWorkspace();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const message = status ? STATUS[status] : null;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Erro.");
      else if (success) toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {message && (
        <p
          className={
            message.tone === "ok"
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
              : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
          }
        >
          {message.text}
        </p>
      )}

      {connections.map((conn) => (
        <div key={conn.id} className="rounded-xl border">
          <div className="flex items-center gap-3 border-b px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{conn.email}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className={confirming === conn.id ? "text-destructive hover:text-destructive" : undefined}
              onClick={() => {
                if (confirming !== conn.id) {
                  setConfirming(conn.id);
                  return;
                }
                setConfirming(null);
                run(() => disconnectGoogle(conn.id), "Conta desconectada.");
              }}
            >
              <UnplugIcon />
              {confirming === conn.id ? "Confirmar: tirar do app" : "Desconectar"}
            </Button>
          </div>
          <ul className="divide-y">
            {conn.calendars.map((cal) => (
              <li key={cal.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cal.color ?? "#737373" }} />
                <div className="min-w-40 flex-1">
                  <p className="text-sm">
                    {cal.name}
                    {cal.is_primary && <span className="ml-1.5 text-xs text-muted-foreground">(principal)</span>}
                    {!cal.writable && <span className="ml-1.5 text-xs text-muted-foreground">(só leitura)</span>}
                  </p>
                  {cal.sync_enabled && (
                    <p className="text-xs text-muted-foreground">
                      {cal.last_error ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangleIcon className="size-3" />
                          {cal.last_error}
                        </span>
                      ) : cal.last_synced_at ? (
                        `Sincronizada em ${formatDateTime(cal.last_synced_at)}`
                      ) : (
                        "Sincronizando…"
                      )}
                    </p>
                  )}
                </div>
                <Select
                  value={cal.default_area_id ?? NONE}
                  onValueChange={(v) => run(() => setCalendarArea(cal.id, v === NONE ? null : v))}
                >
                  <SelectTrigger size="sm" className="w-40" aria-label={`Área de ${cal.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem área</SelectItem>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Switch
                  checked={cal.sync_enabled}
                  disabled={pending}
                  aria-label={`Sincronizar ${cal.name}`}
                  onCheckedChange={(enabled) =>
                    run(() => setCalendarSync(cal.id, enabled), enabled ? "Agenda ligada. Os eventos chegam em instantes." : "Agenda desligada.")
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant={connections.length ? "outline" : "default"} size="sm">
          <a href="/api/google/connect">
            <PlusIcon />
            {connections.length ? "Conectar outra conta" : "Conectar Google Agenda"}
          </a>
        </Button>
        {connections.length > 0 && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(syncNow, "Agendas atualizadas.")}>
            {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
            Sincronizar agora
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Eventos de agendas ligadas a uma área travada para a IA (ex.: Profissional) nunca são enviados ao Gemini.
        Desconectar tira os eventos do app, mas eles continuam no Google.
      </p>
    </div>
  );
}
