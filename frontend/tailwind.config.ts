import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Brand — navy deep, mirrors PDF hero
        brand: {
          50: "#EFF4FF",
          100: "#DBE6FE",
          200: "#BBD0FC",
          300: "#8FB2F9",
          400: "#5B8AF5",
          500: "#3B6DED",
          600: "#2A52D4",
          700: "#1F3FA8",
          800: "#1A337E",
          900: "#0F1E4A",
          950: "#0A1433",
        },
        ink: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          700: "#334155",
          900: "#0F172A",
        },
        success: { 100: "#D1FAE5", 500: "#10B981", 700: "#047857" },
        warning: { 100: "#FEF3C7", 500: "#F59E0B", 700: "#B45309" },
        danger: { 100: "#FEE2E2", 500: "#EF4444", 700: "#B91C1C" },
        info: { 100: "#DBEAFE", 500: "#3B82F6", 700: "#1D4ED8" },
        // Shadcn semantic tokens — aliased to brand/ink for design-system parity.
        // Lets `border-border`, `bg-muted`, `bg-primary`, etc. stay consistent
        // with our palette without forcing every component to spell out brand/ink.
        border: "#E2E8F0", // ink-200
        input: "#E2E8F0", // ink-200
        ring: "#3B6DED", // brand-500
        background: "#FFFFFF",
        foreground: "#0F172A", // ink-900
        muted: {
          DEFAULT: "#F1F5F9", // ink-100
          foreground: "#64748B", // ink-500
        },
        primary: {
          DEFAULT: "#1F3FA8", // brand-700
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F1F5F9", // ink-100
          foreground: "#0F172A", // ink-900
        },
        destructive: {
          DEFAULT: "#EF4444", // danger-500
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#F1F5F9", // ink-100
          foreground: "#0F172A", // ink-900
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A", // ink-900
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A", // ink-900
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,30,74,0.04), 0 4px 12px rgba(15,30,74,0.04)",
        "card-hover": "0 2px 6px rgba(15,30,74,0.06), 0 8px 20px rgba(15,30,74,0.06)",
        popover: "0 4px 16px rgba(15,30,74,0.08), 0 1px 3px rgba(15,30,74,0.06)",
        glow: "0 0 0 4px rgba(59,109,237,0.15)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        "fade-in-up": "fade-in-up 220ms ease-out",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
