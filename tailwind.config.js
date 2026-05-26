/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        violet: {
          25:  "#faf5ff",
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
      },
      boxShadow: {
        soft:   "0 1px 4px 0 rgba(0,0,0,0.05), 0 2px 12px 0 rgba(0,0,0,0.04)",
        medium: "0 4px 16px 0 rgba(0,0,0,0.08), 0 1px 4px 0 rgba(0,0,0,0.04)",
        float:  "0 8px 32px -4px rgba(0,0,0,0.12), 0 2px 8px 0 rgba(0,0,0,0.06)",
        nav:    "0 2px 24px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        glass:  "0 8px 32px 0 rgba(124,58,237,0.08), 0 0 0 1px rgba(124,58,237,0.06)",
      },
      backdropBlur: { xs: "2px" },
      animation: {
        "fade-in":   "fadeIn 0.25s ease-out",
        "slide-up":  "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        shimmer:     "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
