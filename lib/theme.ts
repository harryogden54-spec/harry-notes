/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */

// ─── Theme types ──────────────────────────────────────────────────────────────

export type ThemeId = "default" | "nord" | "warmEarth" | "slate";

export type ThemeTokens = {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgBorder: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  success: string;
  warning: string;
  danger: string;
};

const SEMANTIC_DARK  = { success: "#3DD68C", warning: "#F5A623", danger: "#F26464" } as const;
const SEMANTIC_LIGHT = { success: "#1E8A5A", warning: "#B86E00", danger: "#C0392B" } as const;

// ─── Named themes ──────────────────────────────────────────────────────────────

export const THEMES: Record<ThemeId, { label: string; dark: ThemeTokens; light: ThemeTokens }> = {
  default: {
    label: "Linear",
    dark: {
      bgPrimary: "#0D0D0D", bgSecondary: "#141414", bgTertiary: "#1A1A1A", bgBorder: "#262626",
      textPrimary: "#F0F0F0", textSecondary: "#9A9A9A", textTertiary: "#5A5A5A", textInverse: "#0D0D0D",
      accent: "#88C0D0", accentHover: "#9DCFDF", accentSubtle: "#17323A",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#FFFFFF", bgSecondary: "#F5F5F5", bgTertiary: "#EBEBEB", bgBorder: "#E0E0E0",
      textPrimary: "#0D0D0D", textSecondary: "#4A4A4A", textTertiary: "#8A8A8A", textInverse: "#F0F0F0",
      accent: "#88C0D0", accentHover: "#9DCFDF", accentSubtle: "#DFF0F5",
      ...SEMANTIC_LIGHT,
    },
  },
  nord: {
    label: "Nord",
    dark: {
      bgPrimary: "#2E3440", bgSecondary: "#3B4252", bgTertiary: "#434C5E", bgBorder: "#4C566A",
      textPrimary: "#ECEFF4", textSecondary: "#D8DEE9", textTertiary: "#81A1C1", textInverse: "#2E3440",
      accent: "#88C0D0", accentHover: "#9DCFDF", accentSubtle: "#1C3040",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#ECEFF4", bgSecondary: "#E5E9F0", bgTertiary: "#D8DEE9", bgBorder: "#C4CDD8",
      textPrimary: "#2E3440", textSecondary: "#4C566A", textTertiary: "#7A8898", textInverse: "#ECEFF4",
      accent: "#5E81AC", accentHover: "#6E91BC", accentSubtle: "#DDE5F0",
      ...SEMANTIC_LIGHT,
    },
  },
  warmEarth: {
    label: "Warm Earth",
    dark: {
      bgPrimary: "#1C2B1E", bgSecondary: "#231A0F", bgTertiary: "#2D1B1B", bgBorder: "#3A2C2C",
      textPrimary: "#F0EAE0", textSecondary: "#C4A882", textTertiary: "#7A6050", textInverse: "#1C2B1E",
      accent: "#D2B48C", accentHover: "#E2C49C", accentSubtle: "#2C1C10",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F5F0E8", bgSecondary: "#EDE4D6", bgTertiary: "#E8E0D4", bgBorder: "#D4C8B8",
      textPrimary: "#2A1C14", textSecondary: "#5A3E2A", textTertiary: "#8A6050", textInverse: "#F5F0E8",
      accent: "#BF616A", accentHover: "#CF717A", accentSubtle: "#F5E5E0",
      ...SEMANTIC_LIGHT,
    },
  },
  slate: {
    label: "Slate",
    dark: {
      bgPrimary: "#1E2329", bgSecondary: "#252D36", bgTertiary: "#2D3748", bgBorder: "#3A4A5A",
      textPrimary: "#E8EDF2", textSecondary: "#9AAAB8", textTertiary: "#5A6A7A", textInverse: "#1E2329",
      accent: "#4A90D9", accentHover: "#5A9FE9", accentSubtle: "#1A2C42",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F7F9FC", bgSecondary: "#EDF2F7", bgTertiary: "#E2E8F0", bgBorder: "#CBD5E0",
      textPrimary: "#1A202C", textSecondary: "#4A5568", textTertiary: "#718096", textInverse: "#F7F9FC",
      accent: "#4A90D9", accentHover: "#5A9FE9", accentSubtle: "#EBF4FF",
      ...SEMANTIC_LIGHT,
    },
  },
};

// ─── Backward-compat raw color maps (used in tailwind.config.js sync) ────────

export const colors = {
  // Backgrounds (default/Linear dark)
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

  // Accent (default frost — overridden at runtime via useTheme)
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
  24:  96,
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

// ─── Nord accent options (override accent within default/nord themes) ──────────

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
