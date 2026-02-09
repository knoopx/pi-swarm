/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base16 palette
        base00: "var(--base00)",
        base01: "var(--base01)",
        base02: "var(--base02)",
        base03: "var(--base03)",
        base04: "var(--base04)",
        base05: "var(--base05)",
        base06: "var(--base06)",
        base07: "var(--base07)",
        base08: "var(--base08)",
        base09: "var(--base09)",
        base0A: "var(--base0A)",
        base0B: "var(--base0B)",
        base0C: "var(--base0C)",
        base0D: "var(--base0D)",
        base0E: "var(--base0E)",
        base0F: "var(--base0F)",

        // Semantic mappings to base16
        background: "var(--base00)",
        foreground: "var(--base05)",
        card: {
          DEFAULT: "var(--base01)",
          foreground: "var(--base05)",
        },
        popover: {
          DEFAULT: "var(--base01)",
          foreground: "var(--base05)",
        },
        primary: {
          DEFAULT: "var(--base07)",
          foreground: "var(--base00)",
        },
        secondary: {
          DEFAULT: "var(--base02)",
          foreground: "var(--base04)",
        },
        muted: {
          DEFAULT: "var(--base02)",
          foreground: "var(--base04)",
        },
        accent: {
          DEFAULT: "var(--base0A)",
          foreground: "var(--base00)",
        },
        destructive: {
          DEFAULT: "var(--base08)",
          foreground: "var(--base00)",
        },
        success: {
          DEFAULT: "var(--base0B)",
          foreground: "var(--base00)",
        },
        warning: {
          DEFAULT: "var(--base09)",
          foreground: "var(--base00)",
        },
        border: "var(--base02)",
        input: "var(--base02)",
        ring: "var(--base07)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
