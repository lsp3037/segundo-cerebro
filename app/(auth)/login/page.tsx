import type { Metadata } from "next";

import { BrainMark } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  link: "O link expirou ou já foi usado. Peça um novo abaixo.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { erro, next } = await props.searchParams;
  const error = typeof erro === "string" ? ERRORS[erro] : undefined;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrainMark className="size-10" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Segundo Cérebro</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito.</p>
          </div>
        </div>
        <LoginForm error={error} next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
