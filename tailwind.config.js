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
        // ── Default (Linear-inspired) dark surfaces ──────────────────────────
        bg: {
          primary:   "#0D0D0D",
          secondary: "#141414",
          tertiary:  "#1A1A1A",
          border:    "#262626",
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
        // Accent (frost default — runtime-overridden via useTheme)
        accent: {
          DEFAULT: "#88C0D0",
          hover:   "#9DCFDF",
          subtle:  "#17323A",
        },
        // Semantic
        success: "#3DD68C",
        warning: "#F5A623",
        danger:  "#F26464",

        // ── Nord theme surfaces ───────────────────────────────────────────────
        nord: {
          "bg-primary":   "#2E3440",
          "bg-secondary": "#3B4252",
          "bg-tertiary":  "#434C5E",
          "bg-border":    "#4C566A",
          accent:         "#88C0D0",
        },
        // ── Warm Earth theme surfaces ─────────────────────────────────────────
        earth: {
          "bg-primary":   "#1C2B1E",
          "bg-secondary": "#1A2235",
          "bg-tertiary":  "#2D1B1B",
          accent:         "#D2B48C",
        },
        // ── Slate theme surfaces ──────────────────────────────────────────────
        slate: {
          "bg-primary":   "#1E2329",
          "bg-secondary": "#252D36",
          "bg-tertiary":  "#2D3748",
          accent:         "#4A90D9",
        },

        // List colors
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
        sm:    "6px",
        md:    "8px",
        lg:    "12px",
        xl:    "16px",
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
        24:    "96px",
      },
    },
  },
  plugins: [],
};
