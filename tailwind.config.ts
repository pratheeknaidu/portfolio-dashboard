import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          bg: "var(--background)",
          card: "var(--surface)",
          border: "var(--border)",
        },
        card: "var(--card)",
        popover: "var(--popover)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          foreground: "var(--gold-foreground)",
        },
        positive: "var(--positive)",
        negative: "var(--negative)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Legacy aliases kept so unmigrated components keep rendering until restyled
        gain: { DEFAULT: "var(--positive)", dark: "var(--positive)" },
        loss: { DEFAULT: "var(--negative)", dark: "var(--negative)" },
        accent: { DEFAULT: "var(--primary)", dark: "var(--primary)" },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
        xl: "calc(var(--radius) + 8px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
