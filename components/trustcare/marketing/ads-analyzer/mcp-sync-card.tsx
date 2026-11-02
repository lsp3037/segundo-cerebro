"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
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
  listMetaAdAccounts,
  saveMetaAdsCredentials,
  syncMetaAdsMetrics,
  type MetaAdAccountOption,
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

  // Lista de contas encontradas
  const [availableAccounts, setAvailableAccounts] = useState<MetaAdAccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);

  // Carrega status das credenciais salvas no carregamento inicial
  useEffect(() => {
    getMetaAdsCredentials().then((creds) => {
      if (creds.adAccountId) setAdAccountId(creds.adAccountId);
      if (creds.accessTokenMasked) setTokenMasked(creds.accessTokenMasked);
      if (creds.accountName) setAccountName(creds.accountName);
      if (creds.tokenUpdatedAt) setTokenUpdatedAt(creds.tokenUpdatedAt);
      setIsLive(creds.isLive);
    });
  }, []);

  // Busca lista de contas na Meta
  const fetchAccounts = useCallback(async (tokenToUse?: string) => {
    setLoadingAccounts(true);
    try {
      const res = await listMetaAdAccounts(tokenToUse);
      if (res.ok && res.data.length > 0) {
        setAvailableAccounts(res.data);
        // Se a conta atual for a conta pessoal ou desconhecida, auto-seleciona a conta recomendada (Trust Care)
        const recommended = res.data.find((a) => a.isRecommended);
        if (recommended) {
          setAdAccountId(recommended.id);
        } else if (!res.data.some((a) => a.id === adAccountId)) {
          setAdAccountId(res.data[0].id);
        }
      }
    } catch (err) {
      console.warn("Falha ao buscar contas de anúncio:", err);
    } finally {
      setLoadingAccounts(false);
    }
  }, [adAccountId]);

  // Ao abrir o modal, busca automaticamente as contas disponíveis
  useEffect(() => {
    if (dialogOpen) {
      fetchAccounts(accessToken.trim() || undefined);
    }
  }, [dialogOpen, fetchAccounts, accessToken]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim() && !tokenMasked) {
      return toast.error("Cole o token de acesso gerado no Explorador da Meta.");
    }

    setSaving(true);
    toast.info("Validando conta junto à Graph API da Meta...");

    try {
      const res = await saveMetaAdsCredentials({
        adAccountId,
        accessToken: accessToken.trim() || undefined,
      });

      if (res.ok) {
        toast.success(`Conta conectada com sucesso! Conta: ${res.data.accountName || adAccountId}`);
        setAccountName(res.data.accountName || null);
        if (accessToken.trim()) {
          setTokenMasked(`${accessToken.trim().slice(0, 10)}...${accessToken.trim().slice(-6)}`);
          setTokenUpdatedAt(new Date().toISOString());
        }
        setIsLive(true);
        setAccessToken("");
        setDialogOpen(false);

        // Dispara sincronização automática após salvar a conta correta
        handleSync();
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
    toast.info("Sincronizando campanhas, conjuntos e anúncios da Meta...");

    try {
      const res = await syncMetaAdsMetrics();
      if (res.ok) {
        setLastSync(todayIso());
        if (res.data.syncedCount === 0 && res.data.message) {
          toast.info(res.data.message);
        } else {
          toast.success(res.data.message || `Sincronização concluída! ${res.data.syncedCount} itens sincronizados.`);
        }
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
          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0">
            {isLive ? <ShieldCheckIcon className="size-5 text-emerald-500" /> : <ShieldAlertIcon className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
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
                {isLive ? "Atualizar Token / Conta" : "Configurar Conexão"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <KeyIcon className="size-4 text-orange-600" />
                    Conexão Meta Ads & Seleção de Conta
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Gere o token de acesso no painel da Meta e selecione a conta de anúncios da Trust Care.
                  </DialogDescription>
                </DialogHeader>

                {/* Passo 1: Gerar Token no Explorador da Meta */}
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>1. Gerar Token no Explorador da Meta</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Clique no botão abaixo para abrir a ferramenta oficial da Meta. No menu lateral, adicione a permissão{" "}
                    <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-orange-600 dark:text-orange-400 font-bold">ads_read</code> e clique no botão azul <strong>Gerar token de acesso</strong>.
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

                {/* Passo 2: Token de Acesso */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="meta-token" className="text-xs font-semibold text-foreground">
                      2. Token de Acesso (Access Token)
                    </Label>
                    {tokenMasked && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ Token ativo salvo
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="meta-token"
                    rows={2}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={
                      tokenMasked
                        ? "Opcional: Cole aqui apenas se desejar renovar com um novo token gerado"
                        : "Cole aqui o token longo gerado (começa com EAAG...)"
                    }
                    className="font-mono text-xs resize-none break-all"
                  />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {tokenUpdatedAt ? (
                      <p className="text-[10px] text-muted-foreground">
                        Última renovação: {formatDateTime(tokenUpdatedAt)}
                      </p>
                    ) : <span />}
                    {accessToken.trim().length > 20 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAccounts(accessToken.trim())}
                        disabled={loadingAccounts}
                        className="h-7 text-[11px] gap-1 text-orange-600 border-orange-500/30"
                      >
                        <RefreshCwIcon className={`size-3 ${loadingAccounts ? "animate-spin" : ""}`} />
                        Carregar contas deste token
                      </Button>
                    )}
                  </div>
                </div>

                {/* Passo 3: Seletor de Conta de Anúncios */}
                <div className="space-y-2 pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="meta-account-id" className="text-xs font-semibold text-foreground">
                      3. Conta de Anúncios
                    </Label>
                    {availableAccounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsManualInput(!isManualInput)}
                        className="text-[11px] text-orange-500 hover:underline font-medium"
                      >
                        {isManualInput ? "Selecionar da lista de contas" : "Digitar ID manualmente"}
                      </button>
                    )}
                  </div>

                  {loadingAccounts ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
                      <RefreshCwIcon className="size-3.5 animate-spin text-orange-500" />
                      Consultando contas de anúncio vinculadas ao seu token...
                    </div>
                  ) : availableAccounts.length > 0 && !isManualInput ? (
                    <div className="space-y-2">
                      <select
                        id="meta-account-select"
                        value={adAccountId}
                        onChange={(e) => setAdAccountId(e.target.value)}
                        className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        {availableAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.isRecommended ? "⭐ " : ""}{acc.name} ({acc.id}) {acc.isRecommended ? "— [CONTA TRUST CARE]" : ""}
                          </option>
                        ))}
                      </select>

                      {availableAccounts.some((a) => a.isRecommended && a.id === adAccountId) ? (
                        <div className="flex items-center gap-1.5 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <CheckCircle2Icon className="size-4 shrink-0" />
                          <span>Conta oficial da Trust Care selecionada! As campanhas reais serão carregadas.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                          <SparklesIcon className="size-4 shrink-0 text-amber-600" />
                          <span>Dica: Verifique se selecionou a conta <strong>Trust Care - Meta ADS</strong> com as campanhas de Cuiabá.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        id="meta-account-id"
                        value={adAccountId}
                        onChange={(e) => setAdAccountId(e.target.value)}
                        placeholder="Ex: act_1784... ou act_1671912470896313"
                        className="font-mono text-xs h-9"
                        required
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Insira o ID da conta com prefixo <code>act_</code>.
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
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
                    disabled={saving || (!accessToken.trim() && !tokenMasked)}
                    className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                  >
                    {saving ? (
                      <>
                        <RefreshCwIcon className="size-3.5 animate-spin" />
                        Validando e Sincronizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2Icon className="size-3.5" />
                        Salvar e Sincronizar
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
