/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:   {
          DEFAULT: '#0A2540',
          50:  '#E8EDF3',
          100: '#C5D0DE',
          200: '#8FA4BD',
          300: '#5A789C',
          400: '#2F4F73',
          500: '#0A2540',
          600: '#081E34',
          700: '#061728',
          800: '#04101C',
          900: '#020810',
        },
        azure:  {
          DEFAULT: '#0066CC',
          50:  '#E5F0FF',
          100: '#B3D4FF',
          200: '#80B8FF',
          300: '#4D9CFF',
          400: '#1A80FF',
          500: '#0066CC',
          600: '#0052A3',
          700: '#003D7A',
          800: '#002952',
          900: '#001429',
        },
        teal:   {
          DEFAULT: '#10B981',
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        canvas: {
          DEFAULT: '#F4F7FA',
          50:  '#FFFFFF',
          100: '#F4F7FA',
          200: '#E8EDF3',
          300: '#D1DAE5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass':    '0 10px 30px -5px rgba(10, 37, 64, 0.08)',
        'glass-lg': '0 20px 50px -10px rgba(10, 37, 64, 0.12)',
        'glass-sm': '0 4px 15px -2px rgba(10, 37, 64, 0.06)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in':     'fadeIn 0.5s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:     { '0%': { opacity: '0' },                                    '100%': { opacity: '1' } },
        slideUp:    { '0%': { opacity: '0', transform: 'translateY(20px)' },     '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideRight: { '0%': { opacity: '0', transform: 'translateX(-20px)' },    '100%': { opacity: '1', transform: 'translateX(0)' } },
        pulseSoft:  { '0%, 100%': { opacity: '1' },                               '50%':  { opacity: '0.7' } },
      },
    },
  },
  plugins: [],
};
