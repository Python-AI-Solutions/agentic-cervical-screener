/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/tw-elements/dist/js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        // Medical/dark theme colors
        'medical-dark': {
          primary: '#0f172a',
          secondary: '#111827',
          sidebar: '#1f2937',
          button: '#374151',
          'button-hover': '#4b5563',
          'button-active': '#1f2937',
          border: '#374151',
        },
        'medical-text': {
          primary: '#ffffff',
          secondary: '#9ca3af',
          muted: '#6b7280',
        },
      },
      spacing: {
        'header-height': '56px',
        'sidebar-width': '280px',
        'sidebar-width-mobile': '100vw',
        'button-height': '44px',
      },
      borderRadius: {
        'medical': '8px',
      },
      boxShadow: {
        'medical': '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [
    require('tw-elements/plugin.cjs'),
  ],
  darkMode: 'class',
}

