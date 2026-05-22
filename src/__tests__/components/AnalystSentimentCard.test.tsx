import { render, screen, within } from "@testing-library/react";
import { AnalystSentimentCard } from "@/components/AnalystSentimentCard";
import type { PortfolioItem, ValuationData } from "@/types";

function item(ticker: string): PortfolioItem {
  return {
    ticker,
    companyName: ticker,
    sector: "Tech",
    shares: 1,
    avgCost: 100,
    addedAt: "2026-01-01T00:00:00.000Z",
    quote: { price: 100, change: 0, changePercent: 0, previousClose: 100 },
    marketValue: 100,
    totalPL: 0,
    totalPLPercent: 0,
  };
}

describe("AnalystSentimentCard", () => {
  it("renders all 5 bucket headers even when buckets are empty", () => {
    render(<AnalystSentimentCard items={[]} valuations={{}} />);
    expect(screen.getByText(/Strong Buy/)).toBeInTheDocument();
    expect(screen.getByText(/^Buy/)).toBeInTheDocument();
    expect(screen.getByText(/^Hold/)).toBeInTheDocument();
    expect(screen.getByText(/^Sell/)).toBeInTheDocument();
    expect(screen.getByText(/Strong Sell/)).toBeInTheDocument();
  });

  it("places each holding into the bucket for its recommendationKey", () => {
    const items = [item("AAPL"), item("MSFT"), item("JPM"), item("XYZ")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
      MSFT: { valuationSource: "none", recommendationKey: "strong_buy", recommendationMean: 1.3 },
      JPM:  { valuationSource: "none", recommendationKey: "hold", recommendationMean: 3 },
      XYZ:  { valuationSource: "none", recommendationKey: "underperform", recommendationMean: 4.6 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("bucket-strong_buy")).getByText("MSFT")).toBeInTheDocument();
    expect(within(screen.getByTestId("bucket-buy")).getByText("AAPL")).toBeInTheDocument();
    expect(within(screen.getByTestId("bucket-hold")).getByText("JPM")).toBeInTheDocument();
    expect(within(screen.getByTestId("bucket-strong_sell")).getByText("XYZ")).toBeInTheDocument();
  });

  it("sorts chips within a bucket by recommendationMean ascending", () => {
    const items = [item("A"), item("B"), item("C")];
    const valuations: Record<string, ValuationData> = {
      A: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2.4 },
      B: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 1.6 },
      C: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2.0 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    const bucket = screen.getByTestId("bucket-buy");
    const chips = within(bucket).getAllByTestId(/^chip-/);
    expect(chips[0]).toHaveTextContent("B");
    expect(chips[1]).toHaveTextContent("C");
    expect(chips[2]).toHaveTextContent("A");
  });

  it("renders a No coverage strip listing tickers without recommendationKey", () => {
    const items = [item("SPY"), item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    const strip = screen.getByTestId("no-coverage-strip");
    expect(strip).toHaveTextContent("SPY");
  });

  it("does not render the No coverage strip when every holding has a key", () => {
    const items = [item("AAPL")];
    const valuations: Record<string, ValuationData> = {
      AAPL: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(screen.queryByTestId("no-coverage-strip")).not.toBeInTheDocument();
  });

  it("shows bucket counts in the headers", () => {
    const items = [item("A"), item("B")];
    const valuations: Record<string, ValuationData> = {
      A: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 2 },
      B: { valuationSource: "none", recommendationKey: "buy", recommendationMean: 1.8 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(screen.getByTestId("bucket-buy")).toHaveTextContent("Buy (2)");
  });

  it("treats 'underperform' as Strong Sell", () => {
    const items = [item("X")];
    const valuations: Record<string, ValuationData> = {
      X: { valuationSource: "none", recommendationKey: "underperform", recommendationMean: 4.5 },
    };
    render(<AnalystSentimentCard items={items} valuations={valuations} />);
    expect(within(screen.getByTestId("bucket-strong_sell")).getByText("X")).toBeInTheDocument();
  });
});
