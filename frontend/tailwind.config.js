/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f0f1a',
        card: '#1a1a2e',
        border: '#2a2a45',
        accent: '#7c3aed',
        'accent-light': '#9f67ff',
        'accent-dim': '#4c1d95',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
