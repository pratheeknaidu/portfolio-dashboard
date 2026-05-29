// Cohesive analogous palette swept across the app's two accent hues
// (gold ~95° → emerald ~160° → teal ~205°). Constant-ish lightness in oklch
// keeps slices perceptually balanced so size, not color, drives emphasis.
export const SERIES_COLORS = [
  "oklch(0.80 0.14 95)",
  "oklch(0.78 0.14 108)",
  "oklch(0.76 0.15 122)",
  "oklch(0.74 0.16 136)",
  "oklch(0.73 0.17 148)",
  "oklch(0.72 0.17 158)",
  "oklch(0.70 0.15 169)",
  "oklch(0.69 0.13 179)",
  "oklch(0.67 0.12 189)",
  "oklch(0.65 0.11 198)",
  "oklch(0.61 0.10 205)",
  "oklch(0.57 0.09 212)",
];

// Desaturated so the "Other" bucket recedes behind the named holdings.
export const MUTED_SERIES_COLOR = "oklch(0.50 0.02 165)";
