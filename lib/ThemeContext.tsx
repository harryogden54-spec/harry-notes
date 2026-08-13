import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";
import { storage } from "./storage";
import { ACCENT_OPTIONS, THEMES, type AccentId, type ThemeId } from "./theme";

type Scheme = "dark" | "light";

/**
 * Where the three retired themes send their users. Graphite was Obsidian with
 * the colour drained, so it goes there; Evergreen and Solar were both
 * lower-contrast worlds with a warm or cool cast, so they go to the surviving
 * theme of the same temperature. Chosen so nobody's app changes temperature
 * overnight without them asking.
 */
const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  graphite:  "obsidian",
  evergreen: "nord",
  solar:     "ember",
};

/**
 * How much air the app gives its lists. This is a genuine preference rather
 * than a value to be picked centrally — the right answer depends on whether you
 * are reading a handful of tasks or scanning eighty.
 */
export type Density = "comfortable" | "compact";

type ThemeContextValue = {
  scheme: Scheme;
  toggle: () => void;
  isManual: boolean;
  /**
   * `null` means "use whatever accent this theme was authored around". An
   * explicit id overrides the theme's default and survives a theme change, so
   * the precedence is visible rather than the picker silently always winning.
   */
  accentId: AccentId | null;
  setAccentId: (id: AccentId) => void;
  /** Drop back to the current theme's own accent. */
  resetAccent: () => void;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  density: Density;
  setDensity: (d: Density) => void;
  themeReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const device = (useColorScheme() ?? "dark") as Scheme;
  const [override, setOverride]      = useState<Scheme | null>(null);
  const [accentId, setAccentIdState] = useState<AccentId | null>(null);
  const [themeId, setThemeIdState]   = useState<ThemeId>("obsidian");
  // Compact by default on native: the meta line wraps awkwardly on a phone.
  // This was the tasks screen's own `tasks_compact` state before it became an
  // app-level preference.
  const [density, setDensityState]   = useState<Density>(Platform.OS === "web" ? "comfortable" : "compact");
  const [themeReady, setThemeReady]  = useState(false);

  useEffect(() => {
    // Fallback ceiling only — storage.get is local and normally resolves in
    // milliseconds. 500ms caps the worst-case blank frame (was 2s).
    const timeout = setTimeout(() => setThemeReady(true), 500);

    Promise.all([
      storage.get<Scheme>("theme_override").then(v => { if (v) setOverride(v); }),
      // accent_id_v2 — bumped from v1 so stale frost/deep/etc ids reset.
      // Absent now means "follow the theme" rather than "indigo".
      storage.get<AccentId>("accent_id_v2").then(v => {
        if (v && ACCENT_OPTIONS.some(a => a.id === v)) setAccentIdState(v);
      }),
      // theme-v4 — bumped from v3 when the six themes became four. A device
      // still on graphite/evergreen/solar lands on its nearest surviving
      // neighbour instead of silently snapping back to the default.
      storage.get<ThemeId>("theme-v4").then(async v => {
        if (v && (v in THEMES)) { setThemeIdState(v); return; }
        const legacy = await storage.get<string>("theme-v3");
        const migrated = legacy ? LEGACY_THEME_MAP[legacy] : undefined;
        if (migrated) {
          setThemeIdState(migrated);
          storage.set("theme-v4", migrated);
        }
      }),
      // Migrates the tasks screen's old boolean key, so an existing preference
      // carries over rather than silently resetting.
      storage.get<Density>("density").then(async v => {
        if (v === "comfortable" || v === "compact") { setDensityState(v); return; }
        const legacy = await storage.get<boolean>("tasks_compact");
        if (typeof legacy === "boolean") setDensityState(legacy ? "compact" : "comfortable");
      }),
    ]).finally(() => {
      clearTimeout(timeout);
      setThemeReady(true);
    });

    return () => clearTimeout(timeout);
  }, []);

  const scheme = override ?? device;

  // Keep the CSS --accent variable (focus outlines in global.css) in sync
  // with the active accent on web. Falls back to the theme's own accent when
  // none is explicitly chosen, matching useTheme().
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const theme = THEMES[themeId] ?? THEMES.obsidian;
    const effective = accentId ?? theme.defaultAccent;
    const opt = ACCENT_OPTIONS.find(a => a.id === effective) ?? ACCENT_OPTIONS[0];
    document.documentElement.style.setProperty("--accent", scheme === "dark" ? opt.color : opt.light);
  }, [accentId, themeId, scheme]);

  // Paint the raw <body> on web. The body otherwise stays browser-default white
  // and shows through as a white bar whenever iOS offsets the app for the
  // keyboard.
  //
  // The colour is the *chrome* background, not the page background. Every strip
  // the body can ever show through is adjacent to the header or the tab bar —
  // both bgSecondary — never to page content:
  //   · an area outside the layout viewport that iOS paints itself (the
  //     home-indicator strip below the tab bar when viewport-fit=cover is not in
  //     effect; see lib/webViewport.ts)
  //   · the gap under the app when the keyboard leaves the page scrolled up
  // Using bgPrimary made those strips a visibly different shade from the bar
  // they sit against, which is what read as a band of stray padding. bgSecondary
  // makes them continuous with it, so a strip is invisible rather than merely
  // themed. theme-color keeps bgPrimary — that tints browser UI, not the app.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const base = (THEMES[themeId] ?? THEMES.obsidian)[scheme].tokens;
    document.body.style.backgroundColor = base.bgSecondary;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", base.bgPrimary);
  }, [themeId, scheme]);

  const toggle = useCallback(() => {
    setOverride(prev => {
      const next: Scheme = (prev ?? device) === "dark" ? "light" : "dark";
      storage.set("theme_override", next);
      return next;
    });
  }, [device]);

  const setAccentId = useCallback((id: AccentId) => {
    setAccentIdState(id);
    storage.set("accent_id_v2", id);
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    storage.set("theme-v4", id);
  }, []);

  const resetAccent = useCallback(() => {
    setAccentIdState(null);
    storage.remove("accent_id_v2");
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    storage.set("density", d);
  }, []);

  // Memoized — useTheme() has ~157 call sites, so a fresh value object every
  // provider render would re-render most of the app on any parent update.
  const value = useMemo(() => ({
    scheme, toggle, isManual: !!override,
    accentId, setAccentId, resetAccent,
    themeId, setThemeId,
    density, setDensity,
    themeReady,
  }), [scheme, toggle, override, accentId, setAccentId, resetAccent, themeId, setThemeId, density, setDensity, themeReady]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
