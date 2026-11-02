"use client";

import { useState } from "react";
import { HelpCircleIcon, KeyIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { syncMetaAdsMetrics } from "@/lib/actions/meta-ads-sync";
import { todayIso } from "@/lib/dates";

interface McpSyncCardProps {
  onSyncComplete?: () => void;
}

export function McpSyncCard({ onSyncComplete }: McpSyncCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(todayIso());
  const [helpOpen, setHelpOpen] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    toast.info("Sincronizando métricas de anúncios...");

    try {
      const res = await syncMetaAdsMetrics();
      if (res.ok) {
        setLastSync(todayIso());
        toast.success(`Sincronização concluída! ${res.data.syncedCount} métricas atualizadas.`);
        if (onSyncComplete) onSyncComplete();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Falha ao comunicar com o conector Meta Ads.");
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
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                <HelpCircleIcon className="size-3.5" />
                Como Configurar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyIcon className="size-4 text-orange-600" />
                  Configuração do Meta Ads / MCP
                </DialogTitle>
                <DialogDescription>
                  Para conectar sua conta real de anúncios da Trust Care (Facebook / Instagram Ads):
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="font-semibold text-foreground text-xs">
                    1. Gerar o Token de Acesso (Meta for Developers):
                  </p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Acesse <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline text-foreground">developers.facebook.com</a>.</li>
                    <li>Crie um aplicativo do tipo <strong>Negócios</strong> (Business) e adicione o produto <strong>Marketing API</strong>.</li>
                    <li>Gere um Token de Acesso de Sistema com a permissão <code className="bg-muted px-1 rounded">ads_read</code>.</li>
                  </ol>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="font-semibold text-foreground text-xs">
                    2. Adicionar as variáveis no arquivo <code className="bg-muted px-1 rounded">.env.local</code> e na Vercel:
                  </p>
                  <pre className="bg-black/80 text-emerald-400 p-2.5 rounded font-mono text-[11px] overflow-x-auto whitespace-pre">
{`META_ACCESS_TOKEN="EAAG..."
META_AD_ACCOUNT_ID="act_1234567890"`}
                  </pre>
                </div>

                <p className="text-[11px]">
                  💡 <em>Enquanto você não adiciona as chaves reais, o sistema funciona com dados simulados realistas calibrados para Cuiabá e Várzea Grande, permitindo testar diagnósticos de IA e matriz de ângulos.</em>
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {lastSync && (
            <span className="text-[11px] text-muted-foreground hidden lg:inline">
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
