import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";
import { storage } from "./storage";
import { ACCENT_OPTIONS, THEMES, type AccentId, type ThemeId } from "./theme";

type Scheme = "dark" | "light";

type ThemeContextValue = {
  scheme: Scheme;
  toggle: () => void;
  isManual: boolean;
  accentId: AccentId;
  setAccentId: (id: AccentId) => void;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  themeReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const device = (useColorScheme() ?? "dark") as Scheme;
  const [override, setOverride]      = useState<Scheme | null>(null);
  const [accentId, setAccentIdState] = useState<AccentId>("indigo");
  const [themeId, setThemeIdState]   = useState<ThemeId>("obsidian");
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

  // Memoized — useTheme() has ~157 call sites, so a fresh value object every
  // provider render would re-render most of the app on any parent update.
  const value = useMemo(() => ({
    scheme, toggle, isManual: !!override,
    accentId, setAccentId,
    themeId, setThemeId,
    themeReady,
  }), [scheme, toggle, override, accentId, setAccentId, themeId, setThemeId, themeReady]);

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
