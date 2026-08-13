import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";
import { storage } from "./storage";
import { ACCENT_OPTIONS, THEMES, type AccentId, type ThemeId } from "./theme";

type Scheme = "dark" | "light";

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
  accentId: AccentId;
  setAccentId: (id: AccentId) => void;
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
  const [accentId, setAccentIdState] = useState<AccentId>("indigo");
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
      // accent_id_v2 — bumped from v1 so stale frost/deep/etc ids reset to "indigo"
      storage.get<AccentId>("accent_id_v2").then(v => {
        if (v && ACCENT_OPTIONS.some(a => a.id === v)) setAccentIdState(v);
      }),
      // theme-v3 — bumped from v2 so stale 16-theme ids reset to "obsidian"
      storage.get<ThemeId>("theme-v3").then(v => {
        if (v && (v in THEMES)) setThemeIdState(v);
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
  // with the active accent on web.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const accent = (ACCENT_OPTIONS.find(a => a.id === accentId) ?? ACCENT_OPTIONS[0]).color;
    document.documentElement.style.setProperty("--accent", accent);
  }, [accentId]);

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
    const base = (THEMES[themeId] ?? THEMES.obsidian)[scheme];
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
    storage.set("theme-v3", id);
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    storage.set("density", d);
  }, []);

  // Memoized — useTheme() has ~157 call sites, so a fresh value object every
  // provider render would re-render most of the app on any parent update.
  const value = useMemo(() => ({
    scheme, toggle, isManual: !!override,
    accentId, setAccentId,
    themeId, setThemeId,
    density, setDensity,
    themeReady,
  }), [scheme, toggle, override, accentId, setAccentId, themeId, setThemeId, density, setDensity, themeReady]);

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
