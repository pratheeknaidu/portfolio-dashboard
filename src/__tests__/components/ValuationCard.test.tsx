import { render, screen, within, fireEvent } from "@testing-library/react";
import { ValuationCard } from "@/components/ValuationCard";
import type { PortfolioItem, ValuationData } from "@/types";

// jsdom doesn't implement matchMedia; stub it so useIsMobile (via DetailPanel) doesn't throw.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      media: "",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

function item(ticker: string): PortfolioItem {
  return {
    ticker, companyName: ticker, sector: "Tech",
    shares: 1, avgCost: 100, addedAt: "2026-01-01T00:00:00.000Z",
    quote: { price: 100, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100, totalPL: 0, totalPLPercent: 0,
  };
}

describe("ValuationCard", () => {
  it("renders all 4 bucket headers", () => {
    render(<ValuationCard items={[]} valuations={{}} />);
    expect(screen.getByTestId("vbucket-deep_value")).toHaveTextContent(/Deep Value/);
    expect(screen.getByTestId("vbucket-undervalued")).toHaveTextContent(/Undervalued/);
    expect(screen.getByTestId("vbucket-fair")).toHaveTextContent(/Fairly Priced/);
    expect(screen.getByTestId("vbucket-overvalued")).toHaveTextContent(/Overvalued/);
  });

  it("buckets by fairValueDescription when present (path 1)", () => {
    const items = [item("NVDA"), item("MSFT"), item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      NVDA: { valuationSource: "fair_value", fairValueDescription: "Undervalued", fairValueDiscountPct: 47 },
      MSFT: { valuationSource: "fair_value", fairValueDescription: "Near Fair Value", fairValueDiscountPct: 9 },
      AAPL: { valuationSource: "fair_value", fairValueDescription: "Overvalued",  fairValueDiscountPct: -7 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("vbucket-undervalued")).getByText("NVDA")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-fair")).getByText("MSFT")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-overvalued")).getByText("AAPL")).toBeInTheDocument();
  });

  it("falls back to upsideToTargetPct thresholds when no fairValueDescription (path 2)", () => {
    const items = [item("DEEP"), item("UPSIDE"), item("FLAT"), item("DOWN")];
    const valuations: Record<string, ValuationData> = {
      DEEP:   { valuationSource: "analyst_target", upsideToTargetPct: 30 },
      UPSIDE: { valuationSource: "analyst_target", upsideToTargetPct: 15 },
      FLAT:   { valuationSource: "analyst_target", upsideToTargetPct: 5 },
      DOWN:   { valuationSource: "analyst_target", upsideToTargetPct: -15 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("vbucket-deep_value")).getByText("DEEP")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-undervalued")).getByText("UPSIDE")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-fair")).getByText("FLAT")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-overvalued")).getByText("DOWN")).toBeInTheDocument();
  });

  it("path 1 takes precedence over path 2 when both are available", () => {
    const items = [item("PLTR")];
    const valuations: Record<string, ValuationData> = {
      PLTR: { valuationSource: "both", fairValueDescription: "Overvalued", upsideToTargetPct: 34 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("vbucket-overvalued")).getByText("PLTR")).toBeInTheDocument();
    expect(within(screen.getByTestId("vbucket-deep_value")).queryByText("PLTR")).not.toBeInTheDocument();
  });

  it("puts tickers with no signal at all into the No coverage strip", () => {
    const items = [item("SPY"), item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "fair_value", fairValueDescription: "Undervalued" },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(screen.getByTestId("no-coverage-strip")).toHaveTextContent("SPY");
  });

  it("renders both numbers in chip subtext when both FV discount and upside are present", () => {
    const items = [item("JNJ")];
    const valuations: Record<string, ValuationData> = {
      JNJ: {
        valuationSource: "both",
        fairValueDescription: "Overvalued",
        fairValueDiscountPct: -17,
        upsideToTargetPct: 7.9,
      },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    const chip = screen.getByTestId("chip-JNJ");
    expect(chip).toHaveTextContent(/FV:\s*-17%/);
    expect(chip).toHaveTextContent(/Tgt:\s*\+7\.9%/);
  });

  it("sorts within bucket descending by effective upside (FV first, target as fallback)", () => {
    const items = [item("A"), item("B"), item("C")];
    const valuations: Record<string, ValuationData> = {
      A: { valuationSource: "fair_value", fairValueDescription: "Undervalued", fairValueDiscountPct: 12 },
      B: { valuationSource: "both",       fairValueDescription: "Undervalued", fairValueDiscountPct: 25, upsideToTargetPct: 5 },
      C: { valuationSource: "analyst_target", upsideToTargetPct: 18 }, // path 2 → also lands in "Undervalued" (10–25%)
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    const bucket = screen.getByTestId("vbucket-undervalued");
    const chips = within(bucket).getAllByTestId(/^chip-/);
    expect(chips[0]).toHaveTextContent("B"); // 25%
    expect(chips[1]).toHaveTextContent("C"); // 18%
    expect(chips[2]).toHaveTextContent("A"); // 12%
  });

  it("opens a detail panel when a chip is clicked", () => {
    const items = [item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "both", fairValueDescription: "Undervalued", fairValueDiscountPct: 12, upsideToTargetPct: 15, targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260 },
    };
    render(<ValuationCard items={items} valuations={valuations} />);
    expect(screen.queryByText("Your Position")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chip-AAPL"));
    expect(screen.getByText("Your Position")).toBeInTheDocument();
  });
});
