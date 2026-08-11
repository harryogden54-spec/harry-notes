/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */
import { Platform } from "react-native";

// ─── Theme types ──────────────────────────────────────────────────────────────

export type ThemeId =
  | "obsidian" | "nord" | "graphite" | "evergreen" | "solar" | "ember";

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
  /** Modal / sheet backdrop. One opacity for the whole app — call sites used to
   *  hardcode #00000055, rgba(0,0,0,0.5), 0.55 and 0.6 interchangeably. */
  scrim: string;
};

const SEMANTIC_DARK  = { success: "#3DD68C", warning: "#F5A623", danger: "#F26464", scrim: "#0000008C" } as const;
const SEMANTIC_LIGHT = { success: "#1E8A5A", warning: "#B86E00", danger: "#C0392B", scrim: "#00000073" } as const;

// ─── Named themes (6) ─────────────────────────────────────────────────────────

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

/**
 * Shared geometry for the small repeated shapes, so two components sitting side
 * by side actually match. Every one of these existed already — as
 * `paddingHorizontal: 5 | 6 | 7 | 8 | 9` and `paddingVertical: 1 | 2 | 3`
 * scattered across a dozen files, which is why a due pill and a category badge
 * on the same row never quite aligned.
 *
 * Sizes sit on the 8px rhythm (or its halves) rather than on whatever looked
 * right in one component at one moment.
 */
export const shape = {
  /** Metadata pills: due date, priority, category badge. */
  pill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  /** The small numeric counter beside a section label. */
  countPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  /** Padding inside a content card (TaskCard, NoteCard, NoteIndexRow). */
  card:      { paddingHorizontal: 16, paddingVertical: 16 },
} as const;

/**
 * Type scale.
 *
 * Two families of name, and the distinction matters:
 *
 *   t-shirt sizes (2xs…3xl) — raw steps. Reach for these only when no role
 *     below describes what you are setting.
 *   ROLE tokens (meta/label/cardTitle/title/display) — what the text *is*.
 *     Prefer these: they are the reason two screens agree without anyone
 *     comparing them, and they are where a future retune lands in one edit.
 *
 * The steps up to `base` carry dense UI (rows, chips, metadata) and are
 * deliberately close together. Everything above `base` was widened on
 * 2026-07-27: headings used to sit 2px apart from each other and 2–5px above
 * body, so a screen read as one flat texture. The gap between body (15) and a
 * page title (30) is now a real ratio rather than a hint.
 */
