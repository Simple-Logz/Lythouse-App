/** @type {import('tailwindcss').Config} */

// ── "Porcelain & Ink" design system ────────────────────────────────────────
// Ultra-clean, near-monochrome: warm porcelain surfaces, true-neutral ink text,
// solid ink-black primary actions, with a single refined indigo accent for
// links, active states and focus. Natural amber/red kept for warning & danger.
// Every accent token is remapped here so existing classes resolve automatically.

// Accent spark: one refined indigo (links, active nav, focus rings).
const violet = {
  50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
  400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
  800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
};

// Neutral text/UI (kept under "navy"): true-neutral ink, no blue cast.
const slate = {
  50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8',
  400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46',
  800: '#27272a', 900: '#18181b', 950: '#09090b',
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
        glossy: '0 1px 0 0 rgba(255,255,255,.3) inset, 0 8px 20px -6px rgba(16,24,40,.20)',
        soft: '0 1px 2px rgba(16,24,40,.04), 0 12px 28px -12px rgba(16,24,40,.16)',
        lift: '0 8px 16px rgba(16,24,40,.08), 0 24px 44px -18px rgba(16,24,40,.20)',
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
