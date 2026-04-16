/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cinnabar: '#A8362A',
        paper: '#F5F0E8',
        'paper-deep': '#EBE4D8',
        ink: '#2C2C2C',
        'ink-light': '#5C5C5C',
        'ink-mute': '#8A8A8A',
        huizhou: '#3D4F5F',
        gold: '#C6A656',
        jade: '#4A6B5D',
      },
      fontFamily: {
        serif: [
          '"Noto Serif SC"',
          '"Songti SC"',
          '"STSong"',
          'SimSun',
          'serif',
        ],
        sans: [
          '"Noto Sans SC"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      fontSize: {
        display: ['72rpx', { lineHeight: '1.2' }],
        headline: ['56rpx', { lineHeight: '1.25' }],
        title: ['40rpx', { lineHeight: '1.3' }],
        subtitle: ['32rpx', { lineHeight: '1.35' }],
        body: ['28rpx', { lineHeight: '1.5' }],
        caption: ['20rpx', { lineHeight: '1.4' }],
      },
      borderRadius: {
        DEFAULT: '12rpx',
        lg: '16rpx',
        sm: '8rpx',
      },
      boxShadow: {
        soft: '0 8rpx 24rpx rgba(44, 44, 44, 0.08)',
      },
      keyframes: {
        'hui-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'hui-spin': 'hui-spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
