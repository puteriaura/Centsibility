# Centsibility

The current release candidate lives in this project root on `codex/local-upgrade-rehearsal`. Older branches remain preserved. Do not copy an older checkout over this folder.

## Run locally

Use Node.js 24 and the existing lockfile. Run `npm ci`, then `npm run dev`. Open the local address printed by Vite (normally port 3000). Docker is not required for the frontend.

For authenticated backend use, configure the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in an uncommitted `.env.local`. Check the exact key name against `src/integrations/supabase/client.ts` before configuration. Never put the service-role key or AI/provider keys in a `VITE_` variable. Server configuration is documented in `analysis/STAGING-SETUP.md`.

Development-only demo controls use synthetic responses. They are removed from production builds. Demo balances, quotes and PIN outcomes do not prove real backend behavior. The card is a practice card and cannot make bank-card payments.

## Checks

```powershell
npx tsc --noEmit
python analysis/check-server-types.py
npx vitest run
node tests/runtime/penny-minimization.mjs
node tests/runtime/penny-red-team.mjs
node tests/runtime/market.mjs
node tests/runtime/legacy-fund-display.mjs
npm run build
node analysis/scan-client-boundaries.mjs
```

With a local dev server running, set `LOCAL_DEV_URL` to its localhost address and run `node analysis/verify-ui-assertions.mjs` and `node analysis/verify-route-smoke.mjs`. These checks block remote requests. Browser checks require the installed Chrome and Playwright. Screenshots and JSON results live in `analysis/corrected-ui` and `analysis/route-smoke-results.json`.

## Finish and release

Read `analysis/WRAPUP-STATUS.md` and the wrap-up section of `analysis/DEPLOY-RUNBOOK.md`. No push or deployment has been performed. Vercel can publish the production branch automatically on push, so keep this candidate on the review branch until backend verification and explicit release approval.

The production Market catalogue contains NVDA, but the captured deployed backend omits screening metadata. The prepared server code supplies it; production remains blocked until that backend is released and checked. Quotes require the server-side market provider configuration and an available provider response; missing quotes remain labeled unavailable rather than invented.

Existing Fund contracts stay under their original database rules. The proposed 85%/115% engine and reserve are analysis only. Do not run a blanket migration push from this repository for the wrap-up release.
