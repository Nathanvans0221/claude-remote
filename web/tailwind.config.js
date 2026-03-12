/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        fern: {
          DEFAULT: '#69936C',
          dark: '#4A7A4D',
          light: '#A1DBA6',
        },
      },
    },
  },
  plugins: [],
};
