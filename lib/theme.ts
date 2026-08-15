/**
 * Design tokens — single source of truth.
 * These mirror tailwind.config.js so we can use them in StyleSheet / inline styles
 * when Tailwind classes aren't available (e.g. react-navigation config).
 */
import { Platform } from "react-native";

// ─── Theme types ──────────────────────────────────────────────────────────────

/**
 * Four themes, rebuilt 2026-08-13. Each is a *material*, not a palette: it owns
 * its surface contrast, where separation comes from (hairline border vs cast
 * shadow) and what colour its shadows are, on top of the usual colour ramp.
 *
 * The previous six included near-neighbours — Graphite was Obsidian with the
 * accent drained, and Evergreen and Nord shared a mood. What survives is one
 * theme per temperature (neutral / cool / warm) plus a true-black Void, and
 * each one's light scheme is authored on its own terms rather than derived by
 * inverting its dark.
 */
export type ThemeId = "obsidian" | "nord" | "ember" | "void";

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

/**
 * The non-colour half of a theme — what the surfaces are *made of*.
 *
 * Two themes can share a hue and still feel unrelated: one separating its cards
 * with a crisp hairline and no shadow reads as technical and flat, another
 * lifting them on a soft warm shadow reads as physical. That difference lives
 * here rather than being hardcoded once for the whole app.
 */
export type ThemeMaterial = {
  /**
   * Where a surface's edge comes from.
   *   "border" — hairline only; shadows suppressed. Crisp, flat, technical.
   *   "shadow" — cast shadow carries it; borders stay nearly invisible.
   *   "both"   — a hairline plus a soft shadow.
   */
  separation: "border" | "shadow" | "both";
  /** Shadow tint. Warm themes cast warm shadows; pure black looks like soot on them. */
  shadowColor: string;
  /** Multiplier on the base shadow opacity — 0 suppresses shadows entirely. */
  shadowStrength: number;
};

const SEMANTIC_DARK  = { success: "#3DD68C", warning: "#F5A623", danger: "#F26464", scrim: "#0000008C" } as const;
const SEMANTIC_LIGHT = { success: "#1E8A5A", warning: "#B86E00", danger: "#C0392B", scrim: "#00000073" } as const;

// ─── Named themes (4) ─────────────────────────────────────────────────────────

type ThemeScheme = { tokens: ThemeTokens; material: ThemeMaterial };

