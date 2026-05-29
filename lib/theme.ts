/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */

// ─── Theme types ──────────────────────────────────────────────────────────────

export type ThemeId =
  | "obsidian" | "nord" | "graphite" | "rose" | "evergreen"
  | "mocha" | "midnight" | "dune" | "solar" | "ember";

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

// ─── Named themes (10) ────────────────────────────────────────────────────────

export const THEMES: Record<ThemeId, { label: string; dark: ThemeTokens; light: ThemeTokens }> = {
  obsidian: {
    label: "Obsidian",
    dark: {
      bgPrimary: "#0D0D0D", bgSecondary: "#141414", bgTertiary: "#1A1A1A", bgBorder: "#262626",
      textPrimary: "#F0F0F0", textSecondary: "#9A9A9A", textTertiary: "#5A5A5A", textInverse: "#0D0D0D",
      accent: "#6B77D9", accentHover: "#7B87E9", accentSubtle: "#1A1D3A",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#FFFFFF", bgSecondary: "#F5F5F5", bgTertiary: "#EBEBEB", bgBorder: "#E0E0E0",
      textPrimary: "#0D0D0D", textSecondary: "#4A4A4A", textTertiary: "#8A8A8A", textInverse: "#F0F0F0",
      accent: "#5B6AD0", accentHover: "#6B7AE0", accentSubtle: "#ECEFFE",
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
  graphite: {
    label: "Graphite",
    dark: {
      bgPrimary: "#1C1C1E", bgSecondary: "#2C2C2E", bgTertiary: "#3A3A3C", bgBorder: "#48484A",
      textPrimary: "#F2F2F7", textSecondary: "#AEAEB2", textTertiary: "#636366", textInverse: "#1C1C1E",
      accent: "#98989D", accentHover: "#AEAEB2", accentSubtle: "#2C2C2E",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#F2F2F7", bgSecondary: "#E5E5EA", bgTertiary: "#D1D1D6", bgBorder: "#C7C7CC",
      textPrimary: "#1C1C1E", textSecondary: "#3A3A3C", textTertiary: "#6D6D72", textInverse: "#F2F2F7",
      accent: "#636366", accentHover: "#48484A", accentSubtle: "#E5E5EA",
      ...SEMANTIC_LIGHT,
    },
  },
  rose: {
    label: "Rosé",
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
  evergreen: {
    label: "Evergreen",
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
  mocha: {
    label: "Mocha",
    dark: {
      bgPrimary: "#1E1E2E", bgSecondary: "#252537", bgTertiary: "#2D2D44", bgBorder: "#3A3A55",
      textPrimary: "#CDD6F4", textSecondary: "#A6ADC8", textTertiary: "#6C7086", textInverse: "#1E1E2E",
      accent: "#CBA6F7", accentHover: "#DBB6FF", accentSubtle: "#2C1F3D",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#EFF1F5", bgSecondary: "#E6E9EF", bgTertiary: "#DCE0E8", bgBorder: "#BCC0CC",
      textPrimary: "#4C4F69", textSecondary: "#6C6F85", textTertiary: "#8C8FA1", textInverse: "#EFF1F5",
      accent: "#8839EF", accentHover: "#9849FF", accentSubtle: "#F0E5FA",
      ...SEMANTIC_LIGHT,
    },
  },
  midnight: {
    label: "Midnight",
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
  dune: {
    label: "Dune",
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
  solar: {
    label: "Solar",
    dark: {
      bgPrimary: "#002B36", bgSecondary: "#073642", bgTertiary: "#0E4654", bgBorder: "#205060",
      textPrimary: "#FDF6E3", textSecondary: "#93A1A1", textTertiary: "#586E75", textInverse: "#002B36",
      accent: "#B58900", accentHover: "#C59910", accentSubtle: "#1A2418",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#FDF6E3", bgSecondary: "#EEE8D5", bgTertiary: "#E5DBC2", bgBorder: "#C8BFA0",
      textPrimary: "#002B36", textSecondary: "#586E75", textTertiary: "#93A1A1", textInverse: "#FDF6E3",
      accent: "#CB4B16", accentHover: "#DB5B26", accentSubtle: "#F5DCC8",
      ...SEMANTIC_LIGHT,
    },
  },
  ember: {
    label: "Ember",
    dark: {
      bgPrimary: "#1A1210", bgSecondary: "#221816", bgTertiary: "#2C1E1C", bgBorder: "#3C2A28",
      textPrimary: "#F5EDE8", textSecondary: "#C4947A", textTertiary: "#7A5040", textInverse: "#1A1210",
      accent: "#E85D4A", accentHover: "#F06D5A", accentSubtle: "#301A18",
      ...SEMANTIC_DARK,
    },
    light: {
      bgPrimary: "#FDF4F2", bgSecondary: "#F5E8E5", bgTertiary: "#EDD8D4", bgBorder: "#DFC8C2",
      textPrimary: "#2A1510", textSecondary: "#6B3020", textTertiary: "#9A6050", textInverse: "#FDF4F2",
      accent: "#C0392B", accentHover: "#D04030", accentSubtle: "#FAE8E5",
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
  { id: "indigo",  label: "Indigo",  color: "#6B77D9", hover: "#7B87E9", subtle: "#1A1D3A", lightSubtle: "#ECEFFE" },
  { id: "sky",     label: "Sky",     color: "#88C0D0", hover: "#9DCFDF", subtle: "#17323A", lightSubtle: "#DFF0F5" },
  { id: "ocean",   label: "Ocean",   color: "#5E81AC", hover: "#6E91BC", subtle: "#1A2737", lightSubtle: "#DDE5F0" },
  { id: "moss",    label: "Moss",    color: "#A3BE8C", hover: "#B3CE9C", subtle: "#1E2B1A", lightSubtle: "#E8F0E2" },
  { id: "orchid",  label: "Orchid",  color: "#B48EAD", hover: "#C49EBD", subtle: "#271C27", lightSubtle: "#EDE3EC" },
  { id: "amber",   label: "Amber",   color: "#D08770", hover: "#E09780", subtle: "#301A12", lightSubtle: "#F5E5DF" },
] as const;

export type AccentId = typeof ACCENT_OPTIONS[number]["id"];

// ─── Font families ────────────────────────────────────────────────────────────

export const fontFamily = {
  regular:  "Inter_400Regular",
  medium:   "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold:     "Inter_700Bold",
} as const;

// ─── Note pastels (sticky-note backgrounds) ───────────────────────────────────
// Theme-aware: dark mode uses low-luminance tinted surfaces so notes read
// correctly on dark backgrounds; light mode keeps the classic bright paper feel.

type NotePaletteSet = {
  bg:     readonly string[];
  border: readonly string[];
  text:   string;
};

const PASTELS_LIGHT: NotePaletteSet = {
  bg:     ["#FFF9C4", "#FCE4EC", "#E8F5E9", "#E3F2FD", "#EDE7F6", "#FBE9E7"],
  border: ["#F0E68C", "#F8BBD9", "#C8E6C9", "#BBDEFB", "#D1C4E9", "#FFCCBC"],
  text:   "#1A1A2E",
};

const PASTELS_DARK: NotePaletteSet = {
  bg:     ["#2A2418", "#2A1A20", "#1A2A1A", "#1A2030", "#22182A", "#2A2018"],
  border: ["#3A3020", "#3A2030", "#253525", "#253040", "#302038", "#3A3028"],
  text:   "#E8E0D4",
};

export function getNotePastels(scheme: ColorScheme): NotePaletteSet {
  return scheme === "dark" ? PASTELS_DARK : PASTELS_LIGHT;
}

/** Stable index from any string id — same id always picks the same pastel.
 *  Tolerates a non-string/undefined id (malformed row) rather than throwing. */
export function getNotePastelIndex(id: string): number {
  const s = typeof id === "string" ? id : String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % PASTELS_LIGHT.bg.length;
}

// ─── Category colours ─────────────────────────────────────────────────────────
// Fixed across themes so they're recognisable regardless of palette.

export const categoryColors = {
  personal: "#88C0D0",
  uni:      "#B48EAD",
} as const;

// ─── List default colours ─────────────────────────────────────────────────────

export const listColors: readonly string[] = [
  "#4A90D9", "#9B59B6", "#27AE60", "#E67E22",
  "#E74C3C", "#E8C84A", "#E91E8C", "#1ABC9C",
];

// ─── Legacy exports (kept so old imports don't break during migration) ─────────
// TODO: remove notePastels after all consumers are updated to getNotePastels()
export const notePastels = PASTELS_LIGHT;
