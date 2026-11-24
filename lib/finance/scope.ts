import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FinanceLedger = "pessoal" | "trustcare";

// De quem são as Finanças que o usuário logado está usando.
// Dono (Luan): ownerId = o próprio id, os dois livros.
// Membro (esposa): ownerId = id do dono, só o livro Pessoal (o banco também barra o resto).
export type FinanceScope = {
  userId: string;
  ownerId: string;
  isMember: boolean;
  ledgers: FinanceLedger[];
};

export const NO_TRUSTCARE_ACCESS = "Sem acesso às Finanças da Trust Care.";
export const OWNER_ONLY = "Só o dono das Finanças pode fazer isso.";

// Uma consulta por requisição, como getCurrentUser. Se não der para saber, falha (não assume dono).
export const getFinanceScope = cache(async (): Promise<FinanceScope> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_member_owner");
  if (error) {
    console.error("getFinanceScope error:", error);
    throw new Error("Não foi possível carregar as Finanças.");
  }

  const ownerId = (data as string | null) ?? null;
  if (!ownerId) {
    return { userId: user.id, ownerId: user.id, isMember: false, ledgers: ["pessoal", "trustcare"] };
  }
  return { userId: user.id, ownerId, isMember: true, ledgers: ["pessoal"] };
});

// Devolve a mensagem de erro (para `fail(...)`) ou null quando o livro é permitido.
export function assertLedgerAllowed(scope: FinanceScope, ledger: FinanceLedger): string | null {
  return scope.ledgers.includes(ledger) ? null : NO_TRUSTCARE_ACCESS;
}

// Devolve a mensagem de erro (para `fail(...)`) ou null quando quem está logado é o dono.
export function requireOwner(scope: FinanceScope): string | null {
  return scope.isMember ? OWNER_ONLY : null;
}

// Filtro de livro para leituras: membro sempre lê só o Pessoal ("all" vira "pessoal");
// pedir Trust Care sendo membro é um erro (a página já força o Pessoal antes de chegar aqui).
export function readableLedger<T extends FinanceLedger | "all" | undefined>(
  scope: FinanceScope,
  ledger: T,
): T | "pessoal" {
  if (!scope.isMember) return ledger;
  if (ledger === "trustcare") throw new Error(NO_TRUSTCARE_ACCESS);
  return "pessoal";
}
