import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Platform } from "react-native";

type Ctx = { isOpen: boolean; open: () => void; close: () => void };

const CommandPaletteContext = createContext<Ctx>({ isOpen: false, open: () => {}, close: () => {} });

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global Cmd+K / Ctrl+K shortcut on web
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export const useCommandPalette = () => useContext(CommandPaletteContext);
