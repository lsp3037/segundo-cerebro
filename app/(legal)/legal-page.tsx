import Link from "next/link";

import { BrainMark } from "@/components/brand";

// Páginas públicas exigidas pelo Google para publicar o app (privacidade e termos).
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-sm font-semibold">
        <BrainMark className="size-5" />
        Segundo Cérebro
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Atualizado em {updated}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
