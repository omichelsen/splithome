# SplitHome

A shared expense tracker for Ole & Yewleh — two people, one household.

Live: https://splithome-gamma.vercel.app

## What it does

- **Add an expense** — description, amount, who paid (Ole or Yewleh), a split
  slider, a date (defaults to today), and optional notes. The slider moves in
  discrete steps (0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100%), where
  the percentage is Ole's share of the cost.
- **Show the live balance** — who owes whom, and how much, recalculated from
  all expenses on every render. A positive balance means Yewleh owes Ole; a
  negative one means Ole owes Yewleh.
- **Filter the list** — all expenses, or only those paid by Ole or by Yewleh.
- **Delete an expense** — behind a confirmation prompt; the balance updates
  immediately.
- **Stay in sync** — both phones see changes instantly via a Supabase
  realtime subscription; no refresh needed.

## What it does not do

- **No auth or accounts.** There is no login; anyone who can open the app can
  see, add, and delete expenses. Access control, if any, lives entirely in
  Supabase Row Level Security — see [Environment variables](#environment-variables).
- **No settlements or payments.** The balance is informational only; there is
  no "mark as settled" flow and no money moves through the app.
- **Two people only.** Ole and Yewleh are hardcoded throughout (`'ole'` /
  `'yewleh'`); there is no multi-household or multi-user concept.
- **No offline data.** The app shell works offline, but expenses are always
  fetched live from Supabase (see [PWA](#pwa)).

## Tech stack

| Choice | Version | Why |
| --- | --- | --- |
| React | 19.3.1 | Small single-page app; no router or state library is needed — local `useState`/`useEffect` in `App.tsx` is enough |
| Vite | 8.4.0 (`@vitejs/plugin-react` 6.3.0) | Fast dev server and build |
| TypeScript | 5.9.3 | `strict: true` plus `noUnusedLocals` / `noUnusedParameters` (`tsconfig.json`); the build runs `tsc --noEmit` before Vite |
| Supabase | `@supabase/supabase-js` 2.119.2 | Hosted Postgres plus realtime, with no backend of our own to run |
| Vercel | — | Git-connected hosting: production deploys from `main`, preview deployments on pull requests |
| pnpm | 10.33.1 | The repo's package manager; installs use `--frozen-lockfile` (see [Quality](#quality)) |
| Node | 24 (`.nvmrc`) | Pinned via `.nvmrc`; CI reads it with `node-version-file` |
| vite-plugin-pwa | 2.0.0 | Installable PWA with an offline app shell (see [PWA](#pwa)) |
| Plain CSS | — | No CSS framework or Tailwind. One stylesheet, `src/App.css`, built on `:root` custom properties, with DM Sans / DM Mono loaded from Google Fonts |
| ESLint + Prettier | ESLint 10.15.0, `eslint-config-omichelsen` 2.0.0, Prettier 3.10.1 | Shared house lint/format config (tabs, single quotes, no semicolons), enforced by `pnpm lint` and CI |

## How it works

**Data flow** (`src/App.tsx`): on mount, `fetchExpenses()` selects all rows
from the `expenses` table, ordered by `date` then `created_at`, newest first.
A realtime channel (`expenses-changes`) subscribes to `postgres_changes` on
`public.expenses` — any insert, update, or delete triggers a refetch, so both
devices stay in sync. Adding an expense is a plain `insert()`; the realtime
subscription then triggers the refetch (no optimistic update). Deleting is a
`delete().eq('id', id)` behind a `confirm()`.

**Balance logic** (`src/lib/balance.ts`, pure functions, unit-tested): for
each expense, if Ole paid, Yewleh owes Ole her share — `amount × (1 −
split_ratio)`; if Yewleh paid, Ole owes Yewleh his share — `amount ×
split_ratio`. `split_ratio` is Ole's share of the cost (0 = Yewleh pays
everything, 1 = Ole pays everything). Amounts and ratios can arrive from
Supabase as strings (numeric columns), so they are read through `toNumber()`.
`formatCurrency` renders USD via `Intl.NumberFormat`; `getBalanceLabel`
turns a balance into the "X owes Y …" text, treating anything under $0.01 as
settled.

**Types** (`src/lib/types.ts`): `Expense` is the row as stored in Supabase
(`id`, `description`, `amount`, `paid_by: 'ole' | 'yewleh'`, `split_ratio`,
`date`, `notes: string | null`, `created_at`), with `amount` / `split_ratio`
typed `number | string` for the reason above. `src/lib/supabase.ts` is a
single typed `createClient` using a minimal `Database` type for the
`expenses` table.

**Styling and dark mode** (`src/App.css`): all colours live in `:root`
variables. Dark mode follows the device setting only
(`@media (prefers-color-scheme: dark)` redefines the variables) — there is
no manual toggle and no stored preference. The PWA manifest colours stay
light-only (a static manifest can't vary by scheme).

### PWA

Configured in `vite.config.ts` with `registerType: 'autoUpdate'`: the
service worker precaches the built app, `navigateFallback: '/index.html'`
serves the app shell for navigation, and a new build takes over (and reloads
the page) once the new service worker activates — the browser checks for
updates on navigation, so a deployed update is picked up on the next visit,
not while the page is open. Runtime caching: Supabase requests are
`NetworkOnly` (never cached), Google Fonts are `CacheFirst` for up to a
year. Icons are generated with `pnpm generate-pwa-assets`
(`pwa-assets.config.js`, source `public/logo.svg`).

## Project structure

```
.
├── .github/
│   ├── workflows/ci.yml     # CI: test, lint, build on every push
│   └── dependabot.yml       # Weekly dependency updates
├── public/                  # PWA icons, favicon, logos
├── src/
│   ├── App.tsx              # State, fetching, realtime subscription
│   ├── App.css              # All styles (:root variables, dark mode)
│   ├── main.tsx             # React root
│   ├── components/
│   │   ├── AddExpenseModal.tsx   # Add-expense form + split slider
│   │   ├── BalanceSummary.tsx   # Balance card, totals, count
│   │   └── ExpenseList.tsx      # Expense history + delete
│   └── lib/
│       ├── balance.ts      # Pure balance / formatting logic
│       ├── supabase.ts     # Typed Supabase client
│       └── types.ts        # Expense, ExpenseInsert, Payer, Filter
├── test/
│   └── balance.test.ts     # 35 unit tests for lib/balance
├── .env.example            # Template for local env vars (placeholders only)
├── .nvmrc                  # Node 24
├── eslint.config.mjs       # Shared eslint-config-omichelsen + one override
├── index.html              # App shell, per-scheme theme-color metas
├── package.json
├── pwa-assets.config.js
├── tsconfig.json           # strict + noUnusedLocals / noUnusedParameters
└── vite.config.ts          # React + VitePWA
```

There is no `schema.sql` in the repo: the database schema is not versioned
here. A fresh Supabase project needs an `expenses` table matching the
`Expense` type in `src/lib/types.ts` (see
[Environment variables](#environment-variables) for the RLS note).

## Development

Prerequisites: Node 24 (see `.nvmrc`) and pnpm 10.33.1.

```bash
cp .env.example .env   # fill in your Supabase URL and anon key, see below
pnpm install
pnpm dev               # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | `tsc --noEmit && vite build` |
| `pnpm preview` | Serve the production build locally |
| `pnpm test` | Node's built-in test runner (`node --test`); 35 unit tests for `src/lib/balance.ts` — no test framework dependency |
| `pnpm lint` | `eslint .` (shared config + Prettier) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm generate-pwa-assets` | Regenerate PWA icons from `public/logo.svg` |

### Quality

- **Tests** (`test/balance.test.ts`): 35 tests using only `node:test` and
  `node:assert/strict`, covering `computeBalance` (both payers, split ratios
  0 / 0.25 / 0.5 / 0.75 / 1, empty list, multiple expenses), currency/date
  formatting, and the split/balance labels. The React components and App
  flow are not tested.
- **Linting**: ESLint 10 with the shared `eslint-config-omichelsen` config,
  Prettier enforced as an ESLint rule. One override in
  `eslint.config.mjs`: `react-hooks/set-state-in-effect: 0`, because
  fetch-on-mount is the intended pattern in `App.tsx` (same override as
  Regex).
- **CI** (`.github/workflows/ci.yml`): runs on every push — `actions/checkout@v7`,
  `pnpm/action-setup@v6` (no `version:` input on purpose: it reads pnpm from
  the `packageManager` field; setting both fails), `actions/setup-node@v7`
  with `node-version-file: .nvmrc`, `pnpm install --frozen-lockfile`, then
  `pnpm test`, `pnpm lint`, `pnpm build`.
- **Dependabot** (`.github/dependabot.yml`): weekly npm updates at 13:00,
  at most 10 open PRs, plus Dependabot security updates.

## Environment variables

| Variable | Where it is set | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel Dashboard → Settings → Environment Variables (Production + Preview); locally in a gitignored `.env` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Same as above | The Supabase anon (publishable) key |

These are **build-time** values, not runtime secrets: Vite inlines every
`VITE_*` variable into the JavaScript bundle at build time, so the anon key
is visible in the browser by design. That is safe **only if Row Level
Security is enabled** on the `expenses` table in Supabase — the anon key is
publishable, but it is not a secret key. Never put a `service_role` key
here (or anywhere in the browser): it bypasses RLS.

Note: this repo cannot verify RLS for you — the schema and its policies are
not in the repo, so check them in the Supabase Dashboard. The committed
`.env` was removed in November 2026 (its values were publishable, so no key
rotation was needed); `.env` is now gitignored and `.env.example` holds
placeholders only.

## Branching and merging

Work on PR branches; Ole merges. Merge commits are used for stacked PR
series (rebase-and-merge rewrites commit SHAs and makes the next PR in the
stack show as conflicting), and rebase-and-merge otherwise.
