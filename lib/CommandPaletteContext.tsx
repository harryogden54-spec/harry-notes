import React, { createContext, useContext, useState, useCallback } from "react";

type Ctx = { isOpen: boolean; open: () => void; close: () => void };

const CommandPaletteContext = createContext<Ctx>({ isOpen: false, open: () => {}, close: () => {} });

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export const useCommandPalette = () => useContext(CommandPaletteContext);
