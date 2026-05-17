export interface ParsedHolding {
  ticker: string;
  shares: number;
  totalCost: number;
  companyName: string;
}

export interface ImportInput {
  pasteText?: string;
  csvText?: string;
}

export interface ImportResult {
  imported: string[];
  updated: string[];
  errors: string[];
}

export class ImportError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "ImportError";
  }
}
