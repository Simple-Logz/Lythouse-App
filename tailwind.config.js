/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9ecff', 200: '#bcddff', 300: '#8ec8ff', 400: '#59abff',
          500: '#338bff', 600: '#1c6df0', 700: '#1556dc', 800: '#1746b4', 900: '#193e8f', 950: '#14275a',
        },
        navy: {
          50: '#f0f4fa', 100: '#e0e9f4', 200: '#c7d8ea', 300: '#a4c0dc', 400: '#7ea1c8',
          500: '#5d83b5', 600: '#466a9c', 700: '#3a5680', 800: '#344969', 900: '#2f4059', 950: '#222c3e',
        },
        danger: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
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
