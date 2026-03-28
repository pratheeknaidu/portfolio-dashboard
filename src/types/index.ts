export interface Holding {
  ticker: string;
  companyName: string;
  sector: string;
  shares: number;
  avgCost: number;
  addedAt: string; // ISO timestamp
}

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  marketCap?: number;
}

export interface Snapshot {
  date: string;
  totalValue: number;
  holdings: Record<string, number>;
}

export interface PortfolioItem extends Holding {
  quote: Quote;
  marketValue: number;
  totalPL: number;
  totalPLPercent: number;
}

export type TimeRange = "1D" | "1W" | "1M" | "YTD";
export type AnalyticsRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";
