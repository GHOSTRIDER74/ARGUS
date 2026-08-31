/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        argus: {
          bg:        "#FBFBFA",
          surface:   "#FFFFFF",
          surface2:  "#F4F4F5",
          border:    "#E5E7EB",
          text:      "#0F1115",
          muted:     "#5A5F6B",
          accent:    "#4361EE",
          "accent-hover": "#3A56D4",
        },
        status: {
          green:  "#16A34A",
          amber:  "#D97706",
          red:    "#DC2626",
        },
      },
      fontFamily: {
        sans: ["'Inter Tight'", "'Geist'", "'Inter'", "system-ui", "sans-serif"],
        mono: ["'Geist Mono'", "'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter:  "-0.02em",
      },
      lineHeight: {
        tightest: "1.05",
      },
    },
  },
  plugins: [],
};
