"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { payPersonalTransactionViaApi } from "@/lib/integrations/finance-api";
import { type ActionResult, fail, ok } from "./result";

const uuidSchema = z.string().uuid("Lançamento inválido.");

export async function payPersonalBillAction(
  transactionId: string,
  paid?: boolean,
): Promise<ActionResult<{ status: string }>> {
  await getCurrentUser();
  if (!uuidSchema.safeParse(transactionId).success) {
    return fail("Lançamento inválido.");
  }

  const res = await payPersonalTransactionViaApi(transactionId, paid);
  if (!res.ok) return fail(res.error);

  revalidatePath("/", "layout");
  revalidatePath("/hoje");
  revalidatePath("/financas");
  revalidatePath("/revisao");
  return ok({ status: res.status });
}
