/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.{js,vue}"
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Sarabun', 'sans-serif'] },
      colors: { primary: '#0a84ff', accent: '#eef1f6' },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out'
      }
    }
  },
  plugins: [],
}
