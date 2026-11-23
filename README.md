# Centsibility

Centsibility is a family banking and financial-literacy web app for children and their parents. Kids practise saving, spending, giving and investing in a safe, simulated environment, while parents stay in control through approvals, limits and reports. Penny, the in-app mascot and assistant, guides children through money decisions.

> Final Year Project. The card is a practice card and cannot make real bank-card payments.

## Features

**Kid experience**
- Wallet, practice card, transfers and transaction history
- Savings goals, missions, quests, quizzes and rewards
- Chores with parent approval
- Zakat and sadaqah (giving) tools
- Simulated investing and loans with market quotes
- Penny chat assistant and spending insights

**Parent experience**
- Approvals for transfers, chores and purchases
- Card controls, PIN protection and account settings
- Insights, statements and exportable reports
- Penny settings and privacy controls
- Family data export and account deletion

## Tech stack

- **Frontend:** React, TypeScript, Vite, TanStack Router, Tailwind CSS
- **Backend:** Supabase (Postgres, Row Level Security, Edge Functions on Deno)
- **Testing:** Vitest, Playwright, SQL and Deno tests
- **Deployment:** Vercel

## Project structure

```text
src/                 React app (routes, components, libraries)
supabase/            Migrations, edge functions, config
tests/               Unit, end-to-end and SQL tests
mascot/              Penny mascot assets and animations
public/              Static assets and fonts
scripts/             Maintenance and seeding scripts
```

## Getting started

Requirements: Node.js 24 and npm.

```bash
npm ci
cp .env.example .env.local   # then fill in your own values
npm run dev
```

Open the address printed by Vite (normally http://localhost:3000).

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Never put a service-role key or any AI/provider key in a `VITE_` variable. Server secrets belong in `supabase/functions/.env` (see `supabase/functions/.env.example`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint the codebase |
| `npx vitest run` | Run unit tests |
| `npx tsc --noEmit` | Type-check |

## Notes

- Development-only demo controls use synthetic data and are removed from production builds.
- Market data comes from public provider endpoints used under each provider's own terms.
- Fonts (Baloo 2, Lexend) are under the SIL Open Font License; chart components include their original licences.
