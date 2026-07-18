/** @type {import('tailwindcss').Config} */

// ── Mild-green design system ──────────────────────────────────────────────
// The whole app is unified to one calm sage-green family. Instead of editing
// dozens of pages, we remap every accent color token here so existing classes
// like `bg-amber-500`, `text-blue-600`, `bg-purple-600`, etc. all resolve to
// green shades automatically.

// Primary / brand: soft, muted sage green (was a vivid grass green).
const sage = {
  50: '#f4f8f4', 100: '#e6efe6', 200: '#ccdccd', 300: '#a9c2aa',
  400: '#82a384', 500: '#628565', 600: '#4c6d4f', 700: '#3d5740',
  800: '#334736', 900: '#2b3b2d', 950: '#161f17',
};

// Neutral text/UI (replaces the blue-ish "navy"): a dark green-tinted gray so
// headings and body copy stay calm and readable, not blue.
const greenGray = {
  50: '#f5f7f5', 100: '#e8ebe8', 200: '#d0d6d1', 300: '#aab4ab',
  400: '#7d8b7f', 500: '#5c6b5e', 600: '#48544a', 700: '#3b453d',
  800: '#313a33', 900: '#28312a', 950: '#181e19',
};

// Warning tone: a warm olive-green (still green, just a touch warmer) so
// "review / caution" states read slightly different without leaving the family.
const olive = {
  50: '#f6f7ee', 100: '#eaefd8', 200: '#d6ddb4', 300: '#bcc687',
  400: '#a2ad62', 500: '#879247', 600: '#6a7437', 700: '#51592e',
  800: '#434829', 900: '#3a3e26', 950: '#1e2011',
};

// Alert / error tone: a deep forest green so "failed / danger" still reads as
// heavier and more serious — differentiated by depth, not by hue.
const forest = {
  50: '#eef4ee', 100: '#d6e5d7', 200: '#b0ccb2', 300: '#82ac85',
  400: '#578b5b', 500: '#3c6e40', 600: '#2d5731', 700: '#264628',
  800: '#213a23', 900: '#1c301e', 950: '#0e1a10',
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
