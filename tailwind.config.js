/** @type {import('tailwindcss').Config} */

// ── Premium violet-indigo design system ────────────────────────────────────
// Rich, glossy violet brand on clean white, cool near-black slate text, and
// natural amber/red for warning & danger. Every accent token is remapped here
// so existing classes resolve to the new family automatically.

// Primary / brand: vibrant, premium violet-indigo.
const violet = {
  50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
  400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
  800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
};

// Neutral text/UI (replaces "navy"): cool near-black slate.
const slate = {
  50: '#f8f9fc', 100: '#f0f1f7', 200: '#e1e3ee', 300: '#c8ccdd',
  400: '#98a0b8', 500: '#697091', 600: '#4c5372', 700: '#3a4058',
  800: '#282c3e', 900: '#171a26', 950: '#0d0f18',
};

// Warning tone: natural amber.
const amber = {
  50: '#fff8eb', 100: '#feefc7', 200: '#fddf8a', 300: '#fbca4d',
  400: '#f9b224', 500: '#f3970b', 600: '#d77406', 700: '#b25309',
  800: '#90400e', 900: '#76350f', 950: '#441a03',
};

// Alert / error tone: natural red.
const red = {
  50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
  400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
  800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary violet-indigo
        brand: violet,
        indigo: violet,
        violet: violet,
        purple: violet,
        blue: violet,
        sky: violet,
        cyan: violet,
        fuchsia: violet,
        pink: violet,
        // Greens also read as brand so the app stays one family
        green: violet,
        emerald: violet,
        lime: violet,
        teal: violet,

        // Neutral text/surfaces
        navy: slate,

        // Warnings → natural amber
        amber: amber,
        yellow: amber,
        orange: amber,

        // Errors / danger → natural red
        red: red,
        rose: red,
        danger: red,
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      boxShadow: {
        glossy: '0 1px 0 0 rgba(255,255,255,.35) inset, 0 8px 20px -6px rgba(124,58,237,.45)',
        soft: '0 1px 2px rgba(16,24,40,.04), 0 12px 28px -12px rgba(16,24,40,.18)',
        lift: '0 8px 16px rgba(16,24,40,.08), 0 24px 44px -18px rgba(124,58,237,.28)',
      },
      animation: { 'fade-in': 'fadeIn 0.3s ease-out', 'scale-in': 'scaleIn 0.2s ease-out' },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        scaleIn: { '0%': { opacity: 0, transform: 'scale(0.95)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
