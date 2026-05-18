# Edit / Delete Individual Holdings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PATCH + DELETE for individual holdings, surface via a ⋯ menu on the `/analytics` HoldingsTable, with a modal for edit and a confirm dialog for delete.

**Architecture:** New dynamic Next.js App Router route at `/api/portfolio/[ticker]` for the mutations. New `EditHoldingModal` and `ConfirmDialog` components live alongside existing modals. HoldingsTable adds an optional Actions column that emits `onEdit` / `onDelete` callbacks; `/analytics` page owns the modal/dialog state and calls its existing `fetchData()` to refresh after mutation.

**Tech Stack:** Next.js 14.2 App Router (sync `params`), TypeScript, Firebase Admin (Firestore), React 18 client components, Tailwind, Jest + Testing Library.

**Spec:** [`docs/superpowers/specs/2026-05-17-edit-delete-holdings-design.md`](../specs/2026-05-17-edit-delete-holdings-design.md)

---

## Task 1: API DELETE handler at `/api/portfolio/[ticker]`

Start with DELETE because it has no validation and unlocks the simplest end-to-end vertical.

**Files:**
- Create: `src/app/api/portfolio/[ticker]/route.ts`
- Create: `src/__tests__/api/portfolio-[ticker].test.ts`

- [ ] **Step 1: Write the failing DELETE tests**

Create `src/__tests__/api/portfolio-[ticker].test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/verify-token");
jest.mock("@/lib/firebase-admin", () => {
  const docRef = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return {
    adminDb: {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => docRef),
          })),
        })),
      })),
    },
  };
});

import { DELETE } from "@/app/api/portfolio/[ticker]/route";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

// Reach the shared docRef by walking the chain — the mock returns the same
// docRef regardless of args.
const docRef = adminDb
  .collection("users").doc("x").collection("holdings").doc("x") as unknown as {
    get: jest.Mock; set: jest.Mock; delete: jest.Mock;
  };

function buildReq(method: "DELETE" | "PATCH", body?: object) {
  return new NextRequest("http://localhost/api/portfolio/aapl", {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("DELETE /api/portfolio/[ticker]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
  });

  it("returns 401 without auth", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await DELETE(buildReq("DELETE"), { params: { ticker: "aapl" } });
    expect(res.status).toBe(401);
  });

  it("deletes the holding and returns 200", async () => {
    const res = await DELETE(buildReq("DELETE"), { params: { ticker: "aapl" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, ticker: "AAPL" });
    expect(docRef.delete).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — succeeds even if the holding does not exist", async () => {
    docRef.delete.mockResolvedValueOnce(undefined);
    const res = await DELETE(buildReq("DELETE"), { params: { ticker: "ZZZZ" } });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --testPathPatterns="portfolio-\\[ticker\\]"`
Expected: FAIL with `Cannot find module '@/app/api/portfolio/[ticker]/route'`.

- [ ] **Step 3: Implement the DELETE handler**

