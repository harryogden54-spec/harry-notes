/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */
import { Platform } from "react-native";

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
  // Atelier editorial styles
  /** Screen greetings / hero titles — confident, tightly-tracked. */
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  /** Uppercase section labels — small, wide-tracked, textTertiary. */
  label:   { fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
} as const;

export type ColorScheme = "dark" | "light";

// ─── Elevation (Atelier) ──────────────────────────────────────────────────────
// One shadow language for the whole app. Rules:
//   content cards  → hairline bgBorder border + "sm"
//   floating bits  → "md" (FAB, toasts)
//   overlays       → "overlay" (modals, command palette, detail sheets)
// RN-web converts these shadow* props to box-shadow, so one definition serves
// both platforms; elevation covers Android.

export type ShadowLevel = "xs" | "sm" | "md" | "overlay";

const SHADOW_SPECS: Record<ShadowLevel, { dark: number; light: number; radius: number; offsetY: number; elevation: number }> = {
  xs:      { dark: 0.20, light: 0.05, radius: 3,  offsetY: 1,  elevation: 1 },
  sm:      { dark: 0.26, light: 0.08, radius: 8,  offsetY: 2,  elevation: 2 },
  md:      { dark: 0.34, light: 0.12, radius: 16, offsetY: 6,  elevation: 6 },
  overlay: { dark: 0.45, light: 0.20, radius: 32, offsetY: 16, elevation: 16 },
};

function opacityToHexAlpha(o: number): string {
  return Math.round(Math.min(1, Math.max(0, o)) * 255).toString(16).padStart(2, "0");
}

export function getShadow(
  level: ShadowLevel,
  scheme: ColorScheme,
  options?: { color?: string; opacity?: number },
) {
  const s = SHADOW_SPECS[level];
  const color   = options?.color ?? "#000";
  const opacity = options?.opacity ?? (scheme === "dark" ? s.dark : s.light);

  // RN Web warns that shadow*/elevation style props are deprecated in favour
  // of boxShadow — return the CSS form on web, the native form elsewhere.
  if (Platform.OS === "web") {
    return { boxShadow: `0px ${s.offsetY}px ${s.radius}px ${color}${opacityToHexAlpha(opacity)}` };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: s.offsetY },
    shadowOpacity: opacity,
    shadowRadius: s.radius,
    elevation: s.elevation,
  };
}

// ─── Layout constants ─────────────────────────────────────────────────────────
// Previously magic numbers scattered across screens.

export const layout = {
  tabBarHeight: { ios: 88, default: 68 },
  fabBottom:    { ios: 100, default: 76 },
  gutter:       { mobile: 20, desktop: 32 },
  maxWidth:     { narrow: 720, wide: 1200 },
} as const;

// ─── Motion ───────────────────────────────────────────────────────────────────

export const motion = {
  fast: 150,
  base: 200,
  slow: 300,
  /** Standard pressable feedback. */
  pressOpacity: 0.85,
  pressScale: 0.98,
} as const;

// ─── Priority colours ─────────────────────────────────────────────────────────
// Keys into ThemeTokens so priorities follow the active theme/scheme.

export const priorityColorKey = {
  urgent: "danger",
  high:   "warning",
  medium: "accent",
  low:    "textTertiary",
} as const satisfies Record<string, keyof ThemeTokens>;

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

// ─── Per-theme personality kits (Atelier) ─────────────────────────────────────
// Each theme owns its note-pastel palette, background wash, and hero gradient,
// so switching themes changes the app's character — not just its grays.
//   pastels — 6 theme-tinted sticky-note colours (dark: low-luminance with
//             real chroma; light: bright paper), derived from curated hue sets
//   wash    — colour pair for the web radial background wash
//   hero    — accent gradient pair for hero elements (focus ring, progress)

export type NotePaletteSet = {
  bg:     readonly string[];
  border: readonly string[];
  text:   string;
};

export type ThemeKit = {
  pastels: NotePaletteSet;
  wash: readonly [string, string];
  hero: readonly [string, string];
};

/** hsl(h°, s 0–1, l 0–1) → #RRGGBB. Tokens are precomputed once per kit. */
function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function buildPastels(hues: readonly number[], sat: number, scheme: ColorScheme): NotePaletteSet {
  if (scheme === "dark") {
    return {
      bg:     hues.map(h => hslHex(h, 0.34 * sat, 0.16)),
      border: hues.map(h => hslHex(h, 0.36 * sat, 0.26)),
      text:   hslHex(hues[0], 0.16, 0.88),
    };
  }
  return {
    bg:     hues.map(h => hslHex(h, 0.80 * sat, 0.93)),
    border: hues.map(h => hslHex(h, 0.60 * sat, 0.80)),
    text:   hslHex(hues[0], 0.30, 0.14),
  };
}

type KitSpec = {
  /** Six pastel hues (degrees) — the theme's note palette identity. */
  hues: readonly number[];
  /** Saturation multiplier (graphite wants near-monochrome pastels). */
  sat: number;
  wash: { dark: readonly [string, string]; light: readonly [string, string] };
  hero: { dark: readonly [string, string]; light: readonly [string, string] };
};

