import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { storage } from "./storage";
import { ACCENT_OPTIONS, type AccentId } from "./theme";

type Scheme = "dark" | "light";

type ThemeContextValue = {
  scheme: Scheme;
  toggle: () => void;
  isManual: boolean;
  accentId: AccentId;
  setAccentId: (id: AccentId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const device = (useColorScheme() ?? "dark") as Scheme;
  const [override, setOverride]   = useState<Scheme | null>(null);
  const [accentId, setAccentIdState] = useState<AccentId>("frost");

  useEffect(() => {
    storage.get<Scheme>("theme_override").then(v => { if (v) setOverride(v); });
    storage.get<AccentId>("accent_id").then(v => {
      if (v && ACCENT_OPTIONS.some(a => a.id === v)) setAccentIdState(v);
    });
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

  return (
    <ThemeContext.Provider value={{ scheme, toggle, isManual: !!override, accentId, setAccentId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
