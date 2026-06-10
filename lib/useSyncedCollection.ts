import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { storage } from "./storage";
import { syncFetch, syncUpsert, SYNC_ENABLED } from "./supabase";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

type HasId = { id: string; created_at: string; updated_at?: string };

/** Which rows changed since the last local save — lets dbSave* write only
 *  dirty rows instead of rewriting the whole table. `full: true` forces the
 *  old write-everything + delete-missing reconciliation pass. */
export type SaveChanges = {
  dirtyIds: ReadonlySet<string>;
  deletedIds: ReadonlySet<string>;
  full: boolean;
};

type Config<T extends HasId> = {
  table: string;
  storageKey: string;
  /** Load items from the platform-local store (SQLite on native, AsyncStorage on web). */
  loadLocal: () => Promise<T[]>;
  /** Persist to platform-local store. Called fire-and-forget; handle own errors. */
  saveLocal: (items: T[], changes: SaveChanges) => void;
  /** Optional post-load transform — e.g. auto-archive. Returns items + dirty IDs. */
  onLoad?: (items: T[]) => { items: T[]; dirty: string[] };
  /** Optional transform applied to each remote row before merging — e.g. type coercion.
   *  Receives the row with _updated_at already stripped. */
  normalizeRemote?: (row: T) => T;
  /** How to merge when remote wins (has newer updated_at). Defaults to replacing local. */
  mergeRow?: (local: T, remote: T) => T;
};