export const typography = {
  "2xs": { fontSize: 10, lineHeight: 14 },
  xs:    { fontSize: 12, lineHeight: 16 },
  sm:    { fontSize: 13, lineHeight: 18 },
  base:  { fontSize: 15, lineHeight: 23 },
  lg:    { fontSize: 18, lineHeight: 26 },
  xl:    { fontSize: 22, lineHeight: 30 },
  "2xl": { fontSize: 26, lineHeight: 34, letterSpacing: -0.2 },
  "3xl": { fontSize: 32, lineHeight: 40, letterSpacing: -0.4 },

  // ── Role tokens ────────────────────────────────────────────────────────────
  /** Screen greetings / hero titles — confident, tightly-tracked. */
  display: { fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  /** Page titles (Tasks/Notes headers). */
  title:   { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  /**
   * The heading on a card or list item — a note's name, a task's title.
   * Sits a step above body so a grid of cards has a scannable top line;
   * call sites used to spell this as a bare `size="sm"` with a weight.
   */
  cardTitle: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  /**
   * Uppercase section labels ("ALL NOTES", "UNCATEGORIZED"). Pair with
   * weight="semibold" and textTransform: "uppercase" — the tracking here
   * assumes caps. Was 12/0.8, which no call site used: every one of them
   * overrode it to 11/1.2, so the token now says what the app actually does.
   */
  label:   { fontSize: 11, lineHeight: 15, letterSpacing: 1.2 },
  /**
   * Supporting metadata: timestamps, counts, due pills, chip text. The single
   * caption size — this was previously written as 11, 11.5 and 12 in different
   * files, which is why meta text never quite lined up between two components.
   */
  meta:    { fontSize: 11.5, lineHeight: 16 },
} as const;

/**
 * Body text inside a TextInput. RN does not inherit type, so every input sets
 * its own size and they had drifted to 13/14/15/16 across the app. Titles and
 * other deliberately-large inputs opt out; everything at body level uses this.
 */
export const inputText = { fontSize: 15, lineHeight: 21 } as const;

export type ColorScheme = "dark" | "light";

// ─── Elevation (Atelier) ──────────────────────────────────────────────────────
// One shadow language for the whole app. Which surface gets which level:
//   content cards  → hairline bgBorder border + "sm"
//   floating bits  → "md" (FAB, toasts)
//   overlays       → "overlay" (modals, detail sheets)
//
// Surface ladder — use it semantically, not decoratively:
//   bgPrimary   → the page itself
//   bgSecondary → static containers (cards, header, tab bar)
//   bgTertiary  → interactive/raised state (hover, open dropdown, pressed row)
// A tertiary surface should mean "you can act on this".
//
// Borders vs shadows: pick one per scheme rather than stacking both.
//   dark  → hairline border + the 1px lit top edge carry the depth. A drop
//           shadow over #0D0D0D is nearly invisible while still costing paint,
//           so dark shadows are minimal and `xs` drops out entirely.
//   light → shadows do the work; borders are already there but recede.
// Overlays keep a real shadow in both schemes — they have to detach from the
// scrim to read as floating.
//
// RN-web converts these shadow* props to box-shadow, so one definition serves
// both platforms; elevation covers Android.

export type ShadowLevel = "xs" | "sm" | "md" | "overlay";

const SHADOW_SPECS: Record<ShadowLevel, { dark: number; light: number; radius: number; offsetY: number; elevation: number }> = {
  xs:      { dark: 0,    light: 0.06, radius: 3,  offsetY: 1,  elevation: 1 },
  sm:      { dark: 0.10, light: 0.10, radius: 8,  offsetY: 2,  elevation: 2 },
  md:      { dark: 0.30, light: 0.16, radius: 16, offsetY: 6,  elevation: 6 },
  overlay: { dark: 0.50, light: 0.24, radius: 32, offsetY: 16, elevation: 16 },
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
  // Must be 6-digit hex: the web branch appends a 2-digit alpha, and a 3-digit
  // base ("#000" + "14" → "#00014") is invalid CSS that silently kills the shadow.
  const color   = options?.color ?? "#000000";
  const opacity = options?.opacity ?? (scheme === "dark" ? s.dark : s.light);

  // RN Web warns that shadow*/elevation style props are deprecated in favour
  // of boxShadow — return the CSS form on web, the native form elsewhere.
  if (Platform.OS === "web") {
    const drop = opacity > 0
      ? `0px ${s.offsetY}px ${s.radius}px ${color}${opacityToHexAlpha(opacity)}`
      : null;
    // Card levels get a 1px inner top highlight — a crisp lit edge that reads
    // as depth without heavier shadows, and on dark it is most of the depth.
    if (level === "sm" || level === "md") {
      const edge = scheme === "dark" ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.75)";
      return { boxShadow: drop ? `inset 0 1px 0 ${edge}, ${drop}` : `inset 0 1px 0 ${edge}` };
    }
    // No shadow at all rather than a transparent one — a 00-alpha box-shadow
    // still creates a paint layer.
    return drop ? { boxShadow: drop } : {};
  }
  if (opacity <= 0) return { elevation: 0 };
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
  // Pre-measurement fallback for floating UI (see lib/TabBarHeightContext.tsx).
  // Once MobileTabBar reports its onLayout height, offsets derive from that —
  // there is deliberately no per-platform value here, because Platform.OS is
  // "web" in the iOS home-screen PWA and the .ios branch never fired there.
  fabBottom:    { default: 76 },
  gutter:       { mobile: 20, desktop: 32 },
  maxWidth:     { narrow: 720, wide: 1200 },
  /** Widths for floating surfaces. Previously ad-hoc literals — 340, 360, 380,
   *  420 and two 480s across six files — with no way to tell which were meant
   *  to match. Anchored dropdowns keep their own default in Select.tsx: that is
   *  sized to its trigger, not to this scale. */
  panel: {
    /** Desktop side column (notes list beside the editor). */
    column: 340,
    /** Small centred modal card (dump editor). */
    card:   360,
    /** Toast on wide viewports. */
    toast:  380,
    /** Right-hand detail drawer (task detail). */
    drawer: 420,
    /** Standard centred modal max width (quick-add, task composer). */
    modal:  480,
  },
} as const;

// ─── Motion ───────────────────────────────────────────────────────────────────

export const motion = {
  fast: 150,
  base: 200,
  slow: 300,
  /**
   * One easing for every transition in the app. Transitions were previously
   * declared ad-hoc with `ease-out` or nothing at all, so nothing shared a
   * personality. Decelerating curve: quick to start, settles softly — reads as
   * responsive rather than floaty.
   */
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  /** Per-item delay for a list mount stagger, in ms. Small on purpose: enough to
   *  read as sequence, not enough to make the list feel slow to arrive. */
  stagger: 40,
  /** Cap the stagger so a long list's last row isn't delayed absurdly. */
  staggerMaxItems: 8,
  /** Standard pressable feedback. */
  pressOpacity: 0.85,
  pressScale: 0.98,
} as const;

/** Web-only CSS transition shorthand using the shared curve. No-op elsewhere. */
export function transition(
  properties: string,
  duration: number = motion.fast,
): Record<string, string> {
  if (Platform.OS !== "web") return {};
  return {
    transitionProperty: properties,
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: motion.easing,
  };
}

/**
 * Staggered mount animation for item `index` in a list. Web only.
 *
 * Note this has to be an *animation*, not a transition with a delay: on first
 * paint there is no state change to transition from, so transitionDelay would do
 * nothing on mount and would instead lag every subsequent hover. The `hn-rise`
 * keyframes live in global.css.
 */
export function mountStagger(index: number): Record<string, string> {
  if (Platform.OS !== "web") return {};
  return {
    animationName: "hn-rise",
    animationDuration: `${motion.base}ms`,
    animationTimingFunction: motion.easing,
    animationDelay: `${Math.min(index, motion.staggerMaxItems) * motion.stagger}ms`,
    animationFillMode: "both",
  };
}

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
  { id: "crimson", label: "Crimson", color: "#DC5A6A", hover: "#EC6A7A", subtle: "#331418", lightSubtle: "#FBE4E7" },
  { id: "gold",    label: "Gold",    color: "#D4A72C", hover: "#E4B73C", subtle: "#2E2508", lightSubtle: "#F8EFD4" },
  // Grayscale accents — for a fully monochrome look on any theme.
  { id: "slate",   label: "Slate",   color: "#7C8698", hover: "#8C96A8", subtle: "#20242C", lightSubtle: "#E6E9EE" },
  { id: "mono",    label: "Mono",    color: "#9A9A9A", hover: "#AAAAAA", subtle: "#262626", lightSubtle: "#E8E8E8" },
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
  evergreen: { // botanical
    hues: [140, 95, 170, 60, 200, 28], sat: 0.85,
    wash: { dark: ["#6DBF7E", "#3A9A8A"], light: ["#3A8A4A", "#6ABF8E"] },
    hero: { dark: ["#6DBF7E", "#9ACD6A"], light: ["#3A8A4A", "#2A7A6A"] },
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
// Task categories are user-editable (see TaskCategoriesContext) and store a
// curated AccentId (one of ACCENT_OPTIONS above) rather than a raw hex value —
// this resolves that id to concrete colours for the active scheme, falling
// back to the first accent for an unrecognised/legacy id.

export function resolveAccentSwatch(
  id: string,
  scheme: ColorScheme
): { color: string; hover: string; subtle: string } {
  const opt = ACCENT_OPTIONS.find(a => a.id === id) ?? ACCENT_OPTIONS[0];
  return { color: opt.color, hover: opt.hover, subtle: scheme === "dark" ? opt.subtle : opt.lightSubtle };
}

// ─── List default colours ─────────────────────────────────────────────────────
// Sanctioned fixed palette — user-picked list identities, theme-independent.

export const listColors: readonly string[] = [
  "#4A90D9", "#9B59B6", "#27AE60", "#E67E22",
  "#E74C3C", "#E8C84A", "#E91E8C", "#1ABC9C",
];
