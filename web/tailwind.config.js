/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
