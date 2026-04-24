import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
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
  const [override, setOverride]       = useState<Scheme | null>(null);
  const [accentId, setAccentIdState]  = useState<AccentId>("frost");
  const [themeId, setThemeIdState]    = useState<ThemeId>("nord");
  const [themeReady, setThemeReady]   = useState(false);

  useEffect(() => {
    // Timeout fallback — mark ready even if storage hangs
    const timeout = setTimeout(() => setThemeReady(true), 2000);

    Promise.all([
      storage.get<Scheme>("theme_override").then(v => { if (v) setOverride(v); }),
      storage.get<AccentId>("accent_id").then(v => {
        if (v && ACCENT_OPTIONS.some(a => a.id === v)) setAccentIdState(v);
      }),
      storage.get<ThemeId>("theme-v2").then(v => {
        if (v && (v in THEMES)) setThemeIdState(v);
      }),
    ]).finally(() => {
      clearTimeout(timeout);
      setThemeReady(true);
    });

    return () => clearTimeout(timeout);
  }, []);

  const scheme = override ?? device;

  function toggle() {
    const next: Scheme = scheme === "dark" ? "light" : "dark";
    setOverride(next);
    storage.set("theme_override", next);
  }

  function setAccentId(id: AccentId) {
    setAccentIdState(id);
    storage.set("accent_id", id);
  }

  function setThemeId(id: ThemeId) {
    setThemeIdState(id);
    storage.set("theme-v2", id);
  }

  return (
    <ThemeContext.Provider value={{ scheme, toggle, isManual: !!override, accentId, setAccentId, themeId, setThemeId, themeReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
