/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */

// ─── Theme types ──────────────────────────────────────────────────────────────

export type ThemeId = "default" | "nord" | "warmEarth" | "slate" | "rose" | "forest" | "dusk" | "steel" | "sand" | "midnight";

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

export type ThemeBackground = {
  type: "solid" | "gradient" | "noise" | "geometric";
  value: string;
};

export const THEMES: Record<ThemeId, { label: string; dark: ThemeTokens; light: ThemeTokens; background?: ThemeBackground }> = {
  default: {
    label: "Linear",
    background: { type: "gradient", value: "linear" },
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
    background: { type: "gradient", value: "nord" },
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
    background: { type: "gradient", value: "warmEarth" },
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
    background: { type: "solid", value: "slate" },
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
  rose: {
    label: "Rosé",
    background: { type: "noise", value: "rose" },
    dark: {
      bgPrimary: "#1E1518", bgSecondary: "#251B1F", bgTertiary: "#2E2228", bgBorder: "#3D2D34",
      textPrimary: "#F2E8EC", textSecondary: "#C4A0B0", textTertiary: "#7A5A68", textInverse: "#1E1518",
      accent: "#D4849A", accentHover: "#E494AA", accentSubtle: "#2E1A22",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#FDF4F6", bgSecondary: "#F5E8ED", bgTertiary: "#EDD8E0", bgBorder: "#DFC8D2",
      textPrimary: "#2A1520", textSecondary: "#6B3A4A", textTertiary: "#9A7080", textInverse: "#FDF4F6",
      accent: "#C0607A", accentHover: "#D0708A", accentSubtle: "#FAE8ED",
      ...SEMANTIC_LIGHT,
    },
  },
  forest: {
    label: "Forest",
    background: { type: "geometric", value: "hexagons" },
    dark: {
      bgPrimary: "#0D1810", bgSecondary: "#142018", bgTertiary: "#1A2A1E", bgBorder: "#253A2A",
      textPrimary: "#E4EFE6", textSecondary: "#8DB898", textTertiary: "#4A7A54", textInverse: "#0D1810",
      accent: "#6DBF7E", accentHover: "#7DCF8E", accentSubtle: "#1A3020",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F2F8F3", bgSecondary: "#E4F0E6", bgTertiary: "#D4E8D8", bgBorder: "#BDD8C4",
      textPrimary: "#0D2A14", textSecondary: "#2A5A34", textTertiary: "#5A8A64", textInverse: "#F2F8F3",
      accent: "#3A8A4A", accentHover: "#4A9A5A", accentSubtle: "#DFF0E2",
      ...SEMANTIC_LIGHT,
    },
  },
  dusk: {
    label: "Dusk",
    background: { type: "gradient", value: "dusk" },
    dark: {
      bgPrimary: "#100B1E", bgSecondary: "#180F2A", bgTertiary: "#221636", bgBorder: "#342050",
      textPrimary: "#EDE8F8", textSecondary: "#B8A8E0", textTertiary: "#6A5A90", textInverse: "#100B1E",
      accent: "#C8A870", accentHover: "#D8B880", accentSubtle: "#2C1E10",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F8F5FF", bgSecondary: "#EEE8FA", bgTertiary: "#E4D8F5", bgBorder: "#CCC0E8",
      textPrimary: "#1A1030", textSecondary: "#4A3870", textTertiary: "#8070A8", textInverse: "#F8F5FF",
      accent: "#9B78D4", accentHover: "#AB88E4", accentSubtle: "#EDE5FA",
      ...SEMANTIC_LIGHT,
    },
  },
  steel: {
    label: "Steel",
    background: { type: "solid", value: "steel" },
    dark: {
      bgPrimary: "#141A22", bgSecondary: "#1C2430", bgTertiary: "#242E3C", bgBorder: "#303C4E",
      textPrimary: "#D8E4F0", textSecondary: "#8899B0", textTertiary: "#4A5A6E", textInverse: "#141A22",
      accent: "#7A9AB8", accentHover: "#8AAAC8", accentSubtle: "#1A2A3A",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F2F5F8", bgSecondary: "#E8EDF4", bgTertiary: "#DCE4EE", bgBorder: "#C8D4E0",
      textPrimary: "#1A2A3A", textSecondary: "#3A5070", textTertiary: "#6A80A0", textInverse: "#F2F5F8",
      accent: "#4A6E8A", accentHover: "#5A7E9A", accentSubtle: "#E0EAF4",
      ...SEMANTIC_LIGHT,
    },
  },
  sand: {
    label: "Sand",
    background: { type: "noise", value: "sand" },
    dark: {
      bgPrimary: "#1C1810", bgSecondary: "#242016", bgTertiary: "#2C281C", bgBorder: "#3C3428",
      textPrimary: "#F0EAD8", textSecondary: "#C8B890", textTertiary: "#7A6848", textInverse: "#1C1810",
      accent: "#C8A86A", accentHover: "#D8B87A", accentSubtle: "#2C2010",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#FAF6EE", bgSecondary: "#F2ECD8", bgTertiary: "#EAE2C8", bgBorder: "#D8CEB0",
      textPrimary: "#2A2010", textSecondary: "#5A4A28", textTertiary: "#8A7A58", textInverse: "#FAF6EE",
      accent: "#9A7A40", accentHover: "#AA8A50", accentSubtle: "#F5EDD8",
      ...SEMANTIC_LIGHT,
    },
  },
  midnight: {
    label: "Midnight",
    background: { type: "geometric", value: "grid" },
    dark: {
      bgPrimary: "#050810", bgSecondary: "#080C18", bgTertiary: "#0C1220", bgBorder: "#141C30",
      textPrimary: "#E8F0FF", textSecondary: "#6080B8", textTertiary: "#2A3A5A", textInverse: "#050810",
      accent: "#3A7AFF", accentHover: "#4A8AFF", accentSubtle: "#0A1428",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F0F4FF", bgSecondary: "#E4ECFF", bgTertiary: "#D4E0FF", bgBorder: "#B8CCFF",
      textPrimary: "#080C28", textSecondary: "#1A2A60", textTertiary: "#4A60A0", textInverse: "#F0F4FF",
      accent: "#1A54FF", accentHover: "#2A64FF", accentSubtle: "#E0E8FF",
      ...SEMANTIC_LIGHT,
    },
  },
};

export const spacing = {
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
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

// ─── Accent options (override accent within any theme) ────────────────────────

export const ACCENT_OPTIONS = [
  { id: "frost",  label: "Frost",          color: "#88C0D0", hover: "#9DCFDF", subtle: "#17323A", lightSubtle: "#DFF0F5" },
  { id: "deep",   label: "Deep Blue",      color: "#5E81AC", hover: "#6E91BC", subtle: "#1A2737", lightSubtle: "#DDE5F0" },
  { id: "green",  label: "Aurora Green",   color: "#A3BE8C", hover: "#B3CE9C", subtle: "#1E2B1A", lightSubtle: "#E8F0E2" },
  { id: "purple", label: "Aurora Purple",  color: "#B48EAD", hover: "#C49EBD", subtle: "#271C27", lightSubtle: "#EDE3EC" },
  { id: "orange", label: "Aurora Orange",  color: "#D08770", hover: "#E09780", subtle: "#301A12", lightSubtle: "#F5E5DF" },
] as const;

export type AccentId = typeof ACCENT_OPTIONS[number]["id"];

// ─── Font families ────────────────────────────────────────────────────────────

export const fontFamily = {
  regular:  "Inter_400Regular",
  medium:   "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold:     "Inter_700Bold",
} as const;
