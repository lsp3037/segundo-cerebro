"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getMetaAdsCredentials,
  saveMetaAdsCredentials,
  syncMetaAdsMetrics,
} from "@/lib/actions/meta-ads-sync";
import { formatDateTime, todayIso } from "@/lib/dates";

interface McpSyncCardProps {
  onSyncComplete?: () => void;
}

export function McpSyncCard({ onSyncComplete }: McpSyncCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(todayIso());
  const [dialogOpen, setDialogOpen] = useState(false);

  // Dados de credenciais
  const [adAccountId, setAdAccountId] = useState("act_1671912470896313");
  const [accessToken, setAccessToken] = useState("");
  const [tokenMasked, setTokenMasked] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Carrega status das credenciais salvas
  useEffect(() => {
    getMetaAdsCredentials().then((creds) => {
      if (creds.adAccountId) setAdAccountId(creds.adAccountId);
      if (creds.accessTokenMasked) setTokenMasked(creds.accessTokenMasked);
      if (creds.accountName) setAccountName(creds.accountName);
      if (creds.tokenUpdatedAt) setTokenUpdatedAt(creds.tokenUpdatedAt);
      setIsLive(creds.isLive);
    });
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) {
      return toast.error("Cole o token de acesso gerado no Explorador da Meta.");
    }

    setSaving(true);
    toast.info("Validando token junto à Graph API da Meta...");

    try {
      const res = await saveMetaAdsCredentials({
        adAccountId,
        accessToken,
      });

      if (res.ok) {
        toast.success(`Conexão validada com sucesso! Conta: ${res.data.accountName || adAccountId}`);
        setAccountName(res.data.accountName || null);
        setTokenMasked(`${accessToken.trim().slice(0, 10)}...${accessToken.trim().slice(-6)}`);
        setTokenUpdatedAt(new Date().toISOString());
        setIsLive(true);
        setAccessToken("");
        setDialogOpen(false);
        if (onSyncComplete) onSyncComplete();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro inesperado ao salvar e validar credenciais.");
    } finally {
      setSaving(false);
    }
  };

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
            {isLive ? <ShieldCheckIcon className="size-5 text-emerald-500" /> : <ShieldAlertIcon className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">Integração MCP Meta Ads</h4>
              {isLive ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Conta Real Conectada
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Modo Simulado (Cuiabá)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLive
                ? `Conectado à conta ${adAccountId}${accountName ? ` (${accountName})` : ""}.`
                : "Insira seu token para sincronizar anúncios reais da Trust Care diretamente."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Modal para Inserir e Atualizar o Token */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                <KeyIcon className="size-3.5 text-orange-500" />
                {isLive ? "Atualizar Token" : "Configurar Token"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <KeyIcon className="size-4 text-orange-600" />
                    Conexão Meta Ads & Token de Acesso
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Como o token de acesso temporário da Meta expira periodicamente, você pode gerar um novo e
                    salvar aqui a qualquer momento sem precisar mexer em código ou variáveis de servidor.
                  </DialogDescription>
                </DialogHeader>

                {/* Atalho direto para o Explorador da Meta */}
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span>1. Passo Rápido: Gerar o Token</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Clique no botão abaixo para abrir a ferramenta da Meta. Selecione a permissão{" "}
                    <code className="bg-muted px-1 rounded font-mono text-[10px]">ads_read</code> e clique em{" "}
                    <strong>Gerar token de acesso</strong>.
                  </p>
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-orange-700 transition"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                    Abrir Explorador da Graph API na Meta
                  </a>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="meta-account-id" className="text-xs font-medium">
                      ID da Conta de Anúncios
                    </Label>
                    <Input
                      id="meta-account-id"
                      value={adAccountId}
                      onChange={(e) => setAdAccountId(e.target.value)}
                      placeholder="Ex: act_1671912470896313"
                      className="font-mono text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meta-token" className="text-xs font-medium">
                        Novo Token de Acesso (Access Token)
                      </Label>
                      {tokenMasked && (
                        <span className="text-[11px] text-muted-foreground">
                          Atual: <code className="font-mono">{tokenMasked}</code>
                        </span>
                      )}
                    </div>
                    <Textarea
                      id="meta-token"
                      rows={3}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Cole aqui o token longo gerado (começa com EAAG...)"
                      className="font-mono text-xs"
                      required
                    />
                    {tokenUpdatedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Última renovação: {formatDateTime(tokenUpdatedAt)}
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving || !accessToken.trim()}
                    className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                  >
                    {saving ? (
                      <>
                        <RefreshCwIcon className="size-3.5 animate-spin" />
                        Validando na Meta...
                      </>
                    ) : (
                      <>
                        <CheckCircle2Icon className="size-3.5" />
                        Salvar e Testar Conexão
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
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
