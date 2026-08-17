/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--bg-app)',
          panel: 'var(--bg-panel)',
          surface: 'var(--bg-surface)',
          card: 'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          input: 'var(--bg-input)',
          hover: 'var(--bg-hover)',
          canvas: 'var(--canvas-bg)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          ghost: 'var(--text-ghost)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
        green: {
          dim: 'var(--green-dim)',
          subtle: 'var(--green-subtle)',
          bg: 'var(--green-bg)',
          txt: 'var(--green-text)',
          border: 'var(--green-border)',
        },
        amber: {
          dim: 'var(--amber-dim)',
          subtle: 'var(--amber-subtle)',
          bg: 'var(--amber-bg)',
          txt: 'var(--amber-text)',
          border: 'var(--amber-border)',
        },
        blue: {
          dim: 'var(--blue-dim)',
          subtle: 'var(--blue-subtle)',
          bg: 'var(--blue-bg)',
          txt: 'var(--blue-text)',
          border: 'var(--blue-border)',
        },
        violet: {
          dim: 'var(--violet-dim)',
          subtle: 'var(--violet-subtle)',
          bg: 'var(--violet-bg)',
          txt: 'var(--violet-text)',
          border: 'var(--violet-border)',
        },
        teal: {
          dim: 'var(--teal-dim)',
          subtle: 'var(--teal-subtle)',
          bg: 'var(--teal-bg)',
          txt: 'var(--teal-text)',
          border: 'var(--teal-border)',
        },
      },
    },
  },
  plugins: [],
}
