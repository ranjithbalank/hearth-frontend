import type { Config } from "tailwindcss";

/** Hearth design tokens — professional blue & white theme.
 *  NOTE: token names are legacy (from the original warm palette); values were
 *  swapped in the blue/white redesign so feature code needed no edits:
 *    pine  = primary blue      clay = danger red      amber = warning
 *    ink   = deep navy (text + sidebar bg)            cream = app background
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: { DEFAULT: "#2563EB", 700: "#1D4ED8", 50: "#EFF6FF" },
        clay: { DEFAULT: "#DC2626", 50: "#FEF2F2" },
        amber: { DEFAULT: "#D97706", 600: "#B45309", 50: "#FFFBEB" },
        success: { DEFAULT: "#16A34A", 50: "#ECFDF5" },
        ink: "#0F1E33",
        cream: "#F5F7FA",
        surface: "#FFFFFF",
        hairline: "#E2E8F0",
        muted: "#64748B",
        body: "#334155",
        info: { DEFAULT: "#0284C7", 50: "#E0F2FE" },
        line: "#EEF2F7",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "12px",
        lg: "10px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,30,51,0.06)",
        pop: "0 12px 32px rgba(15,30,51,0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
