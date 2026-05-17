# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Finviz-style portfolio heatmap. Users import Robinhood holdings (CSV or paste), see a treemap sized by equity or P&L, and track daily portfolio snapshots over time. Next.js 14 App Router on Vercel, Firebase Auth + Firestore for persistence, Yahoo Finance for quotes.

## Commands

```bash
npm run dev              # Next dev against production Firebase (requires real creds in .env.local)
npm run dev:emulator     # Firebase emulators + Next dev; empty emulator each run
npm run sandbox          # Seeded emulator + mocked Yahoo quotes; persists data to .sandbox-data/
npm run seed             # Seed the running emulator (used internally by sandbox)
npm run build
npm run lint
npm test                                            # Unit tests only (excludes integration/)
npm test -- path/to/file.test.ts                    # Single test file
npm test -- -t "test name pattern"                  # Filter by test name
npm run test:integration                            # Runs jest under `firebase emulators:exec`
```

Sandbox mode is the preferred local workflow — no external network, deterministic data, signs in as `seed@test.com` via a button that appears only when `NEXT_PUBLIC_USE_EMULATOR=true`.

## Architecture

### Runtime modes (three env flags, easy to confuse)

| Flag                          | Effect                                                          |
|-------------------------------|-----------------------------------------------------------------|
| `USE_EMULATOR=true`           | Server (`firebase-admin`) points at Firestore/Auth emulators    |
| `NEXT_PUBLIC_USE_EMULATOR=true` | Client (`firebase` SDK) points at emulators + reveals sandbox sign-in button |
| `SANDBOX_MODE=true`           | `getQuotes()` returns deterministic mocks instead of hitting Yahoo |

`npm run sandbox` sets all three; `npm run dev:emulator` sets the two emulator flags but leaves Yahoo live.

### Request flow

Client (`src/app/page.tsx`) → `getIdToken()` from `AuthContext` → fetch `/api/portfolio` and `/api/quotes` with `Authorization: Bearer <token>` → server route calls `verifyRequest(req)` (`src/lib/verify-token.ts`) which returns `{ uid }` or a `NextResponse` error. Every API route uses this `instanceof NextResponse` pattern as its first line — preserve it when adding endpoints.

### Firebase admin lazy proxy

`src/lib/firebase-admin.ts` exports `adminDb` and `adminAuth` as **Proxy objects** that defer SDK init until first property access. This exists because Next.js's "Collecting page data" build phase imports route files; eager init would crash when secrets aren't in the build env. The proxy also `.bind()`s returned functions so SDK `this` is preserved. Do not replace these exports with direct `getFirestore()` / `getAuth()` calls.

### Data model (Firestore)

```
users/{uid}/holdings/{TICKER}    → Holding (ticker is doc id → upsert via set+merge)
users/{uid}/snapshots/{YYYY-MM-DD} → Snapshot (date is doc id → one snapshot per day, idempotent)
```

Security rules (`firestore.rules`) only allow access where `request.auth.uid == uid`. All server reads/writes go through `firebase-admin` which bypasses rules — auth is enforced via `verifyRequest`, not rules.

### Import pipeline (`src/lib/import/`)

`importHoldings(uid, input)` orchestrates:
1. `parsePastedPositions` or `parseCsv` → `Map<ticker, ParsedHolding>` (dedups; ImportError on bad input)
2. `MAX_HOLDINGS = 200` ceiling
3. `enrichHoldings(tickers)` → company name + sector from Yahoo (or mock in sandbox)
4. `writeHoldings(uid, parsed, summaries)` → batch upsert, returns `{ imported, updated }`

`ImportError` carries a `statusCode`; the route handler maps it to the response.

### Quote fetching (`src/lib/yahoo-finance.ts`)

- 60s in-memory cache keyed by `${sortedTickers}_${range}`. Cleared via `clearCache()` (used in tests).
- `Promise.allSettled` per ticker so one bad symbol doesn't poison the batch.
- For `range !== "1D"`, a second pass fetches `chart()` history to compute the period's change/changePercent.
- `SANDBOX_MODE=true` short-circuits to `getMockQuotes()` (deterministic price-by-hash, no network).

### Treemap UI

`src/app/page.tsx` polls `/api/portfolio` + `/api/quotes` on mount and every 60s **only when `isMarketOpen()`** (ET-aware, weekday-aware — `src/lib/market-hours.ts`). After fetch, it POSTs to `/api/snapshot` which writes a daily snapshot keyed by `today` (idempotent overwrite).

### Tests

- Unit tests live in `src/__tests__/{api,components,lib}`; jest uses the `next/jest` preset with `jsdom`.
- `__mocks__/firebase-admin.ts` and `__mocks__/yahoo-finance2.ts` are **Jest auto-mocks** — placed at repo root next to `node_modules`, they replace those modules in every test without explicit `jest.mock()` calls.
- Integration tests (`src/__tests__/integration/`) are excluded from `npm test` via `testPathIgnorePatterns`; run them with `npm run test:integration` which wraps jest in `firebase emulators:exec`.
- `.eslintrc.json` ignores `src/__tests__/**` — lint will not catch test-only issues.

## Conventions

- Path alias: `@/*` → `src/*`.
- API routes return `NextResponse.json(...)` with explicit status codes. Errors that should reach the user use `{ error: string }`; server-only failures log and return generic 500.
- Client components are explicitly marked `"use client"`; the root layout and API routes are server by default.
- `addedAt` on holdings is stored as ISO string, not Firestore Timestamp.

## Deployment

Vercel project is linked (`.vercel/` present). Production requires `FIREBASE_SERVICE_ACCOUNT` (JSON string) plus the six `NEXT_PUBLIC_FIREBASE_*` vars. `USE_EMULATOR` / `SANDBOX_MODE` must NOT be set in production.
