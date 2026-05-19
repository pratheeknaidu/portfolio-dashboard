# Graph Report - C:/Users/madhu/Desktop/Projects/robinhood  (2026-05-17)

## Corpus Check
- Corpus is ~9,509 words - fits in a single context window. You may not need a graph.

## Summary
- 189 nodes · 166 edges · 21 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard + API Routes|Dashboard + API Routes]]
- [[_COMMUNITY_Auth + Import Pipeline|Auth + Import Pipeline]]
- [[_COMMUNITY_Firestore Data Model|Firestore Data Model]]
- [[_COMMUNITY_Treemap + Market Hours|Treemap + Market Hours]]
- [[_COMMUNITY_Yahoo Finance + Mock Quotes|Yahoo Finance + Mock Quotes]]
- [[_COMMUNITY_CSV Import Logic|CSV Import Logic]]
- [[_COMMUNITY_Navbar + Auth Context|Navbar + Auth Context]]
- [[_COMMUNITY_Component Test Setup|Component Test Setup]]
- [[_COMMUNITY_Tailwind + Type Tests|Tailwind + Type Tests]]
- [[_COMMUNITY_Sidebar Formatting|Sidebar Formatting]]
- [[_COMMUNITY_Treemap Tooltip|Treemap Tooltip]]
- [[_COMMUNITY_SizingTime Toggles|Sizing/Time Toggles]]
- [[_COMMUNITY_Recharts Mocks|Recharts Mocks]]
- [[_COMMUNITY_README (orphan)|README (orphan)]]
- [[_COMMUNITY_Next.js Config concept (orphan)|Next.js Config concept (orphan)]]
- [[_COMMUNITY_yahoo-finance-mock concept (orphan)|yahoo-finance-mock concept (orphan)]]
- [[_COMMUNITY_clearCache concept (orphan)|clearCache concept (orphan)]]
- [[_COMMUNITY_ImportInput type (orphan)|ImportInput type (orphan)]]
- [[_COMMUNITY_ImportResult type (orphan)|ImportResult type (orphan)]]
- [[_COMMUNITY_Snapshot type (orphan)|Snapshot type (orphan)]]
- [[_COMMUNITY_AnalyticsRange type (orphan)|AnalyticsRange type (orphan)]]

## God Nodes (most connected - your core abstractions)
1. `DashboardPage` - 12 edges
2. `AnalyticsPage` - 10 edges
3. `Treemap` - 7 edges
4. `importHoldings()` - 6 edges
5. `GET /api/portfolio` - 5 edges
6. `GET/POST /api/snapshot` - 5 edges
7. `importHoldings` - 5 edges
8. `getMockQuotes()` - 4 edges
9. `getQuotes()` - 4 edges
10. `POST /api/import tests` - 4 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `importHoldings()`  [INFERRED]
  src\app\api\import\route.ts → src\lib\import\index.ts
- `importHoldings()` --calls--> `enrichHoldings()`  [INFERRED]
  src\lib\import\index.ts → src\lib\import\enrich-holdings.ts
- `importHoldings()` --calls--> `parsePastedPositions()`  [INFERRED]
  src\lib\import\index.ts → src\lib\import\parse-paste.ts
- `importHoldings()` --calls--> `parseCsv()`  [INFERRED]
  src\lib\import\index.ts → src\lib\import\parse-csv.ts
- `importHoldings()` --calls--> `writeHoldings()`  [INFERRED]
  src\lib\import\index.ts → src\lib\import\write-holdings.ts

## Hyperedges (group relationships)
- **API route tests share verifyRequest + adminDb mock pattern** — import_test, portfolio_test, quotes_test, snapshot_test, concept_verify_token, concept_firebase_admin_db [EXTRACTED 0.95]
- **Chart components mock recharts and render with snapshot/sector data** — performancechart_test, sectorchart_test, concept_recharts_mock_pattern [EXTRACTED 0.90]
- **Firestore users/{uid}/holdings and snapshots collections shared across seed + API tests** — seed_emulator_script, concept_firestore_holdings_collection, concept_firestore_snapshots_collection, portfolio_test, snapshot_test [INFERRED 0.85]
- **Authenticated API routes via verifyRequest** — api_import_route, api_portfolio_route, api_quotes_route, api_snapshot_route, verify_token_lib [EXTRACTED 1.00]
- **Dashboard fetches holdings + quotes and writes snapshot** — dashboard_page, api_portfolio_route, api_quotes_route, api_snapshot_route [EXTRACTED 1.00]
- **Analytics page composes sector, performance, holdings views** — analytics_page, sector_chart, performance_chart, holdings_table [EXTRACTED 1.00]
- **Holdings import pipeline** — import_importholdings, import_parsecsv, import_parsepastedpositions, enrich_holdings_fn, import_writeholdings [EXTRACTED 1.00]
- **Treemap visualization stack** — treemap_component, treemaptooltip_component, sizingtoggle_component, types_portfolioitem [INFERRED 0.85]
- **Firebase auth/data stack** — authcontext_provider, firebase_client_module, firebase_admin_module, sandbox_constants_module [INFERRED 0.85]

## Communities

