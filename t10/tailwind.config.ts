import type { Config } from "tailwindcss";

/**
 * T10 design system.
 * Colour is driven by CSS custom properties (see app/globals.css) so that
 * light mode is a token swap rather than a second set of utility classes.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--t10-canvas) / <alpha-value>)",
        surface: "rgb(var(--t10-surface) / <alpha-value>)",
        raised: "rgb(var(--t10-raised) / <alpha-value>)",
        line: "rgb(var(--t10-line) / <alpha-value>)",
        "line-strong": "rgb(var(--t10-line-strong) / <alpha-value>)",
        ink: "rgb(var(--t10-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--t10-ink-soft) / <alpha-value>)",
        "ink-muted": "rgb(var(--t10-ink-muted) / <alpha-value>)",
        accent: "rgb(var(--t10-accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--t10-accent-soft) / <alpha-value>)",
        "accent-ink": "rgb(var(--t10-accent-ink) / <alpha-value>)",
        danger: "rgb(var(--t10-danger) / <alpha-value>)",
        warn: "rgb(var(--t10-warn) / <alpha-value>)",
        ok: "rgb(var(--t10-ok) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      maxWidth: { thread: "48rem", shell: "78rem" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(-4px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
        "word-in": { from: { opacity: "0", filter: "blur(4px)" }, to: { opacity: "1", filter: "none" } },
        shimmer: { from: { backgroundPosition: "180% 0" }, to: { backgroundPosition: "-80% 0" } },
        bob: { "0%,70%,100%": { transform: "translateY(0) scale(.82)", opacity: ".45" }, "35%": { transform: "translateY(-5px) scale(1)", opacity: "1" } },
        sweep: { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(320%)" } },
      },
      animation: {
        "fade-up": "fade-up .34s cubic-bezier(.2,.8,.3,1) both",
        "fade-in": "fade-in .24s ease both",
        "pop-in": "pop-in .16s cubic-bezier(.2,.8,.3,1) both",
        "word-in": "word-in .3s ease both",
        shimmer: "shimmer 2.2s linear infinite",
        bob: "bob 1.25s ease-in-out infinite",
        sweep: "sweep 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
