import type { Config } from "tailwindcss";
// Los colores "de oscuro" de Tailwind se redirigen a variables CSS (globals.css) para soportar claro/oscuro.
const rgb = (v: string, k = "1") => `rgb(var(${v}) / calc(${k} * <alpha-value>))`;
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Arial Narrow", "Arial", "sans-serif"],
        body: ["var(--font-body)", "Arial", "Helvetica", "sans-serif"]
      },
      colors: {
        white: rgb("--fg-rgb"),
        black: rgb("--bg-rgb"),
        zinc: {
          100: rgb("--fg-rgb"),
          200: rgb("--fg-rgb"),
          300: rgb("--fg-rgb"),
          400: rgb("--muted-rgb"),
          500: rgb("--muted2-rgb"),
          600: rgb("--muted3-rgb"),
          800: rgb("--fg-rgb", ".12"),
          900: rgb("--fg-rgb", ".06")
        },
        red: {
          400: rgb("--accent-text-rgb"),
          500: rgb("--accent-text-rgb"),
          600: rgb("--accent-rgb")
        },
        emerald: { 400: rgb("--pos-rgb") },
        amber: { 300: rgb("--warn-rgb"), 400: rgb("--warn-rgb") }
      }
    }
  },
  plugins: []
};
export default config;
