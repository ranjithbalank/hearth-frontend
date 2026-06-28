import type { Config } from "tailwindcss";

/** Hearth design tokens — mirrors the approved prototype exactly. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: { DEFAULT: "#1C6B57", 700: "#155244", 50: "#E6F0EB" },
        clay: { DEFAULT: "#DB7B4B", 50: "#FBEDE3" },
        amber: { DEFAULT: "#E0A23D", 600: "#C99A2E", 50: "#FCF3E0" },
        ink: "#16221F",
        cream: "#F6F2EC",
        surface: "#FFFFFF",
        hairline: "#EDE7DC",
        muted: "#8A8478",
        body: "#3D4A4E",
        info: { DEFAULT: "#3B7AC4", 50: "#EAF1F8" },
        line: "#F4EFE6",
      },
      fontFamily: {
        display: ["Newsreader", "Georgia", "serif"],
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "14px",
        lg: "16px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06)",
        pop: "0 8px 30px rgba(22,34,31,0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
