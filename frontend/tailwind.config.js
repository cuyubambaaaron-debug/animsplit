/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#080d1a',
        panel:   '#0d1526',
        card:    '#111e35',
        border:  '#1a2d4a',
        cyan:    '#00d4ff',
        'cyan-dim':  '#0099bb',
        'cyan-glow': '#7df9ff',
        'cyan-bg':   'rgba(0,212,255,0.07)',
        success: '#00ff94',
        warning: '#ffb347',
        danger:  '#ff4d6d',
        muted:   '#4a6080',
      },
      boxShadow: {
        cyan:  '0 0 20px rgba(0,212,255,0.25)',
        'cyan-sm': '0 0 8px rgba(0,212,255,0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
