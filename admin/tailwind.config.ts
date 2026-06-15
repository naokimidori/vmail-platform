import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "rgba(38, 48, 68, 0.09)",
        input: "rgba(255, 255, 255, 0.72)",
        ring: "#7b48df",
        lime: "#b6fb83",
        page: "#d9e2ea",
        text: "#151a27",
        background: "#eef1f7",
        foreground: "#151a27",
        primary: {
          DEFAULT: "#7b48df",
          hover: "#5432b8",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#efe8ff",
          foreground: "#5432b8",
        },
        mint: {
          DEFAULT: "#eaf8ff",
          foreground: "#25324a",
        },
        muted: {
          DEFAULT: "#edf9f1",
          foreground: "#667086",
        },
        card: {
          DEFAULT: "rgba(250, 253, 255, 0.66)",
          foreground: "#151a27",
        },
      },
      boxShadow: {
        glass:
          "0 18px 52px rgba(79, 93, 119, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
        frame:
          "0 30px 90px rgba(75, 88, 116, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
        purple: "0 18px 30px rgba(103, 64, 199, 0.35)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
