/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0f0f0f',
          surface: '#1a1a1a',
          surface2: '#252525',
          text: '#e5e5e5',
          text2: '#a0a0a0',
          accent: '#e50914',
        }
      }
    },
  },
  plugins: [],
}

