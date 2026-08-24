import type { Config } from "tailwindcss";

/**
 * Tokens de diseño del stack `sicalab` (mismos que usa sica-intranet):
 * base azul-noche + acento ámbar, semáforo verde/amarillo/rojo.
 * Los valores viven como CSS custom properties en globals.css para que
 * también sirvan desde CSS plano; acá se exponen a Tailwind.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
        },
        panel: {
          DEFAULT: "var(--panel)",
          2: "var(--panel-2)",
        },
        line: {
          DEFAULT: "var(--border)",
          lt: "var(--border-lt)",
        },
        ink: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
          faint: "var(--text-faint)",
        },
        amber: {
          DEFAULT: "var(--amber)",
          dim: "var(--amber-dim)",
        },
        ok: "var(--green)",
        warn: "var(--yellow)",
        bad: "var(--red)",
        info: "var(--blue)",
      },
      fontFamily: {
        mono: ["var(--font-mono)"],
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
      },
      boxShadow: {
        panel: "0 20px 60px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 var(--amber-glow)" },
          "70%": { boxShadow: "0 0 0 8px rgba(240,160,48,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(240,160,48,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in .25s ease both",
        "pulse-ring": "pulse-ring 1.4s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
