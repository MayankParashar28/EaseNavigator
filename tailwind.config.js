/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        midnight: '#050505',
        surface: {
          DEFAULT: '#0F0F12',
          highlight: '#1A1A1E',
        },
        neon: {
          purple: '#7F5AF0',
          green: '#2CB67D',
          blue: '#D4F4F7',
        },
        'text': {
          primary: '#FFFFFE',
          secondary: '#94A1B2',
          tertiary: '#72757E',
        },
        'color-text': {
          secondary: '#94A1B2',
          tertiary: '#72757E',
        }
      },
      boxShadow: {
        'neon-focus': '0 0 20px rgba(127, 90, 240, 0.1)',
      }
    },
  },
  plugins: [],
};
