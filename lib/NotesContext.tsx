import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { syncDelete } from "./supabase";
import { dbLoadNotes, dbSaveNotes } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";

export type BlockType = "heading" | "text" | "bullet" | "checkbox";

export type Block = {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  blocks?: Block[];        // structured block content — takes priority over body when present
  pinned: boolean;
  type: "note" | "postit";
  created_at: string;
  updated_at?: string;
};

// Split into data / sync / actions contexts — see TasksContext for rationale.
type NotesData = {
  notes: Note[];
  loaded: boolean;
};

type NotesSync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: () => Promise<void>;
};

type NotesActions = {
  addNote: (type?: "note" | "postit") => string;
  bulkAddNotes: (notes: Note[]) => void;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => void;
  deleteNote: (id: string) => () => void;
  pinNote: (id: string) => void;
  toggleBlockCheck: (noteId: string, blockId: string) => void;
};

const NotesDataContext    = createContext<NotesData | null>(null);
const NotesSyncContext    = createContext<NotesSync | null>(null);
const NotesActionsContext = createContext<NotesActions | null>(null);

function stamp(note: Note): Note {
  return { ...note, updated_at: new Date().toISOString() };
}

/**
 * Coerce a possibly-malformed note into a well-formed one. Older rows, rows
 * synced from another client, or partially-written records may be missing
 * `body`/`title` (or have them as null), which crashes every screen that calls
 * `note.body.trim()` / `.split()` / `.toLowerCase()`. Normalising once on load
 * and on every remote merge guarantees those fields are always strings.
 */
const EPOCH = new Date(0).toISOString();

function normalizeNote(n: Note): Note {
  // `created_at`/`updated_at` are relied on by date sorts (`.localeCompare`) on
  // every screen. A row missing both crashes the sort, so guarantee a string.
  const created = typeof n.created_at === "string" && n.created_at ? n.created_at : EPOCH;
  return {
    ...n,
    title:  typeof n.title === "string" ? n.title : "",
    body:   typeof n.body  === "string" ? n.body  : "",
    pinned: !!n.pinned,
    type:   n.type === "postit" ? "postit" : "note",
    created_at: created,
    updated_at: typeof n.updated_at === "string" && n.updated_at ? n.updated_at : created,
  };
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
        // Re-throw on DB error — see TasksContext for rationale.
        const dbNotes = await dbLoadNotes() as Note[];
        if (dbNotes.length > 0) return dbNotes.map(normalizeNote);
        const stored = await storage.get<Note[]>("notes") ?? [];
        if (stored.length > 0) await dbSaveNotes(stored);
        return stored.map(normalizeNote);
      }
      return (await storage.get<Note[]>("notes") ?? []).map(normalizeNote);
    },
    saveLocal: (items) => {
      if (Platform.OS !== "web") dbSaveNotes(items).catch(console.error);
    },
    // Coerce remote rows — older rows may be missing type/body/title.
    normalizeRemote: (row) => normalizeNote(row),
  });

  const addNote = useCallback((type: "note" | "postit" = "note"): string => {
    const id  = newId();
    const now = new Date().toISOString();
    // Both notes and post-its are plain markdown `body` strings — one editable
    // TextInput, so text is fully selectable/copyable. (Legacy block notes are
    // converted to markdown by migrateBlocksToBody.)
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

  const bulkAddNotes = useCallback((newNotes: Note[]) => {
    if (newNotes.length === 0) return;
    for (const n of newNotes) markDirty(n.id);
    setNotes(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const toAdd = newNotes.filter(n => !existingIds.has(n.id));
      return [...toAdd, ...prev];
    });
  }, [markDirty, setNotes]);

  const toggleBlockCheck = useCallback((noteId: string, blockId: string) => {
    markDirty(noteId);
    setNotes(prev => prev.map(n => {
      if (n.id !== noteId || !n.blocks) return n;
      return stamp({
        ...n,
        blocks: n.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked } : b),
      });
    }));
  }, [markDirty, setNotes]);

  const pinNote = useCallback((id: string) => {
    markDirty(id);
    setNotes(prev => prev.map(n => n.id === id ? stamp({ ...n, pinned: !n.pinned }) : n));
  }, [markDirty, setNotes]);

  const dataValue = useMemo(() => ({ notes, loaded }), [notes, loaded]);
  const syncValue = useMemo(
    () => ({ syncStatus, lastSynced, syncNow }),
    [syncStatus, lastSynced, syncNow]
  );
  const actionsValue = useMemo(
    () => ({ addNote, bulkAddNotes, updateNote, deleteNote, pinNote, toggleBlockCheck }),
    [addNote, bulkAddNotes, updateNote, deleteNote, pinNote, toggleBlockCheck]
  );

  return (
    <NotesDataContext.Provider value={dataValue}>
      <NotesSyncContext.Provider value={syncValue}>
        <NotesActionsContext.Provider value={actionsValue}>
          {children}
        </NotesActionsContext.Provider>
      </NotesSyncContext.Provider>
    </NotesDataContext.Provider>
  );
}

export function useNotesData(): NotesData {
  const ctx = useContext(NotesDataContext);
  if (!ctx) throw new Error("useNotesData must be used within NotesProvider");
  return ctx;
}

export function useNotesSync(): NotesSync {
  const ctx = useContext(NotesSyncContext);
  if (!ctx) throw new Error("useNotesSync must be used within NotesProvider");
  return ctx;
}

export function useNotesActions(): NotesActions {
  const ctx = useContext(NotesActionsContext);
  if (!ctx) throw new Error("useNotesActions must be used within NotesProvider");
  return ctx;
}

/**
 * @deprecated Compatibility alias — re-renders on every data AND sync change.
 * Prefer useNotesData / useNotesActions / useNotesSync.
 */
export function useNotes(): NotesData & NotesSync & NotesActions {
  const data    = useNotesData();
  const sync    = useNotesSync();
  const actions = useNotesActions();
  return useMemo(() => ({ ...data, ...sync, ...actions }), [data, sync, actions]);
}
