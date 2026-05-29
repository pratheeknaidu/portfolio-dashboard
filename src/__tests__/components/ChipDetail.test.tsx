import { render, screen } from "@testing-library/react";
import { ChipDetail } from "@/components/ChipDetail";
import type { PortfolioItem, ValuationData } from "@/types";

function item(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology",
    shares: 10, avgCost: 150, addedAt: "",
    quote: { price: 180, change: 2, changePercent: 1.1, previousClose: 178 },
    marketValue: 1800, totalPL: 300, totalPLPercent: 20,
    ...over,
  };
}

describe("ChipDetail", () => {
  it("renders header, sector and analyst sentiment", () => {
    const v: ValuationData = {
      valuationSource: "both",
      recommendationKey: "buy",
      recommendationMean: 2.1,
      numberOfAnalystOpinions: 30,
      targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260,
      upsideToTargetPct: 16.7,
    };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText(/Technology/)).toBeInTheDocument();
    expect(screen.getByText(/Buy/)).toBeInTheDocument();
    expect(screen.getByText(/2\.1/)).toBeInTheDocument();
    expect(screen.getByText(/30 analysts/)).toBeInTheDocument();
  });

  it("renders the price target range bar with low and high labels", () => {
    const v: ValuationData = {
      valuationSource: "analyst_target",
      targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 260,
      upsideToTargetPct: 16.7,
    };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.getByTestId("target-range-bar")).toBeInTheDocument();
    expect(screen.getByText("$150")).toBeInTheDocument();
    expect(screen.getByText("$260")).toBeInTheDocument();
  });

  it("shows a fallback when no price targets are present", () => {
    const v: ValuationData = { valuationSource: "fair_value", fairValueDescription: "Undervalued" };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.queryByTestId("target-range-bar")).not.toBeInTheDocument();
    expect(screen.getByText(/No price targets/i)).toBeInTheDocument();
  });

  it("positions the current-price marker within the range", () => {
    const v: ValuationData = {
      valuationSource: "analyst_target",
      targetMeanPrice: 210, targetLowPrice: 150, targetHighPrice: 250,
    };
    render(<ChipDetail item={item({ quote: { price: 200, change: 0, changePercent: 0, previousClose: 200 } })} v={v} />);
    // price 200 in [150,250] => 50%
    const marker = screen.getByTestId("current-marker");
    expect(marker).toHaveStyle({ left: "50%" });
  });

  it("renders your-position rows", () => {
    const v: ValuationData = { valuationSource: "none" };
    render(<ChipDetail item={item()} v={v} />);
    expect(screen.getByText("Market Value")).toBeInTheDocument();
    expect(screen.getByText(/\$1,800/)).toBeInTheDocument();
  });
});
