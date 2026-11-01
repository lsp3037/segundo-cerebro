// Grava no Vault do Supabase o endereço do app e o CRON_SECRET, usados pela rotina do pg_cron.
// Lê os valores do .env.local e não imprime nenhum segredo.
// Uso: node scripts/set-vault.mjs https://segundo-cerebro-one-omega.vercel.app
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const appUrl = process.argv[2];
if (!appUrl?.startsWith("https://")) {
  console.log("Informe o endereço https do app. Ex.: node scripts/set-vault.mjs https://segundo-cerebro-one-omega.vercel.app");
  process.exit(1);
}
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "CRON_SECRET"]) {
  if (!env[k]) {
    console.log(`Falta ${k} no .env.local`);
    process.exit(1);
  }
}

for (const [name, value] of [
  ["cron_secret", env.CRON_SECRET],
  ["app_url", appUrl],
]) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/admin_set_secret`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ secret_name: name, secret_value: value }),
  });
  console.log(name, res.ok ? "gravado" : `erro ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
