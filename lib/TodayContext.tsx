import React, { createContext, useContext, useCallback, useMemo, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "./storage";
import { dbLoadTodayItems, dbSaveTodayItems } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";
import { getLocalDateStr } from "./utils";

/**
 * Today screen sync (July 11 batch).
 *
 * Previously the Today checklist lived ONLY in per-day AsyncStorage keys
 * (`today_items_<date>`, see the old lib/todayCarry.ts) — nothing synced, so
 * phone and desktop showed unrelated lists. This context brings Today onto
 * the same split data/sync/actions + useSyncedCollection pattern as
 * Tasks/Notes/Lists/Courses/Dumps: ALL days' items live in one store (table
 * `today_items`), the screen filters to the current date, and manual
 * ordering is preserved via an explicit numeric `order` field (Tasks does NOT
 * sync its manual order — this domain intentionally does, per product
 * requirement, since Today's whole point is a daily plan).
 */
export type TodayItem = {
  id: string;
  date: string; // YYYY-MM-DD — which day this item belongs to
  text: string;
  done: boolean;
  time_block?: string; // "09:00" — used by timeline view
  order: number; // manual ordering within a day; lower = earlier/top
  created_at: string;
  updated_at?: string;
};

type TodayData = {
  items: TodayItem[]; // ALL days
  loaded: boolean;
};

type TodaySync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: (opts?: { full?: boolean }) => Promise<boolean>;
};

type TodayActions = {
  addItem: (text: string) => string;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => () => void;
  updateItemTime: (id: string, time: string | undefined) => void;
  /** Web ↑/↓ affordance — swaps order with the adjacent active item for `date`. */
  moveItem: (id: string, date: string, direction: "up" | "down") => void;
  /** Native drag-and-drop end — `newActiveOrder` is the full reordered list of
   *  active (not-done) items for `date`, in their new top-to-bottom order. */
  reorderActive: (date: string, newActiveOrder: TodayItem[]) => void;
};

const TodayDataContext    = createContext<TodayData | null>(null);
const TodaySyncContext    = createContext<TodaySync | null>(null);
const TodayActionsContext = createContext<TodayActions | null>(null);

function stamp(item: TodayItem): TodayItem {
  return { ...item, updated_at: new Date().toISOString() };
}

const EPOCH = new Date(0).toISOString();

/** Coerce a possibly-malformed item (older schema / other client / imported
 *  from the legacy per-day AsyncStorage keys) into a well-formed one. */
