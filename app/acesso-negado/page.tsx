import type { Metadata } from "next";
import Link from "next/link";

import { BrainMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acesso negado" };

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <BrainMark className="mx-auto size-10" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            Este é um sistema pessoal e esta conta não tem permissão para entrar.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">Entrar com outra conta</Link>
        </Button>
      </div>
    </main>
  );
}