Create `src/app/api/portfolio/[ticker]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";

function holdingRef(uid: string, ticker: string) {
  return adminDb.collection("users").doc(uid).collection("holdings").doc(ticker);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { ticker: string } },
) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const ticker = params.ticker.toUpperCase();
  await holdingRef(authResult.uid, ticker).delete();
  return NextResponse.json({ success: true, ticker });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --testPathPatterns="portfolio-\\[ticker\\]"`
Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolio/[ticker]/route.ts src/__tests__/api/portfolio-\[ticker\].test.ts
git commit -m "feat(api): add DELETE /api/portfolio/[ticker]"
```

---

## Task 2: API PATCH handler

Add PATCH to the same route file. Validates `shares` and `avgCost` and uses `set({ merge: true })` to preserve `addedAt`.

**Files:**
- Modify: `src/app/api/portfolio/[ticker]/route.ts`
- Modify: `src/__tests__/api/portfolio-[ticker].test.ts`

- [ ] **Step 1: Write the failing PATCH tests**

Append to `src/__tests__/api/portfolio-[ticker].test.ts` (after the DELETE describe block, before the closing of the file). Also add `PATCH` to the existing import:

```ts
import { DELETE, PATCH } from "@/app/api/portfolio/[ticker]/route";
```

Then append the describe block:

```ts
describe("PATCH /api/portfolio/[ticker]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyRequest as jest.Mock).mockResolvedValue({ uid: "user123" });
  });

  it("returns 401 without auth", async () => {
    (verifyRequest as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await PATCH(buildReq("PATCH", { shares: 10 }), { params: { ticker: "aapl" } });
    expect(res.status).toBe(401);
  });

  it("returns 400 when neither shares nor avgCost is provided", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(buildReq("PATCH", {}), { params: { ticker: "aapl" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one/i);
  });

  it("returns 400 when shares is not a positive finite number", async () => {
    docRef.get.mockResolvedValue({ exists: true });
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "abc"]) {
      const res = await PATCH(
        buildReq("PATCH", { shares: bad }),
        { params: { ticker: "aapl" } },
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 when avgCost is not a positive finite number", async () => {
    docRef.get.mockResolvedValue({ exists: true });
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      const res = await PATCH(
        buildReq("PATCH", { avgCost: bad }),
        { params: { ticker: "aapl" } },
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 404 when the holding does not exist", async () => {
    docRef.get.mockResolvedValueOnce({ exists: false });
    const res = await PATCH(
      buildReq("PATCH", { shares: 10 }),
      { params: { ticker: "zzzz" } },
    );
    expect(res.status).toBe(404);
  });

  it("updates shares and returns the new value", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(
      buildReq("PATCH", { shares: 75 }),
      { params: { ticker: "aapl" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticker: "AAPL", shares: 75 });
    expect(docRef.set).toHaveBeenCalledWith({ shares: 75 }, { merge: true });
  });

  it("updates avgCost and returns the new value", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(
      buildReq("PATCH", { avgCost: 199.99 }),
      { params: { ticker: "aapl" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticker: "AAPL", avgCost: 199.99 });
    expect(docRef.set).toHaveBeenCalledWith({ avgCost: 199.99 }, { merge: true });
  });

  it("updates both fields in a single call", async () => {
    docRef.get.mockResolvedValueOnce({ exists: true });
    const res = await PATCH(
      buildReq("PATCH", { shares: 75, avgCost: 199.99 }),
      { params: { ticker: "aapl" } },
    );
    expect(res.status).toBe(200);
    expect(docRef.set).toHaveBeenCalledWith(
      { shares: 75, avgCost: 199.99 },
      { merge: true },
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --testPathPatterns="portfolio-\\[ticker\\]"`
Expected: FAIL because `PATCH` is not exported yet.

- [ ] **Step 3: Implement the PATCH handler**

Append to `src/app/api/portfolio/[ticker]/route.ts` (after the DELETE handler, keep the existing `holdingRef` helper):

```ts
function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ticker: string } },
) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const payload: { shares?: number; avgCost?: number } = {};

  if ("shares" in body) {
    if (!isPositiveFinite(body.shares)) {
      return NextResponse.json({ error: "shares must be a positive number" }, { status: 400 });
    }
    payload.shares = body.shares;
  }
  if ("avgCost" in body) {
    if (!isPositiveFinite(body.avgCost)) {
      return NextResponse.json({ error: "avgCost must be a positive number" }, { status: 400 });
    }
    payload.avgCost = body.avgCost;
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Must provide at least one of: shares, avgCost" }, { status: 400 });
  }

  const ticker = params.ticker.toUpperCase();
  const ref = holdingRef(authResult.uid, ticker);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  }

  await ref.set(payload, { merge: true });
  return NextResponse.json({ ticker, ...payload });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --testPathPatterns="portfolio-\\[ticker\\]"`
Expected: PASS, all DELETE + PATCH tests green.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: All test suites pass (baseline + new tests). Note: some pre-existing suites on `main` are already broken — see PR #6 (`fix/test-suites`) for fixes that should be merged separately. The new tests in this plan must pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/portfolio/[ticker]/route.ts src/__tests__/api/portfolio-\[ticker\].test.ts
git commit -m "feat(api): add PATCH /api/portfolio/[ticker] with shares/avgCost validation"
```

---

## Task 3: `ConfirmDialog` component

Generic reusable dialog. No external deps; pure presentational.

**Files:**
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/__tests__/components/ConfirmDialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/ConfirmDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title, message, and default button labels", () => {
    render(
      <ConfirmDialog
        title="Remove holding?"
        message="Remove AAPL from your portfolio?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/remove holding\?/i)).toBeInTheDocument();
    expect(screen.getByText(/remove AAPL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("uses a custom confirm label when provided", () => {
    render(
      <ConfirmDialog
        title="t" message="m" confirmLabel="Delete"
        onConfirm={jest.fn()} onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("fires onCancel when Cancel is clicked", () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("fires onConfirm when Confirm is clicked", () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while an async onConfirm is in flight", async () => {
    let resolve!: () => void;
    const onConfirm = jest.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(
      <ConfirmDialog
        title="t" message="m" confirmLabel="Delete"
        onConfirm={onConfirm} onCancel={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    resolve();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --testPathPatterns=ConfirmDialog`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/ConfirmDialog.tsx`:

```tsx
"use client";
import { useState } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  const confirmClass = destructive
    ? "bg-loss hover:bg-loss/90"
    : "bg-accent hover:bg-accent-dark";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-[400px] shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${confirmClass}`}
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --testPathPatterns=ConfirmDialog`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/__tests__/components/ConfirmDialog.test.tsx
git commit -m "feat(components): add ConfirmDialog with async-aware pending state"
```

---

## Task 4: `EditHoldingModal` component

Wraps the existing PATCH endpoint. Two number inputs, validates client-side, surfaces server errors inline.

**Files:**
- Create: `src/components/EditHoldingModal.tsx`
- Create: `src/__tests__/components/EditHoldingModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/EditHoldingModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import type { PortfolioItem } from "@/types";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ getIdToken: jest.fn().mockResolvedValue("mock-token") }),
}));

global.fetch = jest.fn();

const holding: PortfolioItem = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  shares: 50,
  avgCost: 142.8,
  addedAt: "",
  quote: { price: 185.5, change: 2.3, changePercent: 1.25, previousClose: 183.2 },
  marketValue: 9275,
  totalPL: 2135,
  totalPLPercent: 29.9,
};

describe("EditHoldingModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefills shares and avgCost from the holding", () => {
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText(/shares/i)).toHaveValue(50);
    expect(screen.getByLabelText(/avg cost/i)).toHaveValue(142.8);
  });

  it("disables Save when shares is 0 or negative", async () => {
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={jest.fn()} />);
    const sharesInput = screen.getByLabelText(/shares/i);
    await userEvent.clear(sharesInput);
    await userEvent.type(sharesInput, "0");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("disables Save when avgCost is 0", async () => {
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={jest.fn()} />);
    const costInput = screen.getByLabelText(/avg cost/i);
    await userEvent.clear(costInput);
    await userEvent.type(costInput, "0");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("sends PATCH with the updated values and calls onSuccess on 2xx", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ticker: "AAPL", shares: 75, avgCost: 142.8 }),
    });
    const onSuccess = jest.fn();
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={onSuccess} />);

    const sharesInput = screen.getByLabelText(/shares/i);
    await userEvent.clear(sharesInput);
    await userEvent.type(sharesInput, "75");

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/portfolio/AAPL");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body);
    expect(body.shares).toBe(75);
    expect(body.avgCost).toBe(142.8);
  });

  it("shows the server's error message inline on non-2xx and keeps the modal open", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "shares must be a positive number" }),
    });
    const onSuccess = jest.fn();
    render(<EditHoldingModal holding={holding} onClose={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/shares must be a positive number/i)).toBeInTheDocument(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<EditHoldingModal holding={holding} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --testPathPatterns=EditHoldingModal`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/EditHoldingModal.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { PortfolioItem } from "@/types";

interface Props {
  holding: PortfolioItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditHoldingModal({ holding, onClose, onSuccess }: Props) {
  const { getIdToken } = useAuth();
  const [shares, setShares] = useState<number>(holding.shares);
  const [avgCost, setAvgCost] = useState<number>(holding.avgCost);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = Number.isFinite(shares) && shares > 0
    && Number.isFinite(avgCost) && avgCost > 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/portfolio/${holding.ticker}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shares, avgCost }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Update failed (${res.status})`);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-[400px] shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1">Edit holding</h2>
        <p className="text-sm text-gray-400 mb-4">{holding.ticker} &middot; {holding.companyName}</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-shares" className="block text-xs text-gray-400 mb-1">Shares</label>
            <input
              id="edit-shares"
              type="number"
              step="any"
              value={Number.isFinite(shares) ? shares : ""}
              onChange={(e) => setShares(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="edit-avgcost" className="block text-xs text-gray-400 mb-1">Avg Cost</label>
            <input
              id="edit-avgcost"
              type="number"
              step="any"
              value={Number.isFinite(avgCost) ? avgCost : ""}
              onChange={(e) => setAvgCost(parseFloat(e.target.value))}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="text-loss text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!valid || saving}
            className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --testPathPatterns=EditHoldingModal`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditHoldingModal.tsx src/__tests__/components/EditHoldingModal.test.tsx
git commit -m "feat(components): add EditHoldingModal for PATCH /api/portfolio/[ticker]"
```

---

## Task 5: HoldingsTable Actions column + ⋯ menu

Adds an optional Actions column that emits `onEdit` / `onDelete`. Only renders when at least one callback is provided so existing usages don't accidentally grow a column.

**Files:**
- Modify: `src/components/HoldingsTable.tsx`
- Modify: `src/__tests__/components/HoldingsTable.test.tsx`

- [ ] **Step 1: Write the failing tests (extend existing file)**

Add to `src/__tests__/components/HoldingsTable.test.tsx`, alongside the existing tests:

```tsx
import userEvent from "@testing-library/user-event";

// ... existing tests stay

describe("HoldingsTable Actions column", () => {
  it("does not render the Actions column when no callbacks are provided", () => {
    render(<HoldingsTable items={items} totalValue={17975} />);
    expect(screen.queryByRole("button", { name: /actions for/i })).not.toBeInTheDocument();
  });

  it("renders a ⋯ button per row when onEdit or onDelete is provided", () => {
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getAllByRole("button", { name: /actions for/i })).toHaveLength(items.length);
  });

  it("opens the dropdown on ⋯ click and closes it on outside click", async () => {
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for AAPL/i }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();

    await userEvent.click(document.body);
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("fires onEdit with the holding when Edit is clicked", async () => {
    const onEdit = jest.fn();
    render(<HoldingsTable items={items} totalValue={17975} onEdit={onEdit} onDelete={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for AAPL/i }));
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ ticker: "AAPL" }));
  });

  it("fires onDelete with the holding when Delete is clicked", async () => {
    const onDelete = jest.fn();
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for MSFT/i }));
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ ticker: "MSFT" }));
  });

  it("closes the menu on Escape", async () => {
    render(<HoldingsTable items={items} totalValue={17975} onEdit={jest.fn()} onDelete={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /actions for AAPL/i }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --testPathPatterns=HoldingsTable`
Expected: FAIL — the existing 4 tests pass but the new 6 fail (no `onEdit`/`onDelete` props yet).

- [ ] **Step 3: Modify HoldingsTable to support Actions column**

Edit `src/components/HoldingsTable.tsx`. Update the props interface and add menu state + render logic:

Replace the existing `interface HoldingsTableProps` and the start of the function body up through `function handleSort`:

```tsx
import { useState, useEffect, useRef } from "react";

interface HoldingsTableProps {
  items: PortfolioItem[];
  totalValue: number;
  onEdit?: (item: PortfolioItem) => void;
  onDelete?: (item: PortfolioItem) => void;
}

export function HoldingsTable({ items, totalValue, onEdit, onDelete }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuTicker, setOpenMenuTicker] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const showActions = Boolean(onEdit || onDelete);

  useEffect(() => {
    if (!openMenuTicker) return;
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuTicker(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuTicker(null);
    };
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuTicker]);

  function handleSort(key: SortKey) {
```

(Rest of `handleSort` and other helpers stay the same.)

In the `<thead><tr>`, after the existing `<SortHeader label="% of Portfolio" col="portfolioPercent" />`, add (only if `showActions`):

```tsx
              {showActions && <th className="px-3 py-2" aria-label="Actions" />}
```

In the row mapping, after the `% of Portfolio` cell (the last `<td>` rendering `portfolioPct`), add a final cell:

```tsx
                  {showActions && (
                    <td className="px-3 py-2 relative">
                      <button
                        type="button"
                        aria-label={`Actions for ${item.ticker}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTicker(openMenuTicker === item.ticker ? null : item.ticker);
                        }}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-surface-border"
                      >
                        ⋯
                      </button>
                      {openMenuTicker === item.ticker && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-md shadow-lg z-10 min-w-[120px]"
                        >
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuTicker(null); onEdit(item); }}
                              className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-surface-border"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuTicker(null); onDelete(item); }}
                              className="block w-full text-left px-3 py-2 text-sm text-loss hover:bg-surface-border"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
```

Note: the existing file already has `"use client"` at line 1 — leave it. We're just adding `useEffect` and `useRef` to the existing React imports.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --testPathPatterns=HoldingsTable`
Expected: PASS, all existing 4 tests + new 6 tests green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/HoldingsTable.tsx src/__tests__/components/HoldingsTable.test.tsx
git commit -m "feat(holdings-table): add optional Actions column with edit/delete menu"
```

---

## Task 6: Wire up modal + dialog on `/analytics`

Final wire-up. The analytics page owns `editing` and `deleting` state, passes callbacks to HoldingsTable, and renders the modal/dialog. The dialog runs the DELETE fetch and refetches.

**Files:**
- Modify: `src/app/analytics/page.tsx`

- [ ] **Step 1: Add state, callbacks, and rendering**

Edit `src/app/analytics/page.tsx`. The full final file should look like:

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { SectorChart } from "@/components/SectorChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { useAuth } from "@/lib/auth-context";
import { CsvImportModal } from "@/components/CsvImportModal";
import { EditHoldingModal } from "@/components/EditHoldingModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Holding, Quote, PortfolioItem, Snapshot } from "@/types";

export default function AnalyticsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [deleting, setDeleting] = useState<PortfolioItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const holdingsRes = await fetch("/api/portfolio", { headers });
    if (!holdingsRes.ok) return;
    const holdings: Holding[] = await holdingsRes.json();

    if (Array.isArray(holdings) && holdings.length > 0) {
      const tickers = holdings.map((h) => h.ticker).join(",");
      const quotesRes = await fetch(`/api/quotes?tickers=${tickers}`, { headers });
      const quotes: Record<string, Quote> = await quotesRes.json();

      setItems(
        holdings.filter((h) => quotes[h.ticker]).map((h) => {
          const q = quotes[h.ticker];
          const mv = h.shares * q.price;
          const cb = h.shares * h.avgCost;
          return {
            ...h,
            quote: q,
            marketValue: mv,
            totalPL: mv - cb,
            totalPLPercent: ((mv - cb) / cb) * 100,
          };
        })
      );
    } else {
      setItems([]);
    }

    const snapshotsRes = await fetch("/api/snapshot", { headers });
    if (snapshotsRes.ok) {
      const data = await snapshotsRes.json();
      setSnapshots(data);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleting) return;
    setDeleteError(null);
    const token = await getIdToken();
    const res = await fetch(`/api/portfolio/${deleting.ticker}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error || `Delete failed (${res.status})`);
      return;
    }
    setDeleting(null);
    fetchData();
  }, [deleting, getIdToken, fetchData]);

  const totalValue = items.reduce((s, i) => s + i.marketValue, 0);
  const sectors = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.sector || "Unknown"] = (acc[i.sector || "Unknown"] || 0) + i.marketValue;
    return acc;
  }, {});

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen">
        <Navbar onImportClick={() => setShowImport(true)} />
        <main className="flex-1 overflow-auto p-6 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
              <h2 className="text-lg font-semibold text-white mb-4">
                Sector Allocation
              </h2>
              <SectorChart sectors={sectors} />
            </section>
            <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
              <h2 className="text-lg font-semibold text-white mb-4">
                Performance Over Time
              </h2>
              <PerformanceChart snapshots={snapshots} />
            </section>
          </div>
          <section className="bg-surface-card rounded-lg p-6 border border-surface-border">
            <h2 className="text-lg font-semibold text-white mb-4">Holdings</h2>
            <HoldingsTable
              items={items}
              totalValue={totalValue}
              onEdit={setEditing}
              onDelete={(item) => { setDeleteError(null); setDeleting(item); }}
            />
          </section>
        </main>
      </div>
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchData(); }}
        />
      )}
      {editing && (
        <EditHoldingModal
          holding={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchData(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Remove holding?"
          message={
            deleteError
              ? `${deleteError} — try again, or cancel.`
              : `Remove ${deleting.ticker} from your portfolio?`
          }
          confirmLabel="Delete"
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeleting(null); setDeleteError(null); }}
        />
      )}
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Run lint and the full test suite**

