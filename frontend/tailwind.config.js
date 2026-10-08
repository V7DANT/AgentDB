/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral, desaturated base palette. Slate-ish with a cool bias.
        base: {
          950: '#070809',
          925: '#0a0c0f',
          900: '#0d1014',
          850: '#11151a',
          800: '#151a21',
          750: '#1a2029',
          700: '#20272f',
          600: '#2b333d',
          500: '#3a434f',
          400: '#4d5763',
          300: '#6b7686',
          200: '#98a2b3',
          100: '#c8ced8',
          50: '#e7eaf0',
        },
        // Restrained primary accent.
        accent: {
          50: '#eef3ff',
          100: '#dbe6ff',
          200: '#bed1ff',
          300: '#93b0ff',
          400: '#6688ff',
          500: '#4f7cff',
          600: '#3a5ce8',
          700: '#2f48bd',
          800: '#2a3d96',
          900: '#273675',
        },
        // Semantic status colors.
        status: {
          ok: '#3fb950',
          'ok-dim': '#1f6f2c',
          warn: '#d29922',
          'warn-dim': '#7a5a10',
          danger: '#f85149',
          'danger-dim': '#8b2c27',
          info: '#58a6ff',
          'info-dim': '#1f4d87',
          neutral: '#8b949e',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        // Tighter radii to avoid the "generic admin template" look.
        DEFAULT: '0.375rem',
        md: '0.4375rem',
        lg: '0.5rem',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px 0 rgba(0,0,0,0.4)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(2px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
      },
    },
  },
  plugins: [],
};
