/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './index.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        'sans-extrabold': ['Inter_800ExtraBold'],
        display: ['SpaceGrotesk_700Bold'],
      },
      colors: {
        primary: '#7B61FF',
        'primary-dark': '#5B3FDB',
        background: '#07080F',
        surface: '#0D0E1C',
        border: '#1C1F3C',
        'text-primary': '#EDEEFF',
        'text-secondary': '#8B8FB5',
        'text-muted': '#40435E',
        success: '#34D399',
        warning: '#FBBF24',
        error: '#F87171',
        info: '#38BDF8',
      },
    },
  },
  plugins: [],
}
