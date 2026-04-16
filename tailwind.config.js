/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cinnabar: '#A8362A',
        paper: '#F5F0E8',
        ink: '#2C2C2C',
      },
      fontSize: {
        headline: ['56rpx', { lineHeight: '1.25' }],
      },
    },
  },
  plugins: [],
}
