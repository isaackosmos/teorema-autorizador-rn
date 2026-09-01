/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Tokens semânticos. Sempre use estes nomes nas telas —
        // nunca `bg-blue-500` cru. Valores vêm de src/styles/global.css.
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
        // Estados de decisão do domínio (liberação / borderô / compra)
        aprovado: 'rgb(var(--color-aprovado) / <alpha-value>)',
        recusado: 'rgb(var(--color-recusado) / <alpha-value>)',
        pendente: 'rgb(var(--color-pendente) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
