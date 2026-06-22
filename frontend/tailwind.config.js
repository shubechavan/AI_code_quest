/**
 * Design system.
 *
 * A semantic-token theme: components reference role-based colors (`surface`, `line`,
 * `fg`, `muted`) rather than raw palette values, and the actual colors are supplied by
 * CSS variables in index.css. This gives a single source of truth and a one-class theme
 * switch (dark is the default; `.light` on <html> flips it). The palette targets a calm,
 * high-contrast fintech console in the spirit of Linear / Datadog / Vercel.
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Role-based surfaces and text (driven by CSS variables).
        base: 'rgb(var(--base) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        // Brand accent — used sparingly for primary actions and active nav.
        accent: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        // Risk semantics. Composed with low-opacity fills in lib/risk.js so they read on
        // both dark and light surfaces.
        risk: {
          critical: '#f43f5e',
          high: '#fb923c',
          medium: '#facc15',
          low: '#34d399',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.20), 0 1px 3px 0 rgb(0 0 0 / 0.16)',
        elevated: '0 8px 24px -8px rgb(0 0 0 / 0.45)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
