/** @type {import('tailwindcss').Config} */

// ── Deep-indigo design system ─────────────────────────────────────────────
// The whole app is unified to one indigo / blue-violet family (inspired by the
// deep indigo wall). Instead of editing dozens of pages, we remap every accent
// color token here so existing classes like `bg-amber-500`, `text-blue-600`,
// `bg-purple-600`, etc. all resolve to indigo shades automatically.

// Primary / brand: rich, vivid indigo (~the wall tone at 700).
const indigo = {
  50: '#f1f1fb', 100: '#e4e3f8', 200: '#cbc9f1', 300: '#a8a4e6',
  400: '#837dd6', 500: '#635ac4', 600: '#4f45ab', 700: '#423a8c',
  800: '#383172', 900: '#2f2a5d', 950: '#1d1a38',
};

// Neutral text/UI (replaces "navy"): a dark indigo-tinted gray so headings and
// body copy stay in-family but remain calm and readable.
const indigoGray = {
  50: '#f5f5f8', 100: '#e9e8ef', 200: '#d1d0dd', 300: '#adaac1',
  400: '#817d9e', 500: '#605c7a', 600: '#4b4762', 700: '#3d3a50',
  800: '#333145', 900: '#2b2a3a', 950: '#181725',
};

// Warning tone: a lighter, brighter periwinkle-violet so "review / caution"
// states read a touch warmer without leaving the family.
const periwinkle = {
  50: '#f3f2fc', 100: '#e6e4f9', 200: '#d0ccf3', 300: '#b1a9ea',
  400: '#9184de', 500: '#7768cf', 600: '#6252b3', 700: '#514391',
  800: '#443a75', 900: '#3a3360', 950: '#221d3a',
};

// Alert / error tone: a deeper, darker indigo so "failed / danger" still reads
// as heavier and more serious — differentiated by depth, not by hue.
const deepIndigo = {
  50: '#edecf5', 100: '#d5d3e9', 200: '#aeabd2', 300: '#837eb8',
  400: '#5b549c', 500: '#3f387f', 600: '#322c66', 700: '#2a2553',
  800: '#241f45', 900: '#1f1b3a', 950: '#100e20',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary indigo
        brand: indigo,
        indigo: indigo,
        violet: indigo,
        purple: indigo,
        blue: indigo,
        sky: indigo,
        cyan: indigo,
        fuchsia: indigo,
        pink: indigo,
        // Former green tokens now also read as indigo
        green: indigo,
        emerald: indigo,
        lime: indigo,
        teal: indigo,

        // Neutral text/surfaces (formerly blue-navy)
        navy: indigoGray,

        // Warnings → lighter periwinkle-violet
        amber: periwinkle,
        yellow: periwinkle,
        orange: periwinkle,

        // Errors / danger → deep indigo
        red: deepIndigo,
        rose: deepIndigo,
        danger: deepIndigo,
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
