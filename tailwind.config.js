/** @type {import('tailwindcss').Config} */

// ── "Slate & Gold" design system ───────────────────────────────────────────
// Warm, editorial, high-end: warm charcoal ink on soft light surfaces, a
// refined gold accent for links, active states and focus, and cream-on-charcoal
// primary actions. Natural amber/red kept for warning & danger.
// Every accent token is remapped here so existing classes resolve automatically.

// Accent: refined gold (links, active nav, focus rings, key numbers).
const violet = {
  50: '#fbf7ec', 100: '#f6ebcb', 200: '#ecd79a', 300: '#e0bd63',
  400: '#d4a53c', 500: '#c08a2d', 600: '#a67322', 700: '#835820',
  800: '#6c4820', 900: '#5c3d1f', 950: '#35220e',
};

// Neutral text/UI (kept under "navy"): warm charcoal, no blue cast.
const slate = {
  50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
  400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c',
  800: '#292524', 900: '#1c1917', 950: '#0c0a09',
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
        glossy: '0 1px 0 0 rgba(255,255,255,.3) inset, 0 8px 20px -6px rgba(40,32,16,.20)',
        soft: '0 1px 2px rgba(40,32,16,.05), 0 12px 28px -12px rgba(40,32,16,.16)',
        lift: '0 8px 16px rgba(40,32,16,.08), 0 24px 44px -18px rgba(40,32,16,.20)',
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
