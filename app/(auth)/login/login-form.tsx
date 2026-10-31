"use client";

import { Loader2Icon, MailIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm({ error, next }: { error?: string; next?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [status, setStatus] = useState<Status>(error ? { kind: "error", message: error } : { kind: "idle" });

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  async function signInWithGoogle() {
    setLoading("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setLoading(null);
      setStatus({ kind: "error", message: "Não foi possível abrir o login do Google." });
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("email");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setLoading(null);
    // Mensagem genérica de propósito: não revela quais e-mails têm acesso.
    setStatus(
      error
        ? { kind: "error", message: "Não foi possível enviar o link para esse e-mail." }
        : { kind: "sent" },
    );
  }

  return (
    <div className="space-y-5 rounded-xl border bg-background p-6 shadow-sm">
      {status.kind === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={loading !== null}
      >
        {loading === "google" ? <Loader2Icon className="animate-spin" /> : <GoogleIcon />}
        Entrar com Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        ou
        <Separator className="flex-1" />
      </div>

      {status.kind === "sent" ? (
        <p className="rounded-lg bg-muted px-3 py-3 text-sm">
          Enviamos um link para <strong>{email}</strong>. Abra-o <strong>neste mesmo navegador</strong> para
          entrar.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading !== null}>
            {loading === "email" ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
            Receber link de acesso
          </Button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.94 10.94 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
