/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Dark mode base (Linear-inspired)
        bg: {
          primary:   "#0D0D0D",  // deepest background
          secondary: "#141414",  // card / panel bg
          tertiary:  "#1A1A1A",  // hover / elevated
          border:    "#262626",  // dividers
        },
        // Light mode base
        light: {
          primary:   "#FFFFFF",
          secondary: "#F5F5F5",
          tertiary:  "#EBEBEB",
          border:    "#E0E0E0",
        },
        // Text
        text: {
          primary:   "#F0F0F0",
          secondary: "#9A9A9A",
          tertiary:  "#5A5A5A",
          inverse:   "#0D0D0D",
        },
        // Accents
        accent: {
          DEFAULT: "#5B6AD0",  // indigo — primary action
          hover:   "#6B7AE0",
          subtle:  "#1E2147",  // low-opacity accent bg
        },
        // Semantic
        success: "#3DD68C",
        warning: "#F5A623",
        danger:  "#F26464",
        // List colors (for named lists)
        list: {
          blue:   "#4A90D9",
          purple: "#9B59B6",
          green:  "#27AE60",
          orange: "#E67E22",
          red:    "#E74C3C",
          yellow: "#F1C40F",
          pink:   "#E91E8C",
          teal:   "#1ABC9C",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs:    ["12px", { lineHeight: "16px" }],
        sm:    ["13px", { lineHeight: "18px" }],
        base:  ["15px", { lineHeight: "22px" }],
        lg:    ["17px", { lineHeight: "24px" }],
        xl:    ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "38px" }],
      },
      borderRadius: {
        sm:  "6px",
        md:  "8px",
        lg:  "12px",
        xl:  "16px",
        "2xl": "20px",
      },
      spacing: {
        "0.5": "2px",
        1:     "4px",
        1.5:   "6px",
        2:     "8px",
        3:     "12px",
        4:     "16px",
        5:     "20px",
        6:     "24px",
        8:     "32px",
        10:    "40px",
        12:    "48px",
        16:    "64px",
      },
    },
  },
  plugins: [],
};
