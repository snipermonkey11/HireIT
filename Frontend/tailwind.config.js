// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          600: '#800000', // Maroon color for header, etc.
        },
        gold: {
          500: '#FFD700', // Gold color for buttons and accents
        },
      },
    },
  },
  plugins: [],
};
