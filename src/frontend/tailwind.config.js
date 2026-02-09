/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
      colors: {
        // Base16 palette
        base00: "#191033",
        base01: "#1e133c",
        base02: "#2f235c",
        base03: "#404079",
        base04: "#646499",
        base05: "#f8f8f8",
        base06: "#e5e4fb",
        base07: "#fad000",
        base08: "#ff628c",
        base09: "#ffb454",
        base0A: "#ffee80",
        base0B: "#a5ff90",
        base0C: "#80fcff",
        base0D: "#fad000",
        base0E: "#faefa5",
        base0F: "#fb94ff",

        // Semantic mappings to base16
        background: "#191033",
        foreground: "#f8f8f8",
        card: {
          DEFAULT: "#1e133c",
          foreground: "#f8f8f8",
        },
        popover: {
          DEFAULT: "#1e133c",
          foreground: "#f8f8f8",
        },
        primary: {
          DEFAULT: "#fad000",
          foreground: "#191033",
        },
        secondary: {
          DEFAULT: "#2f235c",
          foreground: "#646499",
        },
        muted: {
          DEFAULT: "#2f235c",
          foreground: "#646499",
        },
        accent: {
          DEFAULT: "#ffee80",
          foreground: "#191033",
        },
        destructive: {
          DEFAULT: "#ff628c",
          foreground: "#191033",
        },
        success: {
          DEFAULT: "#a5ff90",
          foreground: "#191033",
        },
        warning: {
          DEFAULT: "#ffb454",
          foreground: "#191033",
        },
        info: {
          DEFAULT: "#80fcff",
          foreground: "#191033",
        },
        border: "#2f235c",
        input: "#2f235c",
        ring: "#fad000",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-glow": {
          from: {
            boxShadow:
              "0 0 5px var(--tw-ring-color), 0 0 10px var(--tw-ring-color), 0 0 15px var(--tw-ring-color)",
          },
          to: {
            boxShadow:
              "0 0 10px var(--tw-ring-color), 0 0 20px var(--tw-ring-color), 0 0 30px var(--tw-ring-color)",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
