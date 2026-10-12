/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5fbf2',
          100: '#e7f5e1',
          200: '#ccebc4',
          300: '#a3d996',
          400: '#6ebd60',
          500: '#3e7b5c',
          600: '#32664b',
          700: '#28523c',
          800: '#204130',
          900: '#1a3528',
          950: '#0c1c14',
          coral: '#FCE3E1',
          coralText: '#C8403C',
          amber: '#FEE8D6',
          amberText: '#B86A1B',
          mint: '#D2E8D4',
          mintText: '#267343',
          navy: '#19211D',
          muted: '#68756D',
        },
        surface: {
          cream: '#FAF9F5',
          subtle: '#F2F6F0',
          card: '#FFFFFF',
          dim: '#d6dcd3',
        },
        cream: {
          50: '#FAF9F6',
          100: '#F6F5F0',
          200: '#EFECE5',
          300: '#E3DFD5',
        },
        forest: {
          500: '#3D654A',
          600: '#375B42',
          700: '#2D4739',
          800: '#22382D',
          900: '#192820',
        },
        sage: {
          50: '#F5F8F3',
          100: '#EAF0E7',
          200: '#E3EBDD',
          300: '#CDDCC4',
          500: '#889F8D',
        },
        clay: {
          card: '#FFFFFF',
          border: '#EBE7DF',
          hoverBorder: '#DDD7CB',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'clay': '0 14px 34px -4px rgba(46,75,55,0.08), 0 4px 12px -2px rgba(46,75,55,0.03), inset 0 1px 1px rgba(255,255,255,0.95)',
        'clay-hover': '0 20px 42px -6px rgba(46,75,55,0.13), 0 6px 16px -2px rgba(46,75,55,0.05), inset 0 1px 1px rgba(255,255,255,1)',
        'clay-button': '0 8px 24px -2px rgba(46,75,55,0.24), inset 0 1px 1px rgba(255,255,255,0.3)',
        'clay-pressed': 'inset 0 3px 6px rgba(12,28,20,0.25)',
        'clay-card': '0 16px 36px -6px rgba(46,75,55,0.06), 0 2px 8px -1px rgba(46,75,55,0.02), inset 0 1px 1px rgba(255,255,255,0.9)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      }
    },
  },
  plugins: [],
}
