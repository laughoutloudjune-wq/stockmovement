/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.{js,vue}"
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Sarabun', 'sans-serif'] },
      colors: {
        // Strict MD3 Baseline Palette (Purple)
        'md-sys-color-primary': '#6750A4',
        'md-sys-color-on-primary': '#FFFFFF',
        'md-sys-color-primary-container': '#EADDFF',
        'md-sys-color-on-primary-container': '#21005D',
        
        'md-sys-color-secondary': '#625B71',
        'md-sys-color-on-secondary': '#FFFFFF',
        'md-sys-color-secondary-container': '#E8DEF8',
        'md-sys-color-on-secondary-container': '#1D192B',
        
        'md-sys-color-error': '#B3261E',
        'md-sys-color-on-error': '#FFFFFF',
        'md-sys-color-error-container': '#F9DEDC',
        'md-sys-color-on-error-container': '#410E0B',

        'md-sys-color-background': '#FEF7FF',
        'md-sys-color-on-background': '#1D1B20',

        'md-sys-color-surface': '#FEF7FF',
        'md-sys-color-on-surface': '#1D1B20',
        'md-sys-color-surface-variant': '#E7E0EC',
        'md-sys-color-on-surface-variant': '#49454F',
        
        'md-sys-color-outline': '#79747E',
        'md-sys-color-outline-variant': '#CAC4D0',

        'md-sys-color-surface-container-lowest': '#FFFFFF',
        'md-sys-color-surface-container-low': '#F7F2FA',
        'md-sys-color-surface-container': '#F3EDF7',
        'md-sys-color-surface-container-high': '#ECE6F0',
        'md-sys-color-surface-container-highest': '#E6E0E9',
      },
      boxShadow: {
        'md3-elevation-1': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        'md3-elevation-2': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
        'md3-elevation-3': '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)'
      }
    }
  },
  plugins: [],
}
