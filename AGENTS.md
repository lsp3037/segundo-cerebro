<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (Segundo Cérebro)

Personal system for a single, non-technical user (Luan). UI and docs are in Brazilian Portuguese. Read `docs/PRD.md` (what/why), `docs/PLANO.md` (technical plan and decision log) and `docs/OPERACAO.md` (testing, troubleshooting, open items) before changing anything.

- Work one phase at a time and wait for Luan's approval before starting a phase. One commit per step; the app must work at the end of each phase.
- External actions (keys, Google Cloud, Vercel, Supabase dashboard) are done by Luan, one at a time, explained simply. Never ask for secrets in chat and never read `.env.local` values.
- Every table has RLS: use `select private.apply_owner_policy('public.table');` and end each migration with `select private.assert_rls_enabled();`. Regenerate `lib/supabase/database.types.ts` after migrations.
- Content from areas with `ai_enabled = false` (Profissional, Finanças) never goes to the AI provider; call `assertAreaAllowsAi` before sending. Customer conversations go through `lib/mask.ts` first.
- The O.S. manager (Supabase "Trust Care") is read-only for this project: only its public API with an `orders:read` key.
- Dates use Cuiabá time (`lib/dates.ts`); money is stored in cents.
- Dev server runs on port 3333. Do not run `next build` while it is running (shared `.next`).
- Constants shared by server and client components live in modules without `"use client"`.