// Local persistence (AsyncStorage mirror + SQLite) — short debounce so typing
// doesn't serialize the whole collection per keystroke; flushed on background.
const LOCAL_PERSIST_DEBOUNCE_MS = 800;
// Supabase upload debounce (unchanged from the original design).
const REMOTE_SYNC_DEBOUNCE_MS = 1500;
// Automatic foreground syncs are throttled; explicit syncNow() is not.
const FOREGROUND_SYNC_MIN_INTERVAL_MS = 60_000;
// A cursor older than this falls back to a full reconciliation fetch.
const CURSOR_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function useSyncedCollection<T extends HasId>(config: Config<T>) {
  const {
    table, storageKey, loadLocal, saveLocal,
    onLoad, normalizeRemote, mergeRow,
  } = config;

  const [items, setItems]           = useState<T[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const loadedRef         = useRef(false);
  const itemsRef          = useRef<T[]>([]);
  const syncDebounce      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localDebounce     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletesRef = useRef<Set<string>>(new Set());
  // Rows needing upload to Supabase (user edits only).
  const dirtyIdsRef       = useRef<Set<string>>(new Set());
  // Rows needing a local (SQLite) write — superset of dirtyIdsRef: also fed by
  // remote-merge changes and onLoad transforms, which must persist locally but
  // must NOT re-upload.
  const localDirtyRef     = useRef<Set<string>>(new Set());
  // Rows whose local DB row must be deleted (user deletes + remote tombstones).
  const localDeletesRef   = useRef<Set<string>>(new Set());
  // Next local flush rewrites everything (first-install, post-reconciliation).
  const fullSaveRef       = useRef(false);
  const syncInFlightRef   = useRef(false);
  const lastSyncAtRef     = useRef(0);
  // undefined = not yet loaded from storage; null = no cursor stored.
  const cursorRef         = useRef<string | null | undefined>(undefined);
  const cursorKey         = `sync:cursor:${table}`;

  useEffect(() => { itemsRef.current = items; }, [items]);

  const markDirty = useCallback((...ids: string[]) => {
    for (const id of ids) {
      dirtyIdsRef.current.add(id);
      localDirtyRef.current.add(id);
      // A row being written back (e.g. delete undo) is no longer deleted.
      localDeletesRef.current.delete(id);
    }
  }, []);

  /** Record a local deletion so the next local flush removes the DB row.
   *  (The Supabase tombstone is sent separately by the context's delete action.) */
  const markLocallyDeleted = useCallback((...ids: string[]) => {
    for (const id of ids) {
      localDeletesRef.current.add(id);
      localDirtyRef.current.delete(id);
      dirtyIdsRef.current.delete(id);
    }
  }, []);

  // ─── Local persistence (debounced, dirty-aware) ──────────────────────────────
  const flushLocalNow = useCallback(() => {
    if (localDebounce.current) { clearTimeout(localDebounce.current); localDebounce.current = null; }
    if (!loadedRef.current) return;
    const current = itemsRef.current;
    // The AsyncStorage mirror is whole-collection by design: it's the primary
    // store on web and also captures non-dirty changes like manual reordering.
    storage.set(storageKey, current);
    const full = fullSaveRef.current;
    if (full || localDirtyRef.current.size > 0 || localDeletesRef.current.size > 0) {
      const dirtyIds   = new Set(localDirtyRef.current);
      const deletedIds = new Set(localDeletesRef.current);
      localDirtyRef.current.clear();
      localDeletesRef.current.clear();
      fullSaveRef.current = false;
      saveLocal(current, { dirtyIds, deletedIds, full });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Remote upload (debounced, dirty-only) ───────────────────────────────────
  const flushRemoteNow = useCallback(async () => {
    if (syncDebounce.current) { clearTimeout(syncDebounce.current); syncDebounce.current = null; }
    if (!SYNC_ENABLED) return;
    const dirtyIds = dirtyIdsRef.current;
    if (dirtyIds.size === 0) return;
    const dirty = itemsRef.current.filter(t => dirtyIds.has(t.id));
    if (dirty.length === 0) { dirtyIds.clear(); return; }
    const pushedIds = dirty.map(t => t.id);
    dirtyIds.clear();
    setSyncStatus("syncing");
    try {
      const ok = await syncUpsert(table, dirty);
      if (!ok) {
        for (const id of pushedIds) dirtyIds.add(id);
        setSyncStatus("error");
      } else {
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
      }
    } catch {
      // Network error — restore dirty IDs so next sync retries them
      for (const id of pushedIds) dirtyIds.add(id);
      setSyncStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  // ─── Persist on every items change (both paths debounced) ────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loadedRef.current) return;
    if (localDebounce.current) clearTimeout(localDebounce.current);
    localDebounce.current = setTimeout(flushLocalNow, LOCAL_PERSIST_DEBOUNCE_MS);

    if (!SYNC_ENABLED) return;
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(flushRemoteNow, REMOTE_SYNC_DEBOUNCE_MS);
  }, [items]); // deps intentionally limited to items

  // ─── Delta cursor ─────────────────────────────────────────────────────────────
  const loadCursor = useCallback(async (): Promise<string | null> => {
    if (cursorRef.current === undefined) {
      cursorRef.current = (await storage.get<string>(cursorKey)) ?? null;
    }
    return cursorRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceCursor = useCallback((serverMax: string | null) => {
    if (!serverMax) return;
    if (typeof cursorRef.current === "string" && serverMax <= cursorRef.current) return;
    cursorRef.current = serverMax;
    storage.set(cursorKey, serverMax);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Merge helper ─────────────────────────────────────────────────────────────
  // All mutable state accessed via refs — safe to capture at first render.
  const doMerge = useCallback((
    current: T[],
    remote: (T & { _updated_at?: string })[],
    remoteDeletedIds: string[],
  ): T[] => {
    const merged = [...current];
    for (const rawRem of remote) {
      if (pendingDeletesRef.current.has(rawRem.id)) continue;
      const { _updated_at, ...rest } = rawRem as any;
      // Always strip _updated_at before handing to the normalizer so it never
      // leaks into in-memory state and gets cloned on every stamp() call.
      const rem: T = normalizeRemote ? normalizeRemote(rest as T & { _updated_at?: string }) : rest as T;
      const idx = merged.findIndex(t => t.id === rem.id);
      if (idx === -1) {
        merged.push(rem);
        localDirtyRef.current.add(rem.id);
      } else {
        const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
        const remoteUp = _updated_at ?? rem.updated_at ?? "";
        if (remoteUp > localUp) {
          merged[idx] = mergeRow ? mergeRow(merged[idx], rem) : rem;
          localDirtyRef.current.add(rem.id);
        }
      }
    }
    // Apply remote tombstones — skip rows we deleted ourselves (already gone)
    // and rows with a pending local edit (the edit re-upserts and resurrects).
    let removeIds: Set<string> | null = null;
    for (const id of remoteDeletedIds) {
      if (pendingDeletesRef.current.has(id)) continue;
      if (dirtyIdsRef.current.has(id)) continue;
      if (!removeIds) removeIds = new Set();
      removeIds.add(id);
      localDeletesRef.current.add(id);
      localDirtyRef.current.delete(id);
    }
    // Strip items pending deletion — remote may have returned them before the
    // delete propagated, or a sibling mutation may have re-added them locally.
    return merged.filter(t =>
      !pendingDeletesRef.current.has(t.id) && !(removeIds && removeIds.has(t.id))
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sync engine (initial load, foreground, manual) ──────────────────────────
  // Delta fetch by default; full reconciliation fetch when there is no usable
  // cursor or the caller asks for it. The full path is the safety net: deleting
  // the cursor key must always reproduce identical state.
  const performSync = useCallback(async (opts?: { full?: boolean }) => {
    if (!SYNC_ENABLED) return;
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      if (syncDebounce.current) { clearTimeout(syncDebounce.current); syncDebounce.current = null; }
      setSyncStatus("syncing");

      const cursor = await loadCursor();
      const cursorUsable =
        typeof cursor === "string" &&
        Number.isFinite(Date.parse(cursor)) &&
        Date.now() - Date.parse(cursor) < CURSOR_MAX_AGE_MS;
      const isFullFetch = !!opts?.full || !cursorUsable;

      // Snapshot items BEFORE the async fetch. Any writes that arrive during
      // the await are captured in dirtyIdsRef and re-integrated below, rather
      // than being overwritten by setItems(merged) using a stale snapshot.
      const preSnapshot = itemsRef.current;

      const fetchResult = await syncFetch<T & { _updated_at: string }>(
        table, isFullFetch ? null : cursor
      );
      if (!fetchResult.ok) { setSyncStatus("error"); return; }
      const { rows: remote, deletedIds, serverMax } = fetchResult;

      // First sync of a device that already has data against an empty remote →
      // bootstrap-upload everything. Guarded to full fetches: an empty DELTA
      // means "nothing changed", never "remote is empty".
      if (isFullFetch && remote.length === 0 && deletedIds.length === 0 && preSnapshot.length > 0) {
        const ok = await syncUpsert(table, preSnapshot);
        if (!ok) { setSyncStatus("error"); return; }
        lastSyncAtRef.current = Date.now();
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
        return;
      }

      const merged = doMerge(preSnapshot, remote, deletedIds);
      const remoteMap = new Map(remote.map(r => [r.id, r]));

      // Re-integrate writes that landed DURING the fetch (in itemsRef.current
      // now but not in preSnapshot). They're already in dirtyIdsRef so they'll
      // be upserted below; here we just make sure the UI doesn't lose them.
      const mergedMap = new Map(merged.map(t => [t.id, t] as [string, T]));
      for (const item of itemsRef.current) {
        if (pendingDeletesRef.current.has(item.id)) continue;
        const existing = mergedMap.get(item.id);
        if (!existing) {
          if (dirtyIdsRef.current.has(item.id)) mergedMap.set(item.id, item);
        } else {
          const currUp  = item.updated_at ?? item.created_at;
          const existUp = existing.updated_at ?? existing.created_at;
          if (currUp > existUp) mergedMap.set(item.id, item);
        }
      }
      const finalMerged = Array.from(mergedMap.values());
      itemsRef.current = finalMerged;
      setItems(finalMerged);
      // After a reconciliation fetch the merged set is authoritative — rewrite
      // the local DB fully so orphaned rows can't linger.
      if (isFullFetch) fullSaveRef.current = true;

      const toUpsert = finalMerged.filter(t => {
        if (dirtyIdsRef.current.has(t.id)) return true;
        const rem = remoteMap.get(t.id);
        // Not in the response: on a delta that just means "unchanged on the
        // server" — uploading would re-push the whole collection every sync.
        // On a full fetch it means the row only exists locally → upload.
        if (!rem) return isFullFetch;
        const localUp  = t.updated_at ?? t.created_at;
        const remoteUp = rem._updated_at ?? rem.updated_at ?? "";
        return localUp > remoteUp;
      });
      if (toUpsert.length > 0) {
        const ok = await syncUpsert(table, toUpsert);
        if (!ok) {
          for (const t of toUpsert) dirtyIdsRef.current.add(t.id);
          setSyncStatus("error");
          return;
        }
      }

      advanceCursor(serverMax);
      lastSyncAtRef.current = Date.now();
      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    } finally {
      syncInFlightRef.current = false;
    }
  }, [doMerge, loadCursor, advanceCursor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Initial load ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadTimeout = setTimeout(() => {
      if (!loadedRef.current) { loadedRef.current = true; setLoaded(true); }
    }, 3000);

    loadLocal().then(async (raw) => {
      clearTimeout(loadTimeout);
      let local = raw;
      if (onLoad) {
        const result = onLoad(raw);
        local = result.items;
        for (const id of result.dirty) {
          dirtyIdsRef.current.add(id);
          localDirtyRef.current.add(id);
        }
      }
      // Keep the ref fresh synchronously — performSync below may run before
      // React re-renders and the itemsRef effect catches up.
      itemsRef.current = local;
      setItems(local);
      loadedRef.current = true;
      setLoaded(true);

      // Skip remote sync entirely when Supabase isn't configured.
      if (!SYNC_ENABLED) return;
      await performSync();
    }).catch((e) => {
      // loadLocal threw (e.g. DB error on native). Mark as loaded so the UI
      // isn't stuck in a spinner — the user sees the error state and can retry.
      clearTimeout(loadTimeout);
      console.warn(`[useSyncedCollection:${table}] loadLocal failed:`, e);
      loadedRef.current = true;
      setLoaded(true);
      setSyncStatus("error");
    });

    return () => {
      clearTimeout(loadTimeout);
      flushLocalNow();
    };
  }, []); // run once on mount

  // ─── Manual sync ─────────────────────────────────────────────────────────────
  // Always runs (no throttle — every caller is a user gesture). Pass
  // { full: true } for a full reconciliation fetch (Settings → Sync now).
  const syncNow = useCallback(async (opts?: { full?: boolean }) => {
    await performSync(opts);
  }, [performSync]);

  // ─── Foreground / background transitions ─────────────────────────────────────
  // Foreground: throttled delta sync. Background/hidden: flush pending local
  // and remote writes immediately so a process kill can't drop the debounce
  // window.
  useEffect(() => {
    const onForeground = () => {
      if (!loadedRef.current) return;
      if (Date.now() - lastSyncAtRef.current < FOREGROUND_SYNC_MIN_INTERVAL_MS) return;
      performSync();
    };
    const onBackground = () => {
      flushLocalNow();
      flushRemoteNow();
    };

    if (Platform.OS !== "web") {
      const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active") onForeground();
        else onBackground();
      });
      return () => sub.remove();
    }
    const onVisibility = () => {
      if (document.hidden) onBackground();
      else onForeground();
    };
    const onPageHide = () => onBackground();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [performSync, flushLocalNow, flushRemoteNow]);

  return {
    items, setItems, loaded,
    syncStatus, setSyncStatus,
    lastSynced,
    itemsRef, loadedRef,
    pendingDeletesRef, dirtyIdsRef,
    markDirty, markLocallyDeleted, syncNow,
  };
}
