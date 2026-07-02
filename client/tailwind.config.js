/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        body: ['"Albert Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#F5EFE2',
        surface: '#FDFAF2',
        line: '#E4D9C0',
        'line-strong': '#CFC0A0',
        ink: '#2C2519',
        'ink-dim': '#6B5F4B',
        moss: '#6A7D63',
        'moss-dim': '#8C9480',
        terracotta: '#C2562F',
        'terracotta-bright': '#A8431F',
        'terracotta-deep': '#8F3517',
        gold: '#A87A1F',
        'gold-soft': '#8F6A1D',
      },
      boxShadow: {
        card: '0 1px 2px rgba(44,37,25,0.06), 0 2px 8px rgba(44,37,25,0.06)',
        'card-hover': '0 4px 14px rgba(44,37,25,0.12), 0 2px 4px rgba(44,37,25,0.08)',
        panel: '-8px 0 40px rgba(44,37,25,0.12)',
        glow: '0 0 0 1px rgba(194,86,47,0.35), 0 4px 18px rgba(194,86,47,0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.45s ease-out both',
        'rise-1': 'rise 0.5s cubic-bezier(0.22,1,0.36,1) 0.05s both',
        'rise-2': 'rise 0.5s cubic-bezier(0.22,1,0.36,1) 0.14s both',
        'rise-3': 'rise 0.5s cubic-bezier(0.22,1,0.36,1) 0.23s both',
        'rise-4': 'rise 0.5s cubic-bezier(0.22,1,0.36,1) 0.32s both',
        'rise-5': 'rise 0.5s cubic-bezier(0.22,1,0.36,1) 0.41s both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'compass-spin': 'compassSpin 14s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        compassSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      letterSpacing: {
        caps: '0.14em',
      },
    },
  },
  plugins: [],
};
