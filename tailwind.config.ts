import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bark: {
          50: "#faf7f2",
          100: "#f1eadd",
          200: "#e2d3bd",
          300: "#cdb493",
          400: "#b69169",
          500: "#a3784f",
          600: "#8c6144",
          700: "#714c39",
          800: "#5d4033",
          900: "#4e372d",
          950: "#2b1c16",
        },
        ink: "#1b1613",
        cream: "#fbf8f3",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-up": "fade-up 0.35s ease-out both" },
    },
  },
  plugins: [typography],
} satisfies Config;
