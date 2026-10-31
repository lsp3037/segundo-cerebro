// Formato de retorno das Server Actions: a tela mostra `error` direto ao usuário.
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
