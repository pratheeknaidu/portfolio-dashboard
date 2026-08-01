import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        rd: {
          page: "var(--rd-page)",
          chrome: "var(--rd-chrome)",
          card: "var(--rd-card)",
          inset: "var(--rd-inset)",
          control: "var(--rd-control)",
          "row-header": "var(--rd-row-header)",
          "row-hover": "var(--rd-row-hover)",
          border: "var(--rd-border)",
          "border-hairline": "var(--rd-border-hairline)",
          "border-control": "var(--rd-border-control)",
          "border-strong": "var(--rd-border-strong)",
          "border-stronger": "var(--rd-border-stronger)",
          gridline: "var(--rd-gridline)",
          text: "var(--rd-text)",
          secondary: "var(--rd-text-secondary)",
          body: "var(--rd-text-body)",
          muted: "var(--rd-text-muted)",
          label: "var(--rd-text-label)",
          dim: "var(--rd-text-dim)",
          faint: "var(--rd-text-faint)",
          disabled: "var(--rd-text-disabled)",
          gain: "var(--rd-gain)",
          loss: "var(--rd-loss)",
          flat: "var(--rd-flat)",
          "flat-tile": "var(--rd-flat-tile)",
          "flat-aggregate": "var(--rd-flat-aggregate)",
          warning: "var(--rd-warning)",
          "warning-surface": "var(--rd-warning-surface)",
          "warning-border": "var(--rd-warning-border)",
          error: "var(--rd-error)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
        xl: "calc(var(--radius) + 8px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
