import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { storage } from "./storage";

// 5 accent colours that cycle on creation
export const STICKY_COLOURS = [
  "#88C0D0", // frost blue
  "#A3BE8C", // aurora green
  "#BF616A", // aurora red
  "#EBCB8B", // aurora yellow
  "#B48EAD", // aurora purple
] as const;

export type StickyNote = {
  id: string;
  content: string;
  colour: string;
  createdAt: string;
};

type StickyNotesContextValue = {
  notes: StickyNote[];
  loaded: boolean;
  addNote: (content: string, colour?: string) => string;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
};

const StickyNotesContext = createContext<StickyNotesContextValue | null>(null);

const STORAGE_KEY = "sticky_notes";

export function StickyNotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes]   = useState<StickyNote[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage.get<StickyNote[]>(STORAGE_KEY).then(local => {
      setNotes(local ?? []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_KEY, notes);
  }, [notes, loaded]);

  const addNote = useCallback((content: string, colour?: string): string => {
    const id = `sn_${Date.now()}`;
    const createdAt = new Date().toISOString();
    setNotes(prev => {
      const nextColour = colour ?? STICKY_COLOURS[prev.length % STICKY_COLOURS.length];
      return [{ id, content, colour: nextColour, createdAt }, ...prev];
    });
    return id;
  }, []);

  const updateNote = useCallback((id: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <StickyNotesContext.Provider value={{ notes, loaded, addNote, updateNote, deleteNote }}>
      {children}
    </StickyNotesContext.Provider>
  );
}

export function useStickyNotes() {
  const ctx = useContext(StickyNotesContext);
  if (!ctx) throw new Error("useStickyNotes must be used within StickyNotesProvider");
  return ctx;
}
