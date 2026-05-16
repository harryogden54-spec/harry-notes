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
  type: "note" | "postit";
  created_at: string;
  updated_at?: string;
};

type SyncStatus = "idle" | "syncing" | "synced" | "error";

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

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const loadedRef                    = useRef(false);
  const notesRef                     = useRef<Note[]>([]);
  const syncDebounce                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletesRef            = useRef<Set<string>>(new Set());
  const dirtyIdsRef                  = useRef<Set<string>>(new Set());

  useEffect(() => { notesRef.current = notes; }, [notes]);

  function markDirty(...ids: string[]) {
    for (const id of ids) dirtyIdsRef.current.add(id);
  }

  // Persist locally on every change + debounced push to Supabase
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("notes", notes);
    if (Platform.OS !== "web") dbSaveNotes(notes).catch(console.error);

    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(async () => {
      const dirtyIds = dirtyIdsRef.current;
      if (dirtyIds.size === 0) return;
      const snapshot = notesRef.current;
      const dirty = snapshot.filter(n => dirtyIds.has(n.id));
      if (dirty.length === 0) { dirtyIds.clear(); return; }
      const pushedIds = dirty.map(n => n.id);
      dirtyIds.clear();
      const ok = await syncUpsert("notes", dirty);
      if (!ok) {
        for (const id of pushedIds) dirtyIds.add(id);
        setSyncStatus("error");
      }
    }, 1500);
  }, [notes]);

  // Load from local storage then sync from remote
  useEffect(() => {
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
      const localNotes = local.map(n => ({ ...n, type: (n.type ?? "note") as "note" | "postit" }));
      setNotes(localNotes);
      loadedRef.current = true;
      setLoaded(true);

      setSyncStatus("syncing");
      const result = await syncFetch<Note & { _updated_at: string }>("notes");
      if (!result.ok) { setSyncStatus("error"); return; }
      const remote = result.rows;
      if (remote.length === 0 && localNotes.length > 0) {
        const ok = await syncUpsert("notes", localNotes);
        setSyncStatus(ok ? "synced" : "error");
        if (ok) setLastSynced(new Date().toISOString());
        return;
      }

      const local0 = notesRef.current;
      const merged = [...local0];
      for (const remRaw of remote) {
        const rem = { ...remRaw, type: (remRaw.type ?? "note") as "note" | "postit" };
        if (pendingDeletesRef.current.has(rem.id)) continue;
        const idx = merged.findIndex(n => n.id === rem.id);
        if (idx === -1) merged.push(rem);
        else {
          const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
          const remoteUp = rem._updated_at ?? rem.updated_at ?? "";
          if (remoteUp > localUp) merged[idx] = rem;
        }
      }
      setNotes(merged);
      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    }).catch(() => { clearTimeout(loadTimeout); setSyncStatus("error"); });
    return () => clearTimeout(loadTimeout);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    setSyncStatus("syncing");
    const result = await syncFetch<Note & { _updated_at: string }>("notes");
    if (!result.ok) { setSyncStatus("error"); return; }
    const remote = result.rows;
    const remoteMap = new Map(remote.map(r => [r.id, r]));
    const local = notesRef.current;

    const merged = [...local];
    for (const remRaw of remote) {
      const rem = { ...remRaw, type: (remRaw.type ?? "note") as "note" | "postit" };
      if (pendingDeletesRef.current.has(rem.id)) continue;
      const idx = merged.findIndex(n => n.id === rem.id);
      if (idx === -1) merged.push(rem);
      else {
        const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
        const remoteUp = rem._updated_at ?? rem.updated_at ?? "";
        if (remoteUp > localUp) merged[idx] = rem;
      }
    }
    setNotes(merged);

    const toUpsert = merged.filter(n => {
      const rem = remoteMap.get(n.id);
      const localUp  = n.updated_at ?? n.created_at;
      const remoteUp = rem ? (rem._updated_at ?? rem.updated_at ?? "") : "";
      return localUp > remoteUp;
    });
    if (toUpsert.length > 0) {
      const ok = await syncUpsert("notes", toUpsert);
      if (!ok) {
        for (const n of toUpsert) dirtyIdsRef.current.add(n.id);
        setSyncStatus("error");
        return;
      }
    }

    setSyncStatus("synced");
    setLastSynced(new Date().toISOString());
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
  }, [syncNow]);

  const addNote = useCallback((type: "note" | "postit" = "note"): string => {
    const id  = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const note: Note = { id, title: "", body: "", pinned: false, type, created_at: now, updated_at: now };
    markDirty(id);
    setNotes(prev => [note, ...prev]);
    return id;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => {
    markDirty(id);
    setNotes(prev => prev.map(n => n.id === id ? stamp({ ...n, ...updates }) : n));
  }, []);

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
  }, []);

  const pinNote = useCallback((id: string) => {
    markDirty(id);
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
