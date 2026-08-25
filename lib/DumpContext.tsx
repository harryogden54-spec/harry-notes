import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { dbLoadDumps, dbSaveDumps } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";
import { getLocalDateStr } from "./utils";

/** `spark` is the brainstem box on the Dump screen — a passing thought, always
 *  dated to the day it was caught. `journal` + a `note_date` is the day's entry:
 *  the calendar and the day panel both key on that pair. Additive to the `data`
 *  jsonb row, so no migration; an older client just sees an unknown tag and
 *  normalizeDump below coerces it to "journal" rather than dropping the row. */
export type DumpTag = "journal" | "spark" | "media" | "knowledge" | "todo";

export const DUMP_TAGS: DumpTag[] = ["journal", "spark", "media", "knowledge", "todo"];

export type Dump = {
  id: string;
  content: string;
  tag: DumpTag;
  /** YYYY-MM-DD, or absent — a capture doesn't have to be about a day. */
  note_date?: string;
  filed?: boolean;
  /** Journal entries only: the entry was written on paper and transcribed
   *  elsewhere. Purely a label — nothing in the app treats it differently. */
  handwritten?: boolean;
  /**
   * The entry exists but has not been filed yet — the 600ms autosave wrote it
   * so nothing is lost mid-sentence, and Save is what clears the flag.
   *
   * An unfiled draft is deliberately invisible everywhere except the compose
   * box it belongs to: no calendar dot, not in Browse, not counted as the
   * day's entry. That is what lets the compose box stop echoing filed text
   * back at you without a half-finished sentence silently becoming "the day".
   */
  draft?: boolean;
  created_at: string;
  updated_at?: string;
};

/**
 * A capture is "filed" once it is no longer an unfinished draft. Everything
 * that reads the record — the calendar dots, Browse, the day's entry — asks
 * this rather than testing `draft` directly, so the default for old rows
 * (which have no `draft` field at all) is filed.
 */
export function isFiled(d: Dump): boolean {
  return d.draft !== true;
}

/**
 * The day's journal entry, if there is one. Older data can hold more than one
 * journal capture for a date (the pre-2026-08-25 screen let you make as many as
 * you liked), so the most recently touched one wins and the rest stay reachable
 * from the day panel.
 *
 * Drafts are excluded by default: an unfiled draft is not yet "the day's
 * entry". The compose box passes `includeDraft` because it is the one place
 * that must see its own unfinished work.
 */
export function journalFor(dumps: Dump[], date: string, includeDraft = false): Dump | undefined {
  return dumps
    .filter(d => d.tag === "journal" && d.note_date === date && (includeDraft || isFiled(d)))
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0];
}

type DumpsData = {
  dumps: Dump[];
  loaded: boolean;
};

type DumpsSync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: (opts?: { full?: boolean }) => Promise<boolean>;
};

type DumpsActions = {
  addDump: (opts: { tag: DumpTag; note_date?: string; content?: string; draft?: boolean }) => string;
  updateDump: (id: string, updates: Partial<Omit<Dump, "id" | "created_at">>) => void;
  deleteDump: (id: string) => () => void;
};

const DumpsDataContext    = createContext<DumpsData | null>(null);
const DumpsSyncContext    = createContext<DumpsSync | null>(null);
const DumpsActionsContext = createContext<DumpsActions | null>(null);

function stamp(dump: Dump): Dump {
  return { ...dump, updated_at: new Date().toISOString() };
}

const EPOCH = new Date(0).toISOString();

