import Link from "next/link";

import { BrainMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60svh] items-center justify-center px-4">
      <div className="space-y-5 text-center">
        <BrainMark className="mx-auto size-9 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">Ela pode ter sido movida ou enviada para a lixeira.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/hoje">Voltar para Hoje</Link>
        </Button>
      </div>
    </main>
  );
}
