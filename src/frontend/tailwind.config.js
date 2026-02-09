/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base16 palette
        base00: "rgb(25, 16, 51)",
        base01: "rgb(30, 19, 60)",
        base02: "rgb(47, 35, 92)",
        base03: "rgb(64, 64, 121)",
        base04: "rgb(100, 100, 153)",
        base05: "rgb(248, 248, 248)",
        base06: "rgb(229, 228, 251)",
        base07: "rgb(250, 208, 0)",
        base08: "rgb(255, 98, 140)",
        base09: "rgb(255, 180, 84)",
        base0A: "rgb(255, 238, 128)",
        base0B: "rgb(165, 255, 144)",
        base0C: "rgb(128, 252, 255)",
        base0D: "rgb(250, 208, 0)",
        base0E: "rgb(250, 239, 165)",
        base0F: "rgb(251, 148, 255)",

        // Semantic mappings to base16
        background: "rgb(25, 16, 51)",
        foreground: "rgb(248, 248, 248)",
        card: {
          DEFAULT: "rgb(30, 19, 60)",
          foreground: "rgb(248, 248, 248)",
        },
        popover: {
          DEFAULT: "rgb(30, 19, 60)",
          foreground: "rgb(248, 248, 248)",
        },
        primary: {
          DEFAULT: "rgb(250, 208, 0)",
          foreground: "rgb(25, 16, 51)",
        },
        secondary: {
          DEFAULT: "rgb(47, 35, 92)",
          foreground: "rgb(100, 100, 153)",
        },
        muted: {
          DEFAULT: "rgb(47, 35, 92)",
          foreground: "rgb(100, 100, 153)",
        },
        accent: {
          DEFAULT: "rgb(255, 238, 128)",
          foreground: "rgb(25, 16, 51)",
        },
        destructive: {
          DEFAULT: "rgb(255, 98, 140)",
          foreground: "rgb(25, 16, 51)",
        },
        success: {
          DEFAULT: "rgb(165, 255, 144)",
          foreground: "rgb(25, 16, 51)",
        },
        warning: {
          DEFAULT: "rgb(255, 180, 84)",
          foreground: "rgb(25, 16, 51)",
        },
        info: {
          DEFAULT: "rgb(128, 252, 255)",
          foreground: "rgb(25, 16, 51)",
        },
        border: "rgb(47, 35, 92)",
        input: "rgb(47, 35, 92)",
        ring: "rgb(250, 208, 0)",
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
