import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'rgb(var(--brand) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: '#102A30',
        sand: { 50: '#F4F8F8', 100: '#E9F1F2', 200: '#DAE6E8', 300: '#BED0D3' },
        stone: { 450: '#64797E' },
      },
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'], display: ['"Noto Kufi Arabic"', '"IBM Plex Sans Arabic"', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px', arch: '999px 999px 24px 24px' },
      boxShadow: {
        card: '0 1px 2px rgba(16,42,48,.04), 0 6px 20px -10px rgba(16,42,48,.12)',
        lift: '0 16px 40px -16px rgba(16,42,48,.32)',
      },
    },
  },
  plugins: [],
} satisfies Config;
