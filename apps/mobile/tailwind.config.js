/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        heading: ['SpaceGrotesk_700Bold'],
        sans: ['Rajdhani_400Regular'],
        medium: ['Rajdhani_500Medium'],
        semibold: ['Rajdhani_600SemiBold'],
        bold: ['Rajdhani_700Bold'],
      },
    },
  },
  plugins: [],
}