### Community 0 - "Dashboard + API Routes"
Cohesion: 0.13
Nodes (23): AnalyticsPage, POST /api/import, GET /api/portfolio, GET /api/quotes, GET/POST /api/snapshot, useAuth/AuthProvider, AuthGuard, CsvImportModal (+15 more)

### Community 1 - "Auth + Import Pipeline"
Cohesion: 0.15
Nodes (14): AuthProvider, enrichHoldings, firebase-admin, firebase-client, importHoldings, parseCsv, parsePastedPositions, ImportError (+6 more)

### Community 2 - "Firestore Data Model"
Cohesion: 0.17
Nodes (15): adminDb / Firebase Admin (concept), users/{uid}/holdings Firestore collection, users/{uid}/snapshots Firestore collection, verifyRequest auth helper (concept), getQuotes / yahoo-finance lib (concept), Firebase Admin Mock, POST /api/import tests, GET /api/portfolio tests (+7 more)

### Community 3 - "Treemap + Market Hours"
Cohesion: 0.18
Nodes (12): isMarketOpen, TileRect, Treemap, getColor, sizeOf, TreemapTooltip, position, Holding (+4 more)

### Community 4 - "Yahoo Finance + Mock Quotes"
Cohesion: 0.23
Nodes (7): getQuotes(), getMockQuotes(), hashString(), priceAt(), rangeToDaysAgo(), rangeToDate(), GET()

### Community 5 - "CSV Import Logic"
Cohesion: 0.17
Nodes (6): enrichHoldings(), importHoldings(), parseCsv(), parsePastedPositions(), POST(), writeHoldings()

### Community 6 - "Navbar + Auth Context"
Cohesion: 0.29
Nodes (3): Navbar(), useAuth(), isMarketOpen()

### Community 7 - "Component Test Setup"
Cohesion: 0.4
Nodes (5): AuthGuard component tests, useAuth / auth-context (concept), CsvImportModal component tests, Jest Config, Jest Setup (testing-library/jest-dom)

### Community 8 - "Tailwind + Type Tests"
Cohesion: 0.5
Nodes (5): PortfolioItem type (concept), HoldingsTable component tests, PostCSS Config (Tailwind), Sidebar component tests, Tailwind Config Theme

### Community 9 - "Sidebar Formatting"
Cohesion: 0.67
Nodes (2): fmt(), fmtSigned()

### Community 10 - "Treemap Tooltip"
Cohesion: 0.67
Nodes (2): position(), TreemapTooltip()

### Community 11 - "Sizing/Time Toggles"
Cohesion: 0.5
Nodes (4): SizingToggle, TimeRangeToggle, SizingMode, TimeRange

### Community 16 - "Recharts Mocks"
Cohesion: 1.0
Nodes (3): Recharts mock pattern, PerformanceChart component tests, SectorChart component tests

### Community 53 - "README (orphan)"
Cohesion: 1.0
Nodes (1): Next.js Project README

### Community 54 - "Next.js Config concept (orphan)"
Cohesion: 1.0
Nodes (1): Next.js Config

### Community 55 - "yahoo-finance-mock concept (orphan)"
Cohesion: 1.0
Nodes (1): yahoo-finance-mock

### Community 56 - "clearCache concept (orphan)"
Cohesion: 1.0
Nodes (1): clearCache

### Community 57 - "ImportInput type (orphan)"
Cohesion: 1.0
Nodes (1): ImportInput

### Community 58 - "ImportResult type (orphan)"
Cohesion: 1.0
Nodes (1): ImportResult

### Community 59 - "Snapshot type (orphan)"
Cohesion: 1.0
Nodes (1): Snapshot

### Community 60 - "AnalyticsRange type (orphan)"
Cohesion: 1.0
Nodes (1): AnalyticsRange

## Knowledge Gaps
- **26 isolated node(s):** `Next.js Project README`, `Jest Setup (testing-library/jest-dom)`, `Next.js Config`, `PostCSS Config (Tailwind)`, `Firebase Admin Mock` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Sidebar Formatting`** (4 nodes): `fmt()`, `fmtSigned()`, `Sidebar()`, `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Treemap Tooltip`** (4 nodes): `fmt()`, `position()`, `TreemapTooltip()`, `TreemapTooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `README (orphan)`** (1 nodes): `Next.js Project README`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config concept (orphan)`** (1 nodes): `Next.js Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `yahoo-finance-mock concept (orphan)`** (1 nodes): `yahoo-finance-mock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `clearCache concept (orphan)`** (1 nodes): `clearCache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ImportInput type (orphan)`** (1 nodes): `ImportInput`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ImportResult type (orphan)`** (1 nodes): `ImportResult`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Snapshot type (orphan)`** (1 nodes): `Snapshot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AnalyticsRange type (orphan)`** (1 nodes): `AnalyticsRange`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashboardPage` connect `Dashboard + API Routes` to `Treemap + Market Hours`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Treemap` connect `Treemap + Market Hours` to `Dashboard + API Routes`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardPage` (e.g. with `AnalyticsPage` and `users/{uid}/snapshots`) actually correct?**
  _`DashboardPage` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `importHoldings()` (e.g. with `POST()` and `parsePastedPositions()`) actually correct?**
  _`importHoldings()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js Project README`, `Jest Setup (testing-library/jest-dom)`, `Next.js Config` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard + API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._