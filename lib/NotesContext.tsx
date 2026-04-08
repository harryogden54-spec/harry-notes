import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { storage } from "./storage";
import { syncFetch, syncUpsert, syncDelete } from "./supabase";

export type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at?: string;
};

type SyncStatus = "idle" | "syncing" | "synced" | "error";

type NotesContextValue = {
  notes: Note[];
  loaded: boolean;
  syncStatus: SyncStatus;
  lastSynced: string | null;
  addNote: () => string;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => void;
  deleteNote: (id: string) => () => void;
  pinNote: (id: string) => void;
  syncNow: () => Promise<void>;
};

const NotesContext = createContext<NotesContextValue | null>(null);

function stamp(note: Note): Note {
  return { ...note, updated_at: new Date().toISOString() };
}

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const loadedRef                   = useRef(false);
  const notesRef                    = useRef<Note[]>([]);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Persist locally + debounced sync
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("notes", notes);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSyncStatus("syncing");
      syncUpsert("notes", notes)
        .then(() => { setSyncStatus("synced"); setLastSynced(new Date().toISOString()); })
        .catch(() => setSyncStatus("error"));
    }, 1500);
  }, [notes]);

  // Load from local storage then sync from remote
  useEffect(() => {
    storage.get<Note[]>("notes").then(async (local) => {
      const localNotes = local ?? [];
      setNotes(localNotes);
      loadedRef.current = true;
      setLoaded(true);

      setSyncStatus("syncing");
      try {
        const remote = await syncFetch<Note & { _updated_at: string }>("notes");
        if (remote.length === 0 && localNotes.length > 0) {
          await syncUpsert("notes", localNotes);
          setSyncStatus("synced");
          setLastSynced(new Date().toISOString());
          return;
        }
        setNotes(prev => {
          const merged = [...prev];
          for (const rem of remote) {
            const idx = merged.findIndex(n => n.id === rem.id);
            if (idx === -1) merged.push(rem);
            else {
              const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
              const remoteUp = (rem as any)._updated_at ?? rem.updated_at ?? "";
              if (remoteUp > localUp) merged[idx] = rem;
            }
          }
          return merged;
        });
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
      } catch {
        setSyncStatus("error");
      }
    });
  }, []);

  const syncNow = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const remote = await syncFetch<Note & { _updated_at: string }>("notes");
      setNotes(prev => {
        const merged = [...prev];
        for (const rem of remote) {
          const idx = merged.findIndex(n => n.id === rem.id);
          if (idx === -1) merged.push(rem);
          else {
            const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
            const remoteUp = (rem as any)._updated_at ?? rem.updated_at ?? "";
            if (remoteUp > localUp) merged[idx] = rem;
          }
        }
        return merged;
      });
      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    } catch {
      setSyncStatus("error");
    }
  }, []);

  const addNote = useCallback((): string => {
    const id  = `${Date.now()}`;
    const now = new Date().toISOString();
    const note: Note = { id, title: "", body: "", pinned: false, created_at: now, updated_at: now };
    setNotes(prev => [note, ...prev]);
    return id;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => {
    setNotes(prev => prev.map(n => n.id === id ? stamp({ ...n, ...updates }) : n));
  }, []);

  const deleteNote = useCallback((id: string): (() => void) => {
    const deleted = notesRef.current.find(n => n.id === id);
    setNotes(prev => prev.filter(n => n.id !== id));
    const timer = setTimeout(() => syncDelete("notes", id), 3000);
    return () => {
      clearTimeout(timer);
      if (deleted) setNotes(prev => [deleted, ...prev]);
    };
  }, []);

  const pinNote = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? stamp({ ...n, pinned: !n.pinned }) : n));
  }, []);

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