function normalizeTodayItem(t: TodayItem): TodayItem {
  const created = typeof t.created_at === "string" && t.created_at ? t.created_at : EPOCH;
  return {
    ...t,
    date: typeof t.date === "string" && t.date ? t.date : getLocalDateStr(),
    text: typeof t.text === "string" ? t.text : "",
    done: !!t.done,
    order: typeof t.order === "number" && Number.isFinite(t.order) ? t.order : 0,
    created_at: created,
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── One-time import from the legacy per-day AsyncStorage keys ───────────────
// The old todayCarry.ts stored each day under `today_items_<date>` with a
// narrower shape (no `order`, no sync). On first run of this context (i.e. the
// new "today_items" store is empty) we pull every existing legacy key into the
// new shape so nothing the user already typed disappears, then remove the old
// keys. This only ever runs once per device: once the new store has any rows,
// loadLocal's own "stored.length > 0" check short-circuits before this runs.
const LEGACY_PREFIX = "today_items_";

type LegacyTodayItem = { id: string; text: string; done: boolean; time_block?: string };

async function importLegacyTodayItems(): Promise<TodayItem[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const dayKeys = allKeys.filter(k => k.startsWith(LEGACY_PREFIX)).sort();
    if (dayKeys.length === 0) return [];

    const imported: TodayItem[] = [];
    for (const key of dayKeys) {
      const date = key.slice(LEGACY_PREFIX.length);
      const legacyItems = (await storage.get<LegacyTodayItem[]>(key)) ?? [];
      legacyItems.forEach((item, idx) => {
        if (!item || typeof item.text !== "string") return;
        const now = new Date().toISOString();
        imported.push({
          id: item.id || newId(),
          date,
          text: item.text,
          done: !!item.done,
          time_block: item.time_block,
          order: idx,
          created_at: now,
          updated_at: now,
        });
      });
    }

    // Clean up the legacy keys only after we've successfully read them all —
    // if parsing threw above we'd have bailed to the catch below and left them.
    if (dayKeys.length > 0) await AsyncStorage.multiRemove(dayKeys);
    return imported;
  } catch {
    // Non-critical — never block Today's load on an import hiccup. Legacy
    // keys are left in place so a retry on next launch can still find them.
    return [];
  }
}

/**
 * Carry incomplete items forward across a day boundary (replaces the old
 * lib/todayCarry.ts, now folded into the sync engine's onLoad hook).
 *
 * Idempotent + conflict-safe by construction: it only ever rewrites the
 * `date` field (same id) of items that are `!done` and whose `date` is
 * strictly before today. Two devices carrying forward the same stale item
 * concurrently both set `date` to today's string — identical outcomes, so
 * last-write-wins merge in useSyncedCollection converges cleanly regardless
 * of which write "wins". Running it twice the same day is a no-op (the
 * items in question no longer have date < today). Completed items are never
 * touched here — they keep their original date, which is what the retention
 * sweep below keys off.
 */
function carryForwardToday(items: TodayItem[]): { items: TodayItem[]; dirty: string[] } {
  const todayStr = getLocalDateStr();
  const dirty: string[] = [];

  // Carried items are appended to the end of today's active order (mirrors
  // the old todayCarry.ts behavior of pushing carried items after whatever
  // was already in today's list) rather than colliding with today's order
  // values.
  const todaysActiveOrders = items
    .filter(i => !i.done && i.date === todayStr)
    .map(i => i.order);
  let nextOrder = todaysActiveOrders.length > 0 ? Math.max(...todaysActiveOrders) + 1 : 0;

  const updated = items.map(item => {
    if (!item.done && item.date < todayStr) {
      dirty.push(item.id);
      return stamp({ ...item, date: todayStr, order: nextOrder++ });
    }
    return item;
  });

  return { items: updated, dirty };
}

export function TodayProvider({ children }: { children: React.ReactNode }) {
  const {
    items, setItems, loaded, syncStatus, lastSynced,
    itemsRef,
    markDirty, markLocallyDeleted, syncNow,
  } = useSyncedCollection<TodayItem>({
    table: "today_items",
    storageKey: "today_items",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        // Re-throw on DB error — see TasksContext for rationale: the caller
        // (useSyncedCollection) surfaces syncStatus:"error" rather than
        // silently falling back to a possibly-stale AsyncStorage mirror.
        const dbItems = await dbLoadTodayItems() as TodayItem[];
        if (dbItems.length > 0) return dbItems.map(normalizeTodayItem);
        const stored = await storage.get<TodayItem[]>("today_items") ?? [];
        if (stored.length > 0) {
          await dbSaveTodayItems(stored);
          return stored.map(normalizeTodayItem);
        }
        // Nothing in the new store yet on this device — one-time import from
        // the legacy today_items_<date> AsyncStorage keys.
        const imported = await importLegacyTodayItems();
        if (imported.length > 0) await dbSaveTodayItems(imported);
        return imported.map(normalizeTodayItem);
      }
      const stored = await storage.get<TodayItem[]>("today_items") ?? [];
      if (stored.length > 0) return stored.map(normalizeTodayItem);
      return (await importLegacyTodayItems()).map(normalizeTodayItem);
    },
    saveLocal: (curItems, changes) => {
      if (Platform.OS !== "web") dbSaveTodayItems(curItems, changes).catch(console.error);
    },
    onLoad: (loadedItems) => carryForwardToday(loadedItems),
    normalizeRemote: (row) => normalizeTodayItem(row),
  });

  // No retention sweep: completed items stay forever (user request 2026-07-12
  // — "no longer remove items from 'today' after a day, just leave them
  // there"). They can still be deleted manually via deleteItem.

  const addItem = useCallback((text: string): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const todayStr = getLocalDateStr();
    const current = itemsRef.current;
    const activeOrders = current
      .filter(i => !i.done && i.date === todayStr)
      .map(i => i.order);
    // New items appear at the top of today's active list (mirrors the old
    // screen's unshift-to-front behavior).
    const order = activeOrders.length > 0 ? Math.min(...activeOrders) - 1 : 0;
    markDirty(id);
    setItems(prev => [...prev, stamp({
      id, date: todayStr, text, done: false, order, created_at: now,
    })]);
    return id;
  }, [markDirty, setItems, itemsRef]);

  const toggleItem = useCallback((id: string) => {
    markDirty(id);
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const done = !item.done;
      const sameDay = prev.filter(i => i.date === item.date);
      let order: number;
      if (done) {
        // Move to the end of the day's list (active or done) — matches the
        // old screen pushing newly-completed items to the bottom.
        const maxOrder = sameDay.reduce((m, i) => Math.max(m, i.order), 0);
        order = maxOrder + 1;
      } else {
        // Move back to the top of the day's active list.
        const activeOrders = sameDay.filter(i => !i.done && i.id !== id).map(i => i.order);
        order = activeOrders.length > 0 ? Math.min(0, ...activeOrders) - 1 : 0;
      }
      return prev.map(i => i.id === id ? stamp({ ...i, done, order }) : i);
    });
  }, [markDirty, setItems]);

  const deleteItem = useCallback((id: string): (() => void) => {
    const deleted = itemsRef.current.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    // Removes the SQLite row on next flush AND queues the remote tombstone
    // (retried by the sync hook until it lands).
    markLocallyDeleted(id);
    return () => {
      if (deleted) {
        markDirty(id); // cancels the queued tombstone / resurrects if sent
        setItems(prev => [...prev, deleted]);
      }
    };
  }, [itemsRef, markLocallyDeleted, markDirty, setItems]);

  const updateItemTime = useCallback((id: string, time: string | undefined) => {
    markDirty(id);
    setItems(prev => prev.map(i => i.id === id ? stamp({ ...i, time_block: time }) : i));
  }, [markDirty, setItems]);

  // Shared reorder core: given the day's active items in their new top-to-
  // bottom order, assign sequential `order` values and mark only the items
  // whose order actually changed as dirty (a drag typically shifts a handful
  // of items, not the whole day).
  const reorderActive = useCallback((date: string, newActiveOrder: TodayItem[]) => {
    const orderMap = new Map(newActiveOrder.map((it, idx) => [it.id, idx]));
    const current = itemsRef.current;
    const changedIds: string[] = [];
    for (const item of current) {
      if (item.date !== date || item.done) continue;
      const next = orderMap.get(item.id);
      if (next !== undefined && next !== item.order) changedIds.push(item.id);
    }
    if (changedIds.length === 0) return;
    markDirty(...changedIds);
    setItems(prev => prev.map(i => {
      if (i.date !== date || i.done) return i;
      const next = orderMap.get(i.id);
      if (next === undefined || next === i.order) return i;
      return stamp({ ...i, order: next });
    }));
  }, [markDirty, setItems, itemsRef]);

  const moveItem = useCallback((id: string, date: string, direction: "up" | "down") => {
    const activeToday = itemsRef.current
      .filter(i => i.date === date && !i.done)
      .sort((a, b) => a.order - b.order);
    const idx = activeToday.findIndex(i => i.id === id);
    if (idx === -1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= activeToday.length) return;
    const next = [...activeToday];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    reorderActive(date, next);
  }, [itemsRef, reorderActive]);

  const dataValue = useMemo(() => ({ items, loaded }), [items, loaded]);
  const syncValue = useMemo(
    () => ({ syncStatus, lastSynced, syncNow }),
    [syncStatus, lastSynced, syncNow]
  );
  const actionsValue = useMemo(
    () => ({ addItem, toggleItem, deleteItem, updateItemTime, moveItem, reorderActive }),
    [addItem, toggleItem, deleteItem, updateItemTime, moveItem, reorderActive]
  );

  return (
    <TodayDataContext.Provider value={dataValue}>
      <TodaySyncContext.Provider value={syncValue}>
        <TodayActionsContext.Provider value={actionsValue}>
          {children}
        </TodayActionsContext.Provider>
      </TodaySyncContext.Provider>
    </TodayDataContext.Provider>
  );
}

export function useTodayData(): TodayData {
  const ctx = useContext(TodayDataContext);
  if (!ctx) throw new Error("useTodayData must be used within TodayProvider");
  return ctx;
}

export function useTodaySync(): TodaySync {
  const ctx = useContext(TodaySyncContext);
  if (!ctx) throw new Error("useTodaySync must be used within TodayProvider");
  return ctx;
}

export function useTodayActions(): TodayActions {
  const ctx = useContext(TodayActionsContext);
  if (!ctx) throw new Error("useTodayActions must be used within TodayProvider");
  return ctx;
}
