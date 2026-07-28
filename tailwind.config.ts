import type { Config } from "tailwindcss";

/** Hearth design tokens — professional blue & white theme, warmed with a
 *  hospitality gold accent and real elevation/motion systems.
 *  NOTE: token names are legacy (from the original warm palette); base
 *  values were swapped in the blue/white redesign so feature code needed
 *  no edits: pine = primary blue, clay = danger red, amber = warning,
 *  ink = deep navy (text + sidebar bg), cream = app background.
 *  Every DEFAULT/50/700/600 value below is byte-identical to the original
 *  tokens — everything else is a purely additive shade ramp so existing
 *  classes (bg-pine, text-clay, bg-amber-50 …) render unchanged.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
          DEFAULT: "#2563EB",
        },
        clay: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
          DEFAULT: "#DC2626",
        },
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#B45309",
          700: "#92400E",
          800: "#78350F",
          900: "#451A03",
          DEFAULT: "#D97706",
        },
        success: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
          DEFAULT: "#16A34A",
        },
        info: {
          50: "#E0F2FE",
          100: "#BAE6FD",
          200: "#7DD3FC",
          300: "#38BDF8",
          400: "#0EA5E9",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C4A6E",
          DEFAULT: "#0284C7",
        },
        /** Warm hospitality accent — used sparingly for loyalty/VIP/rating
         *  and premium CTAs, a deliberate counterpoint to the cool blue. */
        gold: {
          50: "#FBF6EA",
          100: "#F5EACB",
          200: "#EBD69C",
          300: "#DFBD6E",
          400: "#D4A94A",
          500: "#C9932E",
          600: "#AD7823",
          700: "#8A5E1D",
          800: "#664519",
          900: "#453012",
          DEFAULT: "#C9932E",
        },
        ink: {
          50: "#F3F5F8",
          100: "#E4E9F0",
          200: "#C7D0DE",
          300: "#96A5BD",
          400: "#5B6B85",
          500: "#334463",
          600: "#22314B",
          700: "#1B2C47",
          800: "#13233A",
          900: "#0A1526",
          DEFAULT: "#0F1E33",
        },
        cream: "#F5F7FA",
        surface: "#FFFFFF",
        hairline: "#E2E8F0",
        muted: "#64748B",
        body: "#334155",
        line: "#EEF2F7",
      },
      fontFamily: {
        display: ["'Newsreader'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "12px",
        lg: "10px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "28px",
        pill: "999px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(15,23,42,0.04)",
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        "card-hover": "0 8px 20px -4px rgba(15,23,42,0.12), 0 4px 8px -4px rgba(15,23,42,0.06)",
        md: "0 6px 16px -2px rgba(15,23,42,0.08)",
        lg: "0 16px 32px -8px rgba(15,23,42,0.14)",
        xl: "0 24px 48px -12px rgba(15,23,42,0.18)",
        pop: "0 12px 32px rgba(15,30,51,0.16)",
        "glow-pine": "0 8px 24px -4px rgba(37,99,235,0.35)",
        "glow-gold": "0 8px 20px -4px rgba(201,147,46,0.35)",
        "inner-line": "inset 0 0 0 1px rgba(15,23,42,0.06)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        "gradient-ink": "linear-gradient(160deg, #16233B 0%, #0A1526 100%)",
        "gradient-gold": "linear-gradient(135deg, #D4A94A 0%, #AD7823 100%)",
        "gradient-sheen": "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.45)" },
          "50%": { boxShadow: "0 0 0 6px rgba(220,38,38,0)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fadeIn .4s ease-out both",
        "fade-in-up": "fadeInUp .5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in-down": "fadeInDown .25s ease-out both",
        "scale-in": "scaleIn .2s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-right": "slideInRight .35s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2.2s ease-in-out infinite",
        "float-slow": "floatSlow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
