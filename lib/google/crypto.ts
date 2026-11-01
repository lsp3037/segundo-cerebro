import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Tokens do Google são guardados criptografados (AES-256-GCM) com TOKEN_ENCRYPTION_KEY.
// Quem tiver só o banco não consegue usá-los.
function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY ausente ou inválida (32 bytes em base64).");
  return buf;
}

export function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string) {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Assinatura usada nos canais de aviso do Google e no estado do login.
export function sign(value: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET ausente.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