const KIT_SPECS: Record<ThemeId, KitSpec> = {
  obsidian: { // precise, neutral ink
    hues: [228, 280, 200, 150, 335, 42], sat: 0.85,
    wash: { dark: ["#6B77D9", "#9B59D9"], light: ["#5B6AD0", "#8B6AD9"] },
    hero: { dark: ["#6B77D9", "#A685F7"], light: ["#5B6AD0", "#8854E0"] },
  },
  nord: { // frost & aurora
    hues: [193, 213, 280, 140, 354, 45], sat: 0.8,
    wash: { dark: ["#88C0D0", "#B48EAD"], light: ["#5E81AC", "#88C0D0"] },
    hero: { dark: ["#88C0D0", "#A3BE8C"], light: ["#5E81AC", "#4E9A8C"] },
  },
  graphite: { // near-monochrome studio
    hues: [228, 200, 280, 150, 340, 45], sat: 0.3,
    wash: { dark: ["#98989D", "#6E6E73"], light: ["#8E8E93", "#B0B0B5"] },
    hero: { dark: ["#AEAEB2", "#8E8E93"], light: ["#636366", "#8E8E93"] },
  },
  rose: { // warm blush paper
    hues: [340, 320, 10, 25, 285, 350], sat: 0.9,
    wash: { dark: ["#D4849A", "#B86A9A"], light: ["#C0607A", "#D88AA8"] },
    hero: { dark: ["#D4849A", "#E8A8B8"], light: ["#C0607A", "#A84878"] },
  },
  evergreen: { // botanical
    hues: [140, 95, 170, 60, 200, 28], sat: 0.85,
    wash: { dark: ["#6DBF7E", "#3A9A8A"], light: ["#3A8A4A", "#6ABF8E"] },
    hero: { dark: ["#6DBF7E", "#9ACD6A"], light: ["#3A8A4A", "#2A7A6A"] },
  },
  mocha: { // catppuccin lavenders
    hues: [267, 343, 217, 115, 23, 41], sat: 0.95,
    wash: { dark: ["#CBA6F7", "#F5C2E7"], light: ["#8839EF", "#EA76CB"] },
    hero: { dark: ["#CBA6F7", "#89B4FA"], light: ["#8839EF", "#1E66F5"] },
  },
  midnight: { // deep-water blues
    hues: [222, 245, 205, 265, 190, 280], sat: 0.95,
    wash: { dark: ["#3A7AFF", "#7048E8"], light: ["#1A54FF", "#6A8AFF"] },
    hero: { dark: ["#3A7AFF", "#00C2FF"], light: ["#1A54FF", "#0090E8"] },
  },
  dune: { // desert warmth
    hues: [40, 25, 58, 15, 80, 345], sat: 0.85,
    wash: { dark: ["#C8A86A", "#A87A4A"], light: ["#9A7A40", "#C8A86A"] },
    hero: { dark: ["#C8A86A", "#E8C88A"], light: ["#9A7A40", "#B8924A"] },
  },
  solar: { // dawn-lit lagoon
    hues: [45, 18, 175, 205, 68, 331], sat: 0.85,
    wash: { dark: ["#B58900", "#2AA198"], light: ["#CB4B16", "#B58900"] },
    hero: { dark: ["#B58900", "#CB4B16"], light: ["#CB4B16", "#D33682"] },
  },
  ember: { // hearth glow
    hues: [10, 25, 0, 40, 350, 55], sat: 0.95,
    wash: { dark: ["#E85D4A", "#C2452E"], light: ["#C0392B", "#E87A4A"] },
    hero: { dark: ["#E85D4A", "#F5A623"], light: ["#C0392B", "#E06A30"] },
  },
};

const kitCache = new Map<string, ThemeKit>();

export function getThemeKit(themeId: ThemeId, scheme: ColorScheme): ThemeKit {
  const key = `${themeId}:${scheme}`;
  let kit = kitCache.get(key);
  if (!kit) {
    const spec = KIT_SPECS[themeId] ?? KIT_SPECS.obsidian;
    kit = {
      pastels: buildPastels(spec.hues, spec.sat, scheme),
      wash: spec.wash[scheme],
      hero: spec.hero[scheme],
    };
    kitCache.set(key, kit);
  }
  return kit;
}

export function getNotePastels(scheme: ColorScheme, themeId: ThemeId = "obsidian"): NotePaletteSet {
  return getThemeKit(themeId, scheme).pastels;
}

/** Stable index from any string id — same id always picks the same pastel.
 *  Tolerates a non-string/undefined id (malformed row) rather than throwing. */
export function getNotePastelIndex(id: string): number {
  const s = typeof id === "string" ? id : String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 6;
}

// ─── Category colours ─────────────────────────────────────────────────────────
// Sanctioned fixed palette: identical across themes so categories stay
// recognisable regardless of palette. Not subject to the no-hardcoded-hex rule.

export const categoryColors = {
  personal: "#88C0D0",
  uni:      "#B48EAD",
} as const;

// ─── List default colours ─────────────────────────────────────────────────────
// Sanctioned fixed palette — user-picked list identities, theme-independent.

export const listColors: readonly string[] = [
  "#4A90D9", "#9B59B6", "#27AE60", "#E67E22",
  "#E74C3C", "#E8C84A", "#E91E8C", "#1ABC9C",
];
