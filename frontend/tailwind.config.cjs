/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.12)",
        soft2: "0 4px 18px rgba(0,0,0,.10)"
      }
    }
  },
  plugins: []
};
