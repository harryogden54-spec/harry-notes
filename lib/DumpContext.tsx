import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { dbLoadDumps, dbSaveDumps } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";
import { getLocalDateStr } from "./utils";

/** `spark` is the brainstem box on the Dump screen — a passing thought, always
 *  dated to the day it was caught. `journal` + a `note_date` is the day's entry:
 *  the calendar and the day panel both key on that pair. Additive to the `data`
 *  jsonb row, so no migration; an older client sees an unknown tag and
 *  normalizeDump below PRESERVES it rather than rewriting or dropping the row. */
export type DumpTag = "journal" | "spark" | "media" | "knowledge" | "todo" | "goal";

export const DUMP_TAGS: DumpTag[] = ["journal", "spark", "media", "knowledge", "todo", "goal"];

/**
 * How far out a goal looks. Named from how the goals were actually written
 * rather than in months: the useful distinction was "before term starts",
 * "once I am there", and "no deadline, but I still want it".
 */
export type GoalHorizon = "month" | "term" | "open";

export const GOAL_HORIZONS: GoalHorizon[] = ["month", "term", "open"];

export const GOAL_HORIZON_LABEL: Record<GoalHorizon, string> = {
  month: "Before uni",
  term:  "First months of uni",
  open:  "No deadline",
};

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
  /**
   * Goals only. Absent on a goal row is treated as "open" by goalHorizon(),
   * so a row that loses the field is never dropped from the list.
   */
  horizon?: GoalHorizon;
  /** Goals only. Achieved goals stay listed — sunk and struck, not deleted. */
  achieved?: boolean;
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

// ─── Goals ───────────────────────────────────────────────────────────────────
//
// A goal is a Dump with `tag: "goal"`, not its own synced collection. A new
// table would need a migration AND a matching RLS policy (see migration 007 —
// the client already sends x-sync-key, but a table without a policy silently
// returns nothing). Additive jsonb fields are the house style here for exactly
// this reason, and a goal really is just a capture with a horizon.
//
// INVARIANT: a goal never carries `note_date`.
// A client older than the 2026-08-28 fix still rewrites an unrecognised tag to
// "journal" (normalizeDump does not any more, but deployed bundles predate
// that). Undated, the damage is limited to the row showing up in the undated
// drawer. Dated, journalFor() would pick it up and it could shadow a real
// day's entry — silent loss on the one thing in this app that must never lose
// anything. `addDump` enforces this rather than trusting callers.

/** Every goal, newest first within its horizon. */
export function goalsOf(dumps: Dump[]): Dump[] {
  return dumps.filter(d => d.tag === "goal" && isFiled(d));
}

/** A goal's horizon, defaulting to "open" so a malformed row still appears. */
export function goalHorizon(d: Dump): GoalHorizon {
  return d.horizon ?? "open";
}

/**
 * Goals for one horizon, achieved ones sunk to the bottom.
 *
 * Sinking rather than hiding follows the notes editor's checked-checklist
 * behaviour (`sinkToggledCheckbox`): the thing you finished should still be
 * visible, just out of the way of the things you have not.
 */
export function goalsForHorizon(dumps: Dump[], horizon: GoalHorizon): Dump[] {
  return goalsOf(dumps)
    .filter(d => goalHorizon(d) === horizon)
    .sort((a, b) => {
      const aDone = a.achieved ? 1 : 0;
      const bDone = b.achieved ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return a.created_at.localeCompare(b.created_at);
    });
}

/**
 * First line of the goal — its title.
 *
 * Same convention as `noteDisplayTitle` in components/notes/utils.ts: one text
 * field, first line reads as the heading, the rest is detail. It avoids a
 * second stored field that would then need its own normalize + merge handling,
 * and it means a goal typed as one line simply has no detail.
 */
export function goalTitle(d: Dump): string {
  const first = d.content.split("\n").find(l => l.trim().length > 0);
  return first?.trim() ?? "";
}

/** Everything after the first non-empty line. */
export function goalDetail(d: Dump): string {
  const lines = d.content.split("\n");
  const i = lines.findIndex(l => l.trim().length > 0);
  if (i === -1) return "";
  return lines.slice(i + 1).join("\n").trim();
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
  addDump: (opts: {
    tag: DumpTag; note_date?: string; content?: string; draft?: boolean;
    horizon?: GoalHorizon;
  }) => string;
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
    // An UNRECOGNISED tag is preserved, never rewritten.
    //
    // This used to coerce to "journal", and that turned a forward-compatibility
    // nicety into a data-destroying one: a client older than a newly-added tag
    // read the row, rewrote the tag to "journal", saved that locally and pushed
    // it back — permanently losing what the row actually was. It happened for
    // real on 2026-08-28, when goals reached a device still running the
    // previous bundle and came back as journal entries in the undated drawer.
    //
    // Preserving the value costs nothing: readers key off specific tags
    // ("journal", "spark", "goal"), so an unknown one simply matches none of
    // them and stays inert until the client that understands it loads. Callers
    // that map a tag to a label must tolerate a miss — see TAG_LABEL in
    // BrowseBox.
    tag:       typeof d.tag === "string" && d.tag ? d.tag : "journal",
    // Absence is a real state now — don't substitute today's date for it.
    note_date: typeof d.note_date === "string" && d.note_date ? d.note_date : undefined,
    filed:     !!d.filed,
    handwritten: d.handwritten === true ? true : undefined,
    // Absent means filed — an older row that predates drafts must not come
    // back as an invisible draft.
    draft:     d.draft === true ? true : undefined,
    horizon:   GOAL_HORIZONS.includes(d.horizon as GoalHorizon) ? d.horizon : undefined,
    achieved:  d.achieved === true ? true : undefined,
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

  const addDump = useCallback((opts: {
    tag: DumpTag; note_date?: string; content?: string; draft?: boolean;
    horizon?: GoalHorizon;
  }): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const isGoal = opts.tag === "goal";
    const dump: Dump = {
      id,
      // Normally empty (the row is created, then typed into). The share target
      // supplies content up-front so the capture lands in one state update.
      content: opts.content ?? "",
      tag: opts.tag,
      // A goal is never dated — see the INVARIANT note above goalsOf(). Enforced
      // here rather than trusted to callers, because the consequence of a dated
      // goal (shadowing a day's journal entry on an older client) is silent.
      note_date: isGoal ? undefined : opts.note_date,
      filed: false,
      draft: opts.draft ? true : undefined,
      horizon: isGoal ? (opts.horizon ?? "open") : undefined,
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
