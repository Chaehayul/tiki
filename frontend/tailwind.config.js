export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        tikiBounce: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-6px)' },
        },
        nodeGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,153,204,.25)' },
          '50%': { boxShadow: '0 0 22px rgba(0,153,204,.4)' },
        },
        successBounce: {
          '0%': { transform: 'scale(.5)', opacity: '0' },
          '70%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        uploadShine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.3', transform: 'scale(.7)' },
        },
        tabSlide: {
          from: { transform: 'translateY(80px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        footerFadeIn: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        tikiBounce: 'tikiBounce 1.6s ease-in-out infinite',
        nodeGlow: 'nodeGlow 1.5s infinite',
        successBounce: 'successBounce .5s ease',
        uploadShine: 'uploadShine 1.2s ease infinite',
        pulseDot: 'pulseDot 1.5s infinite',
        tabSlide: 'tabSlide .35s cubic-bezier(.22,1,.36,1) both',
        footerFadeIn: 'footerFadeIn .6s ease both',
      },
    },
  },
}
