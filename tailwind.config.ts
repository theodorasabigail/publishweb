import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /*
         * The brand palette, extended so it can carry text.
         *
         * Both brand blues sit on one hue (192°) at close saturation, so they
         * are two points on a single ramp rather than two colours. 500 and 700
         * below ARE #638c97 and #486b73, untouched. Everything else is that
         * same hue taken lighter or darker.
         *
         * The extension exists because not one of the six brand colours can be
         * read as body text. Measured against the page background they run
         * from 1.8:1 (blush) to 5.4:1 (deep teal), against a 4.5:1 floor. That
         * is a palette drawn for surfaces, not for words — so the darker steps
         * carry text and the brand colours stay what they are, fills.
         *
         * Contrast on the page background, measured:
         *   500  3.4  decorative only     800   7.9  AAA, secondary text
         *   600  4.6  AA, small print     900  10.9  AAA
         *   700  5.4  AA                  950  14.7  AAA
         */
        sea: {
          50: "#f2f6f7",
          100: "#e3ecee",
          200: "#c8d9dd",
          300: "#a3bfc6",
          400: "#7ea3ac",
          500: "#638c97",
          600: "#547680",
          700: "#486b73",
          800: "#35525a",
          900: "#243c43",
          950: "#13262b",
        },

        /*
         * Accents: fills only. Every one fails as text on a light background,
         * and all four are comfortably legible *under* ink, so anything placed
         * on them takes dark type — never white.
         */
        coral: "#ee8a7a",
        peach: "#e2a290",
        blush: "#dab0b0",
        lilac: "#a7a4b5",

        /* Body text: the brand hue taken nearly to black, 15.7:1 on the page.
         * Deliberately far above the 4.5:1 floor, because a cheap panel eats
         * the difference between 7:1 and 15:1 and only one of them survives. */
        ink: "#0f2024",
        /* The page: the warm off-white the brand sheet is itself printed on,
         * which is what stops the corals reading as a different brand. */
        cream: "#fdf6f4",
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
