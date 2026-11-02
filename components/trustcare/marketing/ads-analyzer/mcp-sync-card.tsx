"use client";

import { useState } from "react";
import { RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncMetaAdsMetrics } from "@/lib/actions/meta-ads-sync";
import { todayIso } from "@/lib/dates";

interface McpSyncCardProps {
  onSyncComplete?: () => void;
}

export function McpSyncCard({ onSyncComplete }: McpSyncCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(todayIso());

  const handleSync = async () => {
    setSyncing(true);
    toast.info("Iniciando conexão com MCP Meta Ads...");

    try {
      const res = await syncMetaAdsMetrics();
      if (res.ok) {
        setLastSync(todayIso());
        toast.success(`Sincronização concluída! ${res.data.syncedCount} registros atualizados.`);
        if (onSyncComplete) onSyncComplete();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Falha ao comunicar com o servidor MCP Meta Ads.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">Integração MCP Meta Ads</h4>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Conectado
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Coleta automática de impressões, cliques, CTR e conversões de WhatsApp em Cuiabá.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastSync && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Última sincronização: <strong>Hoje</strong>
            </span>
          )}
          <Button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-2 text-xs h-9"
          >
            <RefreshCwIcon className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Meta Ads"}
          </Button>
        </div>
      </div>
    </div>
  );
}