export type ThemeDef = {
  label: string;
  /** The accent this theme was authored around. A user accent overrides it. */
  defaultAccent: AccentId;
  dark: ThemeScheme;
  light: ThemeScheme;
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  /**
   * Neutral ink. The default: near-black that stays out of the way, separation
   * from a hairline plus a whisper of shadow. Its light scheme is true white
   * paper — the one place a pure #FFF is right, because nothing else tints it.
   */
  obsidian: {
    label: "Obsidian",
    defaultAccent: "navy",
    dark: {
      tokens: {
        bgPrimary: "#0D0D0D", bgSecondary: "#161616", bgTertiary: "#1F1F1F", bgBorder: "#2A2A2A",
        textPrimary: "#F0F0F0", textSecondary: "#9A9A9A", textTertiary: "#5A5A5A", textInverse: "#0D0D0D",
        accent: "#5F84CA", accentHover: "#7A99D3", accentSubtle: "#10192B",
        ...SEMANTIC_DARK,
      },
      material: { separation: "both", shadowColor: "#000000", shadowStrength: 1 },
    },
    light: {
      tokens: {
        bgPrimary: "#FFFFFF", bgSecondary: "#FAFAFA", bgTertiary: "#F2F2F2", bgBorder: "#E4E4E4",
        textPrimary: "#141414", textSecondary: "#565656", textTertiary: "#8E8E8E", textInverse: "#FFFFFF",
        accent: "#1B263B", accentHover: "#131B2A", accentSubtle: "#E4E9F4",
        ...SEMANTIC_LIGHT,
      },
      material: { separation: "both", shadowColor: "#1A1A2E", shadowStrength: 0.9 },
    },
  },

  /**
   * Cool blue-grey. Nord's own palette, but the light scheme is no longer the
   * dark one flipped: it is cool paper with slate ink, so it reads as daylight
   * on the same material rather than a washed-out negative. Border-led — the
   * flattest of the four.
   */
  nord: {
    label: "Nord",
    defaultAccent: "frost",
    dark: {
      tokens: {
        bgPrimary: "#2E3440", bgSecondary: "#363E4C", bgTertiary: "#414B5C", bgBorder: "#4C566A",
        textPrimary: "#ECEFF4", textSecondary: "#C3CCDA", textTertiary: "#8895A8", textInverse: "#2E3440",
        accent: "#9BC3E8", accentHover: "#B8D4EF", accentSubtle: "#0F1E2C",
        ...SEMANTIC_DARK,
      },
      material: { separation: "border", shadowColor: "#141821", shadowStrength: 0.45 },
    },
    light: {
      tokens: {
        bgPrimary: "#F7F9FC", bgSecondary: "#FFFFFF", bgTertiary: "#EDF1F7", bgBorder: "#D6DEE9",
        textPrimary: "#2E3440", textSecondary: "#556172", textTertiary: "#8894A6", textInverse: "#FFFFFF",
        accent: "#2077C7", accentHover: "#1C6AB1", accentSubtle: "#DEECFA",
        ...SEMANTIC_LIGHT,
      },
      material: { separation: "border", shadowColor: "#2E3440", shadowStrength: 0.5 },
    },
  },

  /**
   * Warm hearth. The most physical of the four: shadows carry the separation
   * and they are warm-tinted, because a neutral black shadow over these browns
   * reads as dirt. Light is warm paper, not pink.
   */
  ember: {
    label: "Ember",
    defaultAccent: "brick",
    dark: {
      tokens: {
        bgPrimary: "#17100E", bgSecondary: "#211815", bgTertiary: "#2C211D", bgBorder: "#3A2B26",
        textPrimary: "#F7EFE9", textSecondary: "#C8A692", textTertiary: "#8A6553", textInverse: "#17100E",
        accent: "#D26363", accentHover: "#DA7F7F", accentSubtle: "#2C0F0F",
        ...SEMANTIC_DARK,
      },
      material: { separation: "shadow", shadowColor: "#1A0B05", shadowStrength: 1.5 },
    },
    light: {
      tokens: {
        bgPrimary: "#FBF6F1", bgSecondary: "#FFFDFB", bgTertiary: "#F3E9E0", bgBorder: "#E4D3C6",
        textPrimary: "#2A1A12", textSecondary: "#6B4B38", textTertiary: "#9C7B66", textInverse: "#FFFDFB",
        accent: "#780000", accentHover: "#5F0000", accentSubtle: "#FADEDE",
        ...SEMANTIC_LIGHT,
      },
      material: { separation: "shadow", shadowColor: "#5A3520", shadowStrength: 1.2 },
    },
  },

  /**
   * True black, for OLED. A separate theme rather than a modifier on the other
   * darks: #000 needs its own ramp to work — surfaces have to lift by real
   * steps or the screen collapses into one void — and a cast shadow against
   * black is invisible, so separation is border-only.
   */
  void: {
    label: "Void",
    defaultAccent: "stone",
    dark: {
      tokens: {
        bgPrimary: "#000000", bgSecondary: "#0B0B0B", bgTertiary: "#161616", bgBorder: "#292929",
        textPrimary: "#FFFFFF", textSecondary: "#A6A6A6", textTertiary: "#666666", textInverse: "#000000",
        accent: "#8D8484", accentHover: "#9E9797", accentSubtle: "#231818",
        ...SEMANTIC_DARK,
      },
      material: { separation: "border", shadowColor: "#000000", shadowStrength: 0 },
    },
    /**
     * Void is a dark theme by intent. Its light scheme exists so the light/dark
     * toggle can't strand you on an unreadable screen — it is a high-contrast
     * paper, not an attempt at a "light true-black".
     */
    light: {
      tokens: {
        bgPrimary: "#FFFFFF", bgSecondary: "#FFFFFF", bgTertiary: "#F0F0F0", bgBorder: "#D6D6D6",
        textPrimary: "#000000", textSecondary: "#4A4A4A", textTertiary: "#7A7A7A", textInverse: "#FFFFFF",
        accent: "#5E5959", accentHover: "#514D4D", accentSubtle: "#F0E8E8",
        ...SEMANTIC_LIGHT,
      },
      material: { separation: "border", shadowColor: "#000000", shadowStrength: 0 },
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
 * Icon sizes. Ionicons were being set at seventeen different sizes (10…28),
 * picked per call site, so two icons doing the same job in different components
 * rendered at different weights.
 *
 * Naming rules that go with these, since Ionicons offers two families:
 *   - OUTLINE is the default for every object icon (gear, trash, archive, tag).
 *   - FILLED means an on-state, not a different icon: `star` = pinned,
 *     `checkmark-circle` = filed. Never use filled purely for emphasis.
 *   - Geometric glyphs (add, close, checkmark, chevron-*, ellipsis-*) have no
 *     meaningful outline/filled pair — pick one spelling and keep to it.
 */
export const iconSize = {
  /** Sits inside meta text and small chips. */
  xs: 12,
  /** Inline with body text, list-row affordances. */
  sm: 14,
  /** App chrome: header, nav, buttons. */
  md: 16,
  /** Prominent single actions. */
  lg: 20,
  /** FAB and feature marks. */
  xl: 28,
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
  options?: { color?: string; opacity?: number; material?: ThemeMaterial },
) {
  const s = SHADOW_SPECS[level];
  const m = options?.material;
  // Must be 6-digit hex: the web branch appends a 2-digit alpha, and a 3-digit
  // base ("#000" + "14" → "#00014") is invalid CSS that silently kills the shadow.
  const color   = options?.color ?? m?.shadowColor ?? "#000000";
  const base    = scheme === "dark" ? s.dark : s.light;
  // A border-led theme keeps its overlays (modals genuinely float) but drops the
  // shadow from cards, where the hairline is doing the work.
  const suppressed = m?.separation === "border" && level !== "overlay";
  const opacity = options?.opacity
    ?? (suppressed ? 0 : base * (m?.shadowStrength ?? 1));

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

/*
 * `mountStagger()` lived here: a per-index `hn-rise` keyframe that rippled the
 * notes grid in on every mount. Removed 2026-08-13 — motion should explain a
 * change, and nothing had changed. It replayed on every route visit, so the
 * cost (a delay before the grid is readable, every single time you open Notes)
 * was paid repeatedly for a one-off flourish.
 *
 * Motion that stays is motion that carries meaning: `LinearTransition` moving a
 * task card when it changes column, `FadeIn`/`FadeOut` as rows genuinely enter
 * and leave, the route fade in GradientBackground.
 */

// ─── Priority colours ─────────────────────────────────────────────────────────
// Keys into ThemeTokens so priorities follow the active theme/scheme.

export const priorityColorKey = {
  urgent: "danger",
  high:   "warning",
  medium: "accent",
  low:    "textTertiary",
} as const satisfies Record<string, keyof ThemeTokens>;

// ─── Accent options (override accent within any theme) ────────────────────────

/**
 * Accents, replaced 2026-08-15 from a palette the user picked by eye. Eight
 * hues, ordered cool → green → warm → neutral so the picker reads as a ramp.
 *
 * Each entry is anchored on ONE supplied hex, kept verbatim in the scheme where
 * it already clears 4.5:1 — four of them are light enough for a dark background
 * (frost/jade/sage/harbour), four are deep enough for a white one
 * (navy/olive/brick/stone). The counterpart is derived from that same hex by
 * moving lightness with the hue pinned, because one hex cannot clear 4.5:1 as
 * text on both #0D0D0D and #FFFFFF — attempting it is what made the previous
 * set look washed out on light.
 *
 * Derived values aim for 5.2:1 on #0D0D0D rather than the bare 4.5, since
 * Nord's dark surface is #2E3440 — far lighter than near-black — and anything
 * that only just clears black goes thin on it. Saturation is capped at 0.55
 * while lifting: an unbounded lift of #780000 lands on #F80000, which is
 * exactly the neon the palette is meant to avoid.
 *
 * Verified: every `color` ≥ 5.2:1 on #0D0D0D, every `light` ≥ 4.6:1 on #FFFFFF.
 */
export const ACCENT_OPTIONS = [
  { id: "navy",    label: "Navy",    color: "#5F84CA", hover: "#7A99D3", light: "#1B263B", lightHover: "#131B2A", subtle: "#10192B", lightSubtle: "#E4E9F4" },
  { id: "harbour", label: "Harbour", color: "#6EA4C4", hover: "#87B4CE", light: "#387BA3", lightHover: "#316D90", subtle: "#122028", lightSubtle: "#E2EEF6" },
  { id: "frost",   label: "Frost",   color: "#9BC3E8", hover: "#B8D4EF", light: "#2077C7", lightHover: "#1C6AB1", subtle: "#0F1E2C", lightSubtle: "#DEECFA" },
  { id: "sage",    label: "Sage",    color: "#79A49A", hover: "#8EB2AA", light: "#4F7C72", lightHover: "#456C64", subtle: "#182320", lightSubtle: "#E7F1EE" },
  { id: "jade",    label: "Jade",    color: "#6EC499", hover: "#87CEAB", light: "#2D8358", lightHover: "#26704B", subtle: "#12281D", lightSubtle: "#E2F6EC" },
  { id: "olive",   label: "Olive",   color: "#7D8A51", hover: "#91A05E", light: "#5A6142", lightHover: "#4C5238", subtle: "#212416", lightSubtle: "#EEF0E8" },
  { id: "brick",   label: "Brick",   color: "#D26363", hover: "#DA7F7F", light: "#780000", lightHover: "#5F0000", subtle: "#2C0F0F", lightSubtle: "#FADEDE" },
  { id: "stone",   label: "Stone",   color: "#8D8484", hover: "#9E9797", light: "#5E5959", lightHover: "#514D4D", subtle: "#231818", lightSubtle: "#F0E8E8" },
] as const;

export type AccentId = typeof ACCENT_OPTIONS[number]["id"];

/**
 * Where the previous ten accent ids land. This matters far more than the theme
 * map did: task categories store an AccentId as their colour, so without it
 * every custom category would fail validation, collapse to one colour, and —
 * worse — have that collapse written back and synced. Mapped by nearest hue,
 * with the two-into-one cases (amber/crimson → brick, slate/mono → stone)
 * chosen so nothing lands on a hue it never had.
 */
const LEGACY_ACCENT_MAP: Record<string, AccentId> = {
  indigo:  "navy",
  sky:     "frost",
  ocean:   "harbour",
  moss:    "jade",
  orchid:  "sage",
  amber:   "brick",
  crimson: "brick",
  gold:    "olive",
  slate:   "stone",
  mono:    "stone",
};

/** Resolve any stored accent id — current or retired — to a live one. */
export function normalizeAccentId(value: unknown): AccentId | null {
  if (typeof value !== "string") return null;
  if (ACCENT_OPTIONS.some(a => a.id === value)) return value as AccentId;
  return LEGACY_ACCENT_MAP[value] ?? null;
}

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
  /** Saturation multiplier (Void wants near-monochrome pastels). */
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
  ember: { // hearth glow
    hues: [10, 25, 0, 40, 350, 55], sat: 0.95,
    wash: { dark: ["#E85D4A", "#C2452E"], light: ["#C0392B", "#E87A4A"] },
    hero: { dark: ["#E85D4A", "#F5A623"], light: ["#C0392B", "#E06A30"] },
  },
  void: { // no hue at all — note pastels stay near-grey so nothing glows on black
    hues: [228, 200, 280, 150, 340, 45], sat: 0.22,
    wash: { dark: ["#9A9A9A", "#5A5A5A"], light: ["#4A4A4A", "#8A8A8A"] },
    hero: { dark: ["#FFFFFF", "#9A9A9A"], light: ["#000000", "#4A4A4A"] },
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
  const resolved = normalizeAccentId(id);
  const opt = ACCENT_OPTIONS.find(a => a.id === resolved) ?? ACCENT_OPTIONS[0];
  const dark = scheme === "dark";
  // Category chips are text-on-tint, so they need the same per-scheme variant
  // the main accent uses — the dark value on white is unreadable at meta size.
  return {
    color:  dark ? opt.color : opt.light,
    hover:  dark ? opt.hover : opt.lightHover,
    subtle: dark ? opt.subtle : opt.lightSubtle,
  };
}

// ─── List default colours ─────────────────────────────────────────────────────
// Sanctioned fixed palette — user-picked list identities, theme-independent.

export const listColors: readonly string[] = [
  "#4A90D9", "#9B59B6", "#27AE60", "#E67E22",
  "#E74C3C", "#E8C84A", "#E91E8C", "#1ABC9C",
];
