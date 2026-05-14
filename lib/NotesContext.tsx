import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { storage } from "./storage";
import { syncFetch, syncUpsert, syncDelete } from "./supabase";
import { dbLoadNotes, dbSaveNotes } from "./db";

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
  const loadedRef                    = useRef(false);
  const notesRef                     = useRef<Note[]>([]);
  const syncDebounce                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef                = useRef<string | null>(null);
  const pendingDeletesRef            = useRef<Set<string>>(new Set());

  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { lastSyncedRef.current = lastSynced; }, [lastSynced]);

  // Persist locally on every change + debounced push to Supabase
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("notes", notes);
    if (Platform.OS !== "web") dbSaveNotes(notes).catch(console.error);

    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(async () => {
      const snapshot = notesRef.current;
      if (snapshot.length === 0) return;
      const cutoff = lastSyncedRef.current;
      const dirty = cutoff
        ? snapshot.filter(n => (n.updated_at ?? n.created_at) > cutoff)
        : snapshot;
      if (dirty.length === 0) return;
      const ok = await syncUpsert("notes", dirty);
      if (!ok) setSyncStatus("error");
    }, 1500);
  }, [notes]);

  // Load from local storage then sync from remote
  useEffect(() => {
    // 3-second safety net: mark loaded even if storage hangs
    const loadTimeout = setTimeout(() => {
      if (!loadedRef.current) { loadedRef.current = true; setLoaded(true); }
    }, 3000);

    const loadLocal = async (): Promise<Note[]> => {
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
    };

    loadLocal().then(async (local) => {
      clearTimeout(loadTimeout);
      const localNotes = local;
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
            if (pendingDeletesRef.current.has(rem.id)) continue;
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
    }).catch(() => { clearTimeout(loadTimeout); setSyncStatus("error"); });
    return () => clearTimeout(loadTimeout);
  }, []);

  // Sync when app comes to foreground (native) or tab becomes visible (web)
  useEffect(() => {
    if (Platform.OS !== "web") {
      const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active" && loadedRef.current) syncNow();
      });
      return () => sub.remove();
    }
    const onVisibility = () => { if (!document.hidden && loadedRef.current) syncNow(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncNow = useCallback(async () => {
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    setSyncStatus("syncing");
    try {
      const remote = await syncFetch<Note & { _updated_at: string }>("notes");
      const remoteMap = new Map(remote.map(r => [r.id, r]));
      const local = notesRef.current;

      const merged = [...local];
      for (const rem of remote) {
        if (pendingDeletesRef.current.has(rem.id)) continue;
        const idx = merged.findIndex(n => n.id === rem.id);
        if (idx === -1) merged.push(rem);
        else {
          const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
          const remoteUp = (rem as any)._updated_at ?? rem.updated_at ?? "";
          if (remoteUp > localUp) merged[idx] = rem;
        }
      }
      setNotes(merged);

      // Push any local notes newer than what Supabase has
      const toUpsert = merged.filter(n => {
        const rem = remoteMap.get(n.id);
        const localUp  = n.updated_at ?? n.created_at;
        const remoteUp = rem ? ((rem as any)._updated_at ?? rem.updated_at ?? "") : "";
        return localUp > remoteUp;
      });
      if (toUpsert.length > 0) await syncUpsert("notes", toUpsert).catch(console.warn);

      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    } catch {
      setSyncStatus("error");
    }
  }, []);

  const addNote = useCallback((): string => {
    const id  = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    pendingDeletesRef.current.add(id);
    const timer = setTimeout(() => {
      syncDelete("notes", id);
      pendingDeletesRef.current.delete(id);
    }, 3000);
    return () => {
      clearTimeout(timer);
      pendingDeletesRef.current.delete(id);
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
