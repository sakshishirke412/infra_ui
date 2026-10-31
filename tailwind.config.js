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
        slate: {
          950: '#020617',
        },
      },
      boxShadow: {
        'glow-teal': '0 0 40px rgba(6, 182, 212, 0.15)',
        'glow-teal-sm': '0 0 20px rgba(6, 182, 212, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}