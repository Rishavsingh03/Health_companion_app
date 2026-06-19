/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15202B",
        mint: "#DDF8EE",
        teal: "#0F766E",
        coral: "#EF6F61",
        paper: "#F8FAF7"
      }
    }
  },
  plugins: []
};

