import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
        surface: {
          900: "#0a0f1e",
          800: "#0f1629",
          700: "#151e35",
          600: "#1c2845",
          500: "#243058",
        },
        neon: {
          blue:  "#38bdf8",
          cyan:  "#22d3ee",
          green: "#4ade80",
          amber: "#fbbf24",
          red:   "#f87171",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "grid-pattern": "linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
        "hero-glow": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.15), transparent)",
      },
      backgroundSize: {
        "grid": "40px 40px",
      },
      boxShadow: {
        "glow-blue":  "0 0 20px rgba(56,189,248,0.25), 0 0 60px rgba(56,189,248,0.1)",
        "glow-green": "0 0 20px rgba(74,222,128,0.25), 0 0 60px rgba(74,222,128,0.1)",
        "glow-red":   "0 0 20px rgba(248,113,113,0.25), 0 0 60px rgba(248,113,113,0.1)",
        "glow-amber": "0 0 20px rgba(251,191,36,0.25), 0 0 60px rgba(251,191,36,0.1)",
        "glass":      "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "fade-in":      "fadeIn 0.4s ease-out",
        "slide-up":     "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-right":"slideInRight 0.5s cubic-bezier(0.16,1,0.3,1)",
        "scanner":      "scanner 2s linear infinite",
        "scanner-ping": "scannerPing 2s ease-in-out infinite",
        "pulse-slow":   "pulse 3s ease-in-out infinite",
        "glow-pulse":   "glowPulse 2s ease-in-out infinite",
        "border-spin":  "borderSpin 4s linear infinite",
        "float":        "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%":   { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scanner: {
          "0%":   { transform: "translateY(-100%)", opacity: "0.8" },
          "50%":  { opacity: "1" },
          "100%": { transform: "translateY(400%)", opacity: "0.8" },
        },
        scannerPing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(56,189,248,0.4)" },
          "50%":      { boxShadow: "0 0 0 8px rgba(56,189,248,0)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.6" },
          "50%":      { opacity: "1" },
        },
        borderSpin: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
