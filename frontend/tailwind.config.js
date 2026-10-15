/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: 'var(--canvas)',
        ink: { DEFAULT: 'var(--text)', 2: 'var(--text-2)', 3: 'var(--text-3)', 4: 'var(--text-4)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        t: {
          resume: 'var(--t-resume)', job: 'var(--t-job)', skills: 'var(--t-skills)',
          score: 'var(--t-score)', audio: 'var(--t-audio)', doc: 'var(--t-doc)',
        },
        mint: 'var(--mint)',
      },
      borderRadius: { node: 'var(--r-node)', panel: 'var(--r-panel)', inset: 'var(--r-inset)' },
      fontSize: { '2xs': ['10.5px', '14px'], xs: ['11.5px', '16px'], sm: ['12.5px', '18px'], base: ['13.5px', '20px'] },
      letterSpacing: { label: '0.08em' },
    },
  },
  plugins: [],
}