function normalizeDump(d: Dump): Dump {
  const created = typeof d.created_at === "string" && d.created_at ? d.created_at : EPOCH;
  return {
    ...d,
    content:   typeof d.content   === "string" ? d.content   : "",
    tag:       DUMP_TAGS.includes(d.tag as DumpTag) ? d.tag : "journal",
    // Absence is a real state now — don't substitute today's date for it.
    note_date: typeof d.note_date === "string" && d.note_date ? d.note_date : undefined,
    filed:     !!d.filed,
    handwritten: d.handwritten === true ? true : undefined,
    // Absent means filed — an older row that predates drafts must not come
    // back as an invisible draft.
    draft:     d.draft === true ? true : undefined,
    created_at: created,
    updated_at: typeof d.updated_at === "string" && d.updated_at ? d.updated_at : created,
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function DumpProvider({ children }: { children: React.ReactNode }) {
  const {
    items: dumps, setItems: setDumps, loaded, syncStatus, lastSynced,
    itemsRef: dumpsRef,
    markDirty, markLocallyDeleted, syncNow,
  } = useSyncedCollection<Dump>({
    table: "dumps",
    storageKey: "dumps",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        const dbDumps = await dbLoadDumps() as Dump[];
        if (dbDumps.length > 0) return dbDumps.map(normalizeDump);
        const stored = await storage.get<Dump[]>("dumps") ?? [];
        if (stored.length > 0) await dbSaveDumps(stored);
        return stored.map(normalizeDump);
      }
      return (await storage.get<Dump[]>("dumps") ?? []).map(normalizeDump);
    },
    saveLocal: (items, changes) => {
      if (Platform.OS !== "web") dbSaveDumps(items, changes).catch(console.error);
    },
    normalizeRemote: (row) => normalizeDump(row),
  });

  const addDump = useCallback((opts: { tag: DumpTag; note_date?: string; content?: string; draft?: boolean }): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const dump: Dump = {
      id,
      // Normally empty (the row is created, then typed into). The share target
      // supplies content up-front so the capture lands in one state update.
      content: opts.content ?? "",
      tag: opts.tag,
      note_date: opts.note_date,
      filed: false,
      draft: opts.draft ? true : undefined,
      created_at: now,
      updated_at: now,
    };
    markDirty(id);
    setDumps(prev => [dump, ...prev]);
    return id;
  }, [markDirty, setDumps]);

  const updateDump = useCallback((id: string, updates: Partial<Omit<Dump, "id" | "created_at">>) => {
    markDirty(id);
    setDumps(prev => prev.map(d => d.id === id ? stamp({ ...d, ...updates }) : d));
  }, [markDirty, setDumps]);

  const deleteDump = useCallback((id: string): (() => void) => {
    const deleted = dumpsRef.current.find(d => d.id === id);
    setDumps(prev => prev.filter(d => d.id !== id));
    // Removes the SQLite row on next flush AND queues the remote tombstone
    // (retried by the sync hook until it lands).
    markLocallyDeleted(id);
    return () => {
      if (deleted) {
        markDirty(id); // cancels the queued tombstone / resurrects if sent
        setDumps(prev => [deleted, ...prev]);
      }
    };
  }, [dumpsRef, markLocallyDeleted, markDirty, setDumps]);

  const dataValue    = useMemo(() => ({ dumps, loaded }), [dumps, loaded]);
  const syncValue    = useMemo(() => ({ syncStatus, lastSynced, syncNow }), [syncStatus, lastSynced, syncNow]);
  const actionsValue = useMemo(() => ({ addDump, updateDump, deleteDump }), [addDump, updateDump, deleteDump]);

  return (
    <DumpsDataContext.Provider value={dataValue}>
      <DumpsSyncContext.Provider value={syncValue}>
        <DumpsActionsContext.Provider value={actionsValue}>
          {children}
        </DumpsActionsContext.Provider>
      </DumpsSyncContext.Provider>
    </DumpsDataContext.Provider>
  );
}

export function useDumpsData(): DumpsData {
  const ctx = useContext(DumpsDataContext);
  if (!ctx) throw new Error("useDumpsData must be used within DumpProvider");
  return ctx;
}

export function useDumpsSync(): DumpsSync {
  const ctx = useContext(DumpsSyncContext);
  if (!ctx) throw new Error("useDumpsSync must be used within DumpProvider");
  return ctx;
}

export function useDumpsActions(): DumpsActions {
  const ctx = useContext(DumpsActionsContext);
  if (!ctx) throw new Error("useDumpsActions must be used within DumpProvider");
  return ctx;
}
