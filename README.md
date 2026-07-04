# Portfolio Dashboard

A Finviz-style heatmap for your stock portfolio. Import holdings from Robinhood (CSV or paste), watch them as a treemap sized by equity or P&L, and track daily portfolio value snapshots over time.

**Live demo:** [robinhood-portfolio.vercel.app/demo](https://robinhood-portfolio.vercel.app/demo) — a read-only sample portfolio, no sign-in required.

## Screenshots

| Dashboard heatmap | Analytics |
| --- | --- |
| ![Portfolio treemap sized by equity, colored by daily change](docs/images/treemap.png) | ![Snapshot history and allocation charts](docs/images/analytics.png) |

## Stack

| Layer        | Choice                                                       |
|--------------|--------------------------------------------------------------|
| Frontend     | Next.js 14 (App Router), React 18, Tailwind, Recharts, Nivo  |
| Auth         | Firebase Authentication (Google sign-in)                     |
| Database     | Cloud Firestore                                              |
| Market data  | Yahoo Finance via `yahoo-finance2`                           |
| Tests        | Jest + Testing Library; Firebase emulators for integration   |
| Hosting      | Vercel                                                       |

## Quick start (no accounts needed)

The sandbox runs everything locally with seeded data and deterministic mock quotes — no Firebase project, no Google sign-in, no Yahoo network calls.

```bash
# Prerequisites: Node 20+, Java 21 (for Firestore emulator), Firebase CLI
brew install openjdk@21
npm i -g firebase-tools
npm install

# Start emulators + seed data + dev server, all in one shell
npm run sandbox
```

Open <http://localhost:3000> and click **"Sign in as sandbox user"**. The seed account (`seed@test.com`) starts with eight holdings and a week of snapshots. Data persists between runs in `.sandbox-data/`.

## Full setup (real Firebase)

You'll need a Firebase project with Auth + Firestore enabled.

1. Copy `.env.example` to `.env.local` and fill in:
   - The six `NEXT_PUBLIC_FIREBASE_*` values from your Firebase web app config
   - `FIREBASE_SERVICE_ACCOUNT` — the full service-account JSON, stringified onto one line
   - Set `NEXT_PUBLIC_USE_EMULATOR=false`
2. Enable **Google** as a sign-in provider in Firebase Auth.
3. Deploy `firestore.rules` (per-user isolation: users can only read/write under their own UID).
4. `npm run dev`

## Project layout

```
src/
├── app/                       Next.js App Router
│   ├── page.tsx               Dashboard (treemap + sidebar)
│   ├── analytics/page.tsx     Snapshot history charts
│   └── api/
│       ├── portfolio/         GET holdings for the signed-in user
│       ├── quotes/            GET live quotes (60s cache) for tickers + range
│       ├── snapshot/          GET history / POST today's snapshot (idempotent)
│       └── import/            POST CSV file or pasted text
├── components/                Treemap, tooltip, sidebar, toggles, import modal
├── lib/
│   ├── firebase-admin.ts      Server SDK (lazy Proxy init — see note below)
│   ├── firebase-client.ts     Browser SDK
│   ├── verify-token.ts        Bearer-token auth helper for API routes
│   ├── yahoo-finance.ts       Quote fetching with in-memory cache
│   ├── yahoo-finance-mock.ts  Deterministic mock for sandbox mode
│   ├── market-hours.ts        ET-aware "is the NYSE open" check
│   └── import/                CSV/paste parsing → enrichment → write pipeline
├── types/index.ts             Shared TypeScript types
└── __tests__/                 Mirrors src/ structure; integration/ is emulator-only
scripts/
├── sandbox.sh                 Boots emulators + seed + dev server together
└── seed-emulator.ts           Populates the sandbox user with sample data
__mocks__/                     Jest auto-mocks for firebase-admin & yahoo-finance2
```

## How it works

### Request flow

```
Browser ─► getIdToken() ─► fetch /api/* with Authorization: Bearer <token>
                                      │
                                      ▼
                       verifyRequest() decodes the token
                                      │
                                      ▼
                 adminDb (Firestore) ◄─┴─► yahoo-finance2 (quotes)
```

Every API route starts with `verifyRequest(req)` which either returns `{ uid }` or a 401 `NextResponse`. The handler narrows on `instanceof NextResponse` and proceeds.

### Data model

Firestore is organized as per-user subcollections:

```
users/{uid}/
├── holdings/{TICKER}         { ticker, companyName, sector, shares, avgCost, addedAt }
└── snapshots/{YYYY-MM-DD}    { date, totalValue, holdings: { [ticker]: marketValue } }
```

Using the ticker and date as document IDs makes upserts trivial (`set` with `{ merge: true }`) and means one snapshot per day is naturally idempotent. `firestore.rules` only allows access when `request.auth.uid == uid`.

### Run modes

Three env flags control behavior — combined differently by each npm script:

| Flag                              | What it does                                                          |
|-----------------------------------|-----------------------------------------------------------------------|
| `USE_EMULATOR`                    | Server (`firebase-admin`) points at the Firestore/Auth emulators      |
| `NEXT_PUBLIC_USE_EMULATOR`        | Browser SDK points at emulators + shows the "sandbox user" button     |
| `SANDBOX_MODE`                    | `getQuotes()` returns deterministic mocks instead of hitting Yahoo    |

- `npm run dev` — production Firebase, real Yahoo quotes
- `npm run dev:emulator` — fresh-each-run emulators, real Yahoo quotes
- `npm run sandbox` — persistent seeded emulators, mock quotes

### The Firebase admin lazy Proxy

`src/lib/firebase-admin.ts` exports `adminDb` / `adminAuth` as `Proxy` objects that defer SDK initialization until first property access. This avoids a crash during Next.js's "Collecting page data" build phase, which imports route files before runtime secrets are available. Don't replace these with direct `getFirestore()` / `getAuth()` calls.

### Quote caching

In-process `Map` with a 60-second TTL, keyed by sorted ticker list + time range. The dashboard polls every 60s but only when `isMarketOpen()` is true (ET, weekdays, 9:30am–4:00pm), so off-hours your tab idles quietly.

## Common commands

```bash
npm run dev                  # production Firebase + real Yahoo
npm run dev:emulator         # fresh emulators each run
npm run sandbox              # seeded emulators + mock quotes (recommended)
npm run build                # production build
npm run lint                 # next lint
npm test                     # unit tests (excludes integration/)
npm test -- -t "name"        # filter by test name
npm run test:integration     # runs jest under `firebase emulators:exec`
```

## Testing notes

- Unit tests use the `next/jest` preset with `jsdom` and pick up `__mocks__/firebase-admin.ts` and `__mocks__/yahoo-finance2.ts` automatically (Jest manual-mock convention — no `jest.mock()` calls needed).
- Integration tests under `src/__tests__/integration/` talk to a real Firestore emulator and are excluded from `npm test` via `testPathIgnorePatterns`. Run them with `npm run test:integration`.
- `.eslintrc.json` ignores `src/__tests__/**`.

## Deployment

Vercel project is linked via `.vercel/`. Set the six `NEXT_PUBLIC_FIREBASE_*` vars plus `FIREBASE_SERVICE_ACCOUNT` (one-line JSON string) in the project's environment variables. Do **not** set `USE_EMULATOR` or `SANDBOX_MODE` in production.

## See also

- [`CLAUDE.md`](./CLAUDE.md) — agent-oriented notes, conventions, and gotchas for Claude Code sessions
