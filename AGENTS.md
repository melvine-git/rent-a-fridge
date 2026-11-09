# Rent-a-Fridge

- Next.js 16 (App Router), React 19, TypeScript, Tailwind v4. Package manager: `pnpm` (plain `npm`/`npx` resolve to a broken WSL stub in this shell; use `pnpm exec`).
- Node 24 required (`engines` in package.json). `@supabase/supabase-js` throws on Node 20 ("native WebSocket not found"); for one-off scripts on Node 20, add `--experimental-websocket`.
- Checks: `pnpm exec tsc --noEmit -p .`, `pnpm lint`, `pnpm build`. If the build fails on `.next/dev/types/validator.ts`, delete `.next/dev/types` (stale cache from another branch).
- Data lives in Supabase (Postgres + Storage), accessed only server-side in `src/lib/db.ts` / `src/lib/uploads.ts` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (in `.env.local` locally, Vercel env vars in production). Local dev and the live site share the same Supabase data.
- Schema: `supabase/migrations/`. Each table stores one record per row as `data jsonb`; `readDb()` loads everything and `writeDb(db)` upserts/deletes only changed rows.
- `data/db.json` is the old file store, kept only as the source for `scripts/seed-supabase.mjs`.
