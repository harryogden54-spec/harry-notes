import React, { createContext, useContext, useCallback } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { syncDelete } from "./supabase";
import { dbLoadNotes, dbSaveNotes } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";

export type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  type: "note" | "postit";
  created_at: string;
  updated_at?: string;
};

type NotesContextValue = {
  notes: Note[];
  loaded: boolean;
  syncStatus: SyncStatus;
  lastSynced: string | null;
  addNote: (type?: "note" | "postit") => string;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => void;
  deleteNote: (id: string) => () => void;
  pinNote: (id: string) => void;
  syncNow: () => Promise<void>;
};

const NotesContext = createContext<NotesContextValue | null>(null);

function stamp(note: Note): Note {
  return { ...note, updated_at: new Date().toISOString() };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const {
    items: notes, setItems: setNotes, loaded, syncStatus, lastSynced,
    itemsRef: notesRef, pendingDeletesRef, dirtyIdsRef,
    markDirty, syncNow,
  } = useSyncedCollection<Note>({
    table: "notes",
    storageKey: "notes",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        try {
          const dbNotes = await dbLoadNotes() as Note[];
          if (dbNotes.length > 0) return dbNotes;
          const stored = await storage.get<Note[]>("notes") ?? [];
          if (stored.length > 0) await dbSaveNotes(stored);
          return stored;
        } catch { /* fall through */ }
      }
      return await storage.get<Note[]>("notes") ?? [];
    },
    saveLocal: (items) => {
      if (Platform.OS !== "web") dbSaveNotes(items).catch(console.error);
    },
    // Coerce the type field coming from remote — older rows may be missing it.
    normalizeRemote: (row) => ({
      ...row,
      type: (row.type ?? "note") as "note" | "postit",
    }),
  });

  const addNote = useCallback((type: "note" | "postit" = "note"): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const note: Note = { id, title: "", body: "", pinned: false, type, created_at: now, updated_at: now };
    markDirty(id);
    setNotes(prev => [note, ...prev]);
    return id;
  }, [markDirty, setNotes]);

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => {
    markDirty(id);
    setNotes(prev => prev.map(n => n.id === id ? stamp({ ...n, ...updates }) : n));
  }, [markDirty, setNotes]);

  const deleteNote = useCallback((id: string): (() => void) => {
    const deleted = notesRef.current.find(n => n.id === id);
    setNotes(prev => prev.filter(n => n.id !== id));
    pendingDeletesRef.current.add(id);
    dirtyIdsRef.current.delete(id);
    const timer = setTimeout(() => {
      syncDelete("notes", id);
      pendingDeletesRef.current.delete(id);
    }, 3000);
    return () => {
      clearTimeout(timer);
      pendingDeletesRef.current.delete(id);
      if (deleted) {
        markDirty(id);
        setNotes(prev => [deleted, ...prev]);
      }
    };
  }, [notesRef, pendingDeletesRef, dirtyIdsRef, markDirty, setNotes]);

  const pinNote = useCallback((id: string) => {
    markDirty(id);
    setNotes(prev => prev.map(n => n.id === id ? stamp({ ...n, pinned: !n.pinned }) : n));
  }, [markDirty, setNotes]);

  return (
    <NotesContext.Provider value={{ notes, loaded, syncStatus, lastSynced, addNote, updateNote, deleteNote, pinNote, syncNow }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
