/** @type {import('tailwindcss').Config} */

// ── Mild-green design system ──────────────────────────────────────────────
// The whole app is unified to one calm sage-green family. Instead of editing
// dozens of pages, we remap every accent color token here so existing classes
// like `bg-amber-500`, `text-blue-600`, `bg-purple-600`, etc. all resolve to
// green shades automatically.

// Primary / brand: fresh, lively green — bright but not neon.
const sage = {
  50: '#f0fbf4', 100: '#d7f4e0', 200: '#aee8c3', 300: '#78d69f',
  400: '#43c078', 500: '#22a659', 600: '#159048', 700: '#14743d',
  800: '#155c34', 900: '#134a2c', 950: '#062815',
};

// Neutral text/UI (replaces the blue-ish "navy"): a dark green-tinted gray so
// headings and body copy stay calm and readable, not blue.
const greenGray = {
  50: '#f5f7f5', 100: '#e8ebe8', 200: '#d0d6d1', 300: '#aab4ab',
  400: '#7d8b7f', 500: '#5c6b5e', 600: '#48544a', 700: '#3b453d',
  800: '#313a33', 900: '#28312a', 950: '#181e19',
};

// Warning tone: a brighter lime-leaning green so "review / caution" states
// read slightly warmer without leaving the family.
const olive = {
  50: '#f6fbe8', 100: '#eaf5c8', 200: '#d6ec95', 300: '#bfdd5f',
  400: '#a7c936', 500: '#8bad24', 600: '#6e8b1c', 700: '#54691c',
  800: '#45541c', 900: '#3b471b', 950: '#1e2709',
};

// Alert / error tone: a slightly deeper, teal-leaning green so "failed /
// danger" still reads as heavier — differentiated by depth, not by hue.
const forest = {
  50: '#ecfbf1', 100: '#cff4dd', 200: '#a2e8c1', 300: '#68d3a0',
  400: '#38ba81', 500: '#1c9e68', 600: '#137e54', 700: '#136545',
  800: '#135039', 900: '#114230', 950: '#04251a',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary green
        brand: sage,
        green: sage,
        emerald: sage,
        lime: sage,
        teal: sage,

        // Neutral text/surfaces (formerly blue-navy)
        navy: greenGray,

        // Everything decorative / "info" → same calm green
        blue: sage,
        sky: sage,
        cyan: sage,
        indigo: sage,
        violet: sage,
        purple: sage,
        fuchsia: sage,
        pink: sage,

        // Warnings → warm olive-green
        amber: olive,
        yellow: olive,
        orange: olive,

        // Errors / danger → deep forest-green
        red: forest,
        rose: forest,
        danger: forest,
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
