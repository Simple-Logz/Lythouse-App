/** @type {import('tailwindcss').Config} */

// ── Fresh green design system (Formstack-inspired) ─────────────────────────
// Clean white surfaces, a friendly medium-green brand accent, calm slate text,
// and natural amber/red for warning & danger. Every accent token is remapped
// here so existing classes (bg-blue-600, text-purple-700, etc.) resolve to the
// green family automatically — no need to edit dozens of pages.

// Primary / brand: friendly medium green (the 400 is the Formstack accent).
const green = {
  50: '#eff8f3', 100: '#d7efe1', 200: '#b2e0c6', 300: '#83cca6',
  400: '#54b483', 500: '#37a06a', 600: '#2c8657', 700: '#256c48',
  800: '#22563b', 900: '#1d4732', 950: '#0c2a1c',
};

// Neutral text/UI (replaces "navy"): calm cool slate so headings and body copy
// stay clean and readable on white.
const slate = {
  50: '#f6f7f9', 100: '#eceef1', 200: '#d4d9e0', 300: '#aeb6c2',
  400: '#818b9c', 500: '#5f6a7d', 600: '#4a5364', 700: '#3c4453',
  800: '#333a46', 900: '#1f2530', 950: '#12161d',
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
        // Primary green
        brand: green,
        green: green,
        emerald: green,
        lime: green,
        teal: green,
        // Cool accents also read as green so the app stays one family
        indigo: green,
        violet: green,
        purple: green,
        blue: green,
        sky: green,
        cyan: green,
        fuchsia: green,
        pink: green,

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
      animation: { 'fade-in': 'fadeIn 0.3s ease-out', 'scale-in': 'scaleIn 0.2s ease-out' },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        scaleIn: { '0%': { opacity: 0, transform: 'scale(0.95)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