Run: `npm run lint && npm test`
Expected: lint clean, all tests that passed before still pass. (We added no test for the page since it's a thin wire-up — manual verification in the next task.)

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds, the new `/api/portfolio/[ticker]` dynamic route appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/analytics/page.tsx
git commit -m "feat(analytics): wire up Edit / Delete actions on HoldingsTable"
```

---

## Task 7: Manual verification in sandbox

The implementation is functionally complete after Task 6. This task is a sanity check that the wire-up holds up in a real browser. No code changes.

- [ ] **Step 1: Start the sandbox**

Run: `npm run sandbox`
Expected: emulators start, seed data loads, dev server boots at `http://localhost:3000`.

- [ ] **Step 2: Sign in as the sandbox user and navigate to `/analytics`**

In the browser, click "Sign in as sandbox user", then click "Analytics" in the nav.
Expected: The Holdings table shows the 8 seeded tickers (AAPL, MSFT, GOOGL, AMZN, XOM, JNJ, JPM, NVDA).

- [ ] **Step 3: Edit a holding**

Click the `⋯` button on the AAPL row, click "Edit". Change Shares from 50 to 75. Click Save.
Expected: Modal closes, table reflects 75 shares for AAPL, Market Value updates, Sector Allocation chart updates.

- [ ] **Step 4: Try an invalid edit**

Click `⋯` on MSFT, click "Edit". Change Shares to `0` or empty. Verify Save is disabled. Restore a valid value, click Save.
Expected: Save remains disabled at 0; works again with a valid number.

- [ ] **Step 5: Delete a holding**

Click `⋯` on GOOGL, click "Delete". Confirm dialog appears. Click Cancel.
Expected: Dialog closes, GOOGL still present.

Click `⋯` on GOOGL, click "Delete", click Delete in the confirm dialog.
Expected: Dialog closes, GOOGL disappears from the table, totals update.

- [ ] **Step 6: Verify menu dismissal**

Click `⋯` on any row → press Escape. Menu closes.
Click `⋯` again → click outside the menu (on whitespace). Menu closes.
Click `⋯` → click the same `⋯` again. Menu closes (toggle).

- [ ] **Step 7: Verify deleted holdings are actually gone**

Refresh the browser. Sign in again.
Expected: GOOGL is still gone (persisted to Firestore emulator).

- [ ] **Step 8: Push branch and open PR**

```bash
git push -u origin feat/edit-delete-holdings
gh pr create --base main --head feat/edit-delete-holdings \
  --title "feat: edit and delete individual holdings from /analytics" \
  --body-file docs/superpowers/specs/2026-05-17-edit-delete-holdings-design.md
```

Or write a fresh PR body summarizing the changes.

---

## Self-review notes (for the implementer)

- The new test file uses square brackets in its filename (`portfolio-[ticker].test.ts`). Jest's `--testPathPatterns` flag uses regex, so escape the brackets when running it directly: `--testPathPatterns="portfolio-\[ticker\]"`.
- Next.js 14.2 uses **synchronous** `params` in route handlers. Do not `await` it. (Next 15+ made it a Promise.)
- The `set({ merge: true })` in PATCH is what preserves `addedAt`. Don't switch to plain `set` or you'll wipe the timestamp.
- HoldingsTable's existing tests rely on `cursor-pointer` and ⋯-less rows. The new Actions column is opt-in via `onEdit`/`onDelete`, so those tests stay green.
- If you find a pre-existing test failure on `main` that blocks `npm test`, see PR #6 (`fix/test-suites`) for the fixes — they should be merged separately, not bundled here.
