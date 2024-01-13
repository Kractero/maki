/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./views/*.ejs", "app.js"],
  theme: {
    fontFamily: {
      'main': ['Inter', 'ui-sans-serif']
    },
    extend: {},
  },
  plugins: [],
}

