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
        // ── Default (Obsidian) dark surfaces ─────────────────────────────────
        // NativeWind static defaults — runtime theme is applied via useTheme()
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
        // Accent (indigo default — runtime-overridden via useTheme)
        accent: {
          DEFAULT: "#6B77D9",
          hover:   "#7B87E9",
          subtle:  "#1A1D3A",
        },
        // Semantic
        success: "#3DD68C",
        warning: "#F5A623",
        danger:  "#F26464",
        // Modal / sheet backdrop (dark default; runtime wins via useTheme)
        scrim:   "#0000008C",

        // ── Per-theme surface tokens (static fallbacks; runtime wins) ─────────
        nord: {
          "bg-primary":   "#2E3440",
          "bg-secondary": "#3B4252",
          "bg-tertiary":  "#434C5E",
          "bg-border":    "#4C566A",
          accent:         "#88C0D0",
        },
        graphite: {
          "bg-primary":   "#1C1C1E",
          "bg-secondary": "#2C2C2E",
          "bg-tertiary":  "#3A3A3C",
          accent:         "#98989D",
        },
        mocha: {
          "bg-primary":   "#1E1E2E",
          "bg-secondary": "#252537",
          "bg-tertiary":  "#2D2D44",
          accent:         "#CBA6F7",
        },
        midnight: {
          "bg-primary":   "#050810",
          "bg-secondary": "#080C18",
          "bg-tertiary":  "#0C1220",
          accent:         "#3A7AFF",
        },

        // List picker colours
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
        display: ["34px", { lineHeight: "40px", letterSpacing: "-0.5px" }],
        label:   ["12px", { lineHeight: "16px", letterSpacing: "0.8px" }],
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
