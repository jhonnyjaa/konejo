/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        slate: {
          25: "#f8f9fa",
          50: "#f8fafc",
        },
        konejo: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d7fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      boxShadow: {
        "soft":    "0 2px 8px 0 rgba(0,0,0,0.06), 0 1px 3px 0 rgba(0,0,0,0.04)",
        "medium":  "0 4px 16px 0 rgba(0,0,0,0.08), 0 2px 6px 0 rgba(0,0,0,0.05)",
        "nav":     "0 2px 20px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        "float":   "0 8px 32px 0 rgba(0,0,0,0.10), 0 2px 8px 0 rgba(0,0,0,0.06)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out",
        "slide-up":   "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "shimmer":    "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.6" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to:   { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
