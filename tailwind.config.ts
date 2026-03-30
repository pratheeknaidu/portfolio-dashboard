import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          bg: "#0d1117",
          card: "#161b22",
          border: "#30363d",
        },
        gain: {
          DEFAULT: "#3fb950",
          dark: "#26a641",
        },
        loss: {
          DEFAULT: "#f85149",
          dark: "#da3633",
        },
        accent: {
          DEFAULT: "#58a6ff",
          dark: "#1f6feb",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Noto Sans", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
