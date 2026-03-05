/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Reference CSS variables so the design system stays as single source of truth
        'brand-blue':   'var(--accent-blue)',
        'brand-soft':   'var(--accent-soft)',
        'text-main':    'var(--text-main)',
        'text-muted':   'var(--text-muted)',
        'bg-light':     'var(--bg-light)',
        'glass-white':  'var(--glass-white)',
        success:        'var(--color-success)',
        error:          'var(--color-error)',
        surface:        '#ffffff',
        'surface-2':    '#f8fafc',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body:    ['Urbanist', 'sans-serif'],
      },
      borderRadius: {
        sm:    '8px',
        md:    '14px',
        lg:    '24px',
        '2xl': '20px',
      },
      maxWidth: {
        dashboard: '1080px',
        account:   '780px',
      },
      backdropBlur: {
        nav: '12px',
      },
      animation: {
        fadeUp: 'fadeUp 0.4s ease both',
        fadeIn: 'fadeIn 0.6s ease-out',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
