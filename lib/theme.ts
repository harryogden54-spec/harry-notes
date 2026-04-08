/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */

export const colors = {
  // Backgrounds
  bgPrimary:   "#0D0D0D",
  bgSecondary: "#141414",
  bgTertiary:  "#1A1A1A",
  bgBorder:    "#262626",

  // Light mode
  lightPrimary:   "#FFFFFF",
  lightSecondary: "#F5F5F5",
  lightTertiary:  "#EBEBEB",
  lightBorder:    "#E0E0E0",

  // Text
  textPrimary:   "#F0F0F0",
  textSecondary: "#9A9A9A",
  textTertiary:  "#5A5A5A",
  textInverse:   "#0D0D0D",

  // Accent (default — overridden at runtime via useTheme)
  accent:       "#88C0D0",
  accentHover:  "#9DCFDF",
  accentSubtle: "#17323A",

  // Semantic
  success: "#3DD68C",
  warning: "#F5A623",
  danger:  "#F26464",

  // List palette
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
} as const;

export const lightColors = {
  bgPrimary:   colors.lightPrimary,
  bgSecondary: colors.lightSecondary,
  bgTertiary:  colors.lightTertiary,
  bgBorder:    colors.lightBorder,
  textPrimary:   "#0D0D0D",
  textSecondary: "#4A4A4A",
  textTertiary:  "#8A8A8A",
  textInverse:   "#F0F0F0",
  accent:       colors.accent,
  accentHover:  colors.accentHover,
  accentSubtle: "#DFF0F5",
  success: "#1E8A5A",
  warning: "#B86E00",
  danger:  "#C0392B",
} as const;

export const spacing = {
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  8:   32,
  10:  40,
  12:  48,
  16:  64,
} as const;

export const radius = {
  sm:  6,
  md:  8,
  lg:  12,
  xl:  16,
  "2xl": 20,
} as const;

export const typography = {
  "2xs": { fontSize: 10, lineHeight: 14 },
  xs:    { fontSize: 12, lineHeight: 16 },
  sm:    { fontSize: 13, lineHeight: 18 },
  base:  { fontSize: 15, lineHeight: 22 },
  lg:    { fontSize: 17, lineHeight: 24 },
  xl:    { fontSize: 20, lineHeight: 28 },
  "2xl": { fontSize: 24, lineHeight: 32 },
  "3xl": { fontSize: 30, lineHeight: 38 },
} as const;

export type ColorScheme = "dark" | "light";

// ─── Nord accent options ──────────────────────────────────────────────────────

export const ACCENT_OPTIONS = [
  { id: "frost",  label: "Frost",          color: "#88C0D0", hover: "#9DCFDF", subtle: "#17323A", lightSubtle: "#DFF0F5" },
  { id: "deep",   label: "Deep Blue",      color: "#5E81AC", hover: "#6E91BC", subtle: "#1A2737", lightSubtle: "#DDE5F0" },
  { id: "green",  label: "Aurora Green",   color: "#A3BE8C", hover: "#B3CE9C", subtle: "#1E2B1A", lightSubtle: "#E8F0E2" },
  { id: "purple", label: "Aurora Purple",  color: "#B48EAD", hover: "#C49EBD", subtle: "#271C27", lightSubtle: "#EDE3EC" },
  { id: "orange", label: "Aurora Orange",  color: "#D08770", hover: "#E09780", subtle: "#301A12", lightSubtle: "#F5E5DF" },
] as const;

export type AccentId = typeof ACCENT_OPTIONS[number]["id"];

export function getColors(scheme: ColorScheme) {
  return scheme === "dark" ? colors : { ...colors, ...lightColors };
}
