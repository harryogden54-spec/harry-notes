import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { storage } from "./storage";
import { syncFetch, syncUpsert } from "./supabase";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

type HasId = { id: string; created_at: string; updated_at?: string };

type Config<T extends HasId> = {
  table: string;
  storageKey: string;
  /** Load items from the platform-local store (SQLite on native, AsyncStorage on web). */
  loadLocal: () => Promise<T[]>;
  /** Persist to platform-local store. Called fire-and-forget; handle own errors. */
  saveLocal: (items: T[]) => void;
  /** Optional post-load transform — e.g. auto-archive. Returns items + dirty IDs. */
  onLoad?: (items: T[]) => { items: T[]; dirty: string[] };
  /** Optional transform applied to each remote row before merging — e.g. type coercion.
   *  Receives the row with _updated_at already stripped. */
  normalizeRemote?: (row: T) => T;
  /** How to merge when remote wins (has newer updated_at). Defaults to replacing local. */
  mergeRow?: (local: T, remote: T) => T;
};

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
  const pendingDeletesRef = useRef<Set<string>>(new Set());
  const dirtyIdsRef       = useRef<Set<string>>(new Set());

  useEffect(() => { itemsRef.current = items; }, [items]);

  const markDirty = useCallback((...ids: string[]) => {
    for (const id of ids) dirtyIdsRef.current.add(id);
  }, []);

  // ─── Persist locally + debounced Supabase upsert ─────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set(storageKey, items);
    saveLocal(items);

    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(async () => {
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
    }, 1500);
  }, [items]); // deps intentionally limited to items

  // ─── Merge helper (used in both initial load and syncNow) ─────────────────────
  // All mutable state accessed via refs — safe to capture at first render.
  const doMerge = useCallback((current: T[], remote: (T & { _updated_at?: string })[]): T[] => {
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
      } else {
        const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
        const remoteUp = _updated_at ?? rem.updated_at ?? "";
        if (remoteUp > localUp) {
          merged[idx] = mergeRow ? mergeRow(merged[idx], rem) : rem;
        }
      }
    }
    // Strip items pending deletion — remote may have returned them before the
    // delete propagated, or a sibling mutation may have re-added them locally.
    return merged.filter(t => !pendingDeletesRef.current.has(t.id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        for (const id of result.dirty) dirtyIdsRef.current.add(id);
      }
      setItems(local);
      loadedRef.current = true;
      setLoaded(true);

      setSyncStatus("syncing");
      const fetchResult = await syncFetch<T & { _updated_at: string }>(table);
      if (!fetchResult.ok) { setSyncStatus("error"); return; }
      const remote = fetchResult.rows;

      if (remote.length === 0 && local.length > 0) {
        const ok = await syncUpsert(table, local);
        setSyncStatus(ok ? "synced" : "error");
        if (ok) setLastSynced(new Date().toISOString());
        return;
      }

      const merged = doMerge(itemsRef.current, remote);
      setItems(merged);

      const remoteMap = new Map(remote.map(r => [r.id, r]));
      const toUpsert = merged.filter(t => {
        const rem = remoteMap.get(t.id);
        const localUp  = t.updated_at ?? t.created_at;
        const remoteUp = rem ? (rem._updated_at ?? rem.updated_at ?? "") : "";
        return localUp > remoteUp;
      });
      if (toUpsert.length > 0) {
        const ok = await syncUpsert(table, toUpsert);
        if (!ok) for (const t of toUpsert) dirtyIdsRef.current.add(t.id);
      }
      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    }).catch((e) => {
      // loadLocal threw (e.g. DB error on native). Mark as loaded so the UI
      // isn't stuck in a spinner — the user sees the error state and can retry.
      clearTimeout(loadTimeout);
      console.warn(`[useSyncedCollection:${table}] loadLocal failed:`, e);
      loadedRef.current = true;
      setLoaded(true);
      setSyncStatus("error");
    });

    return () => clearTimeout(loadTimeout);
  }, []); // run once on mount

  // ─── Manual sync ─────────────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    setSyncStatus("syncing");

    // Snapshot items BEFORE the async fetch. Any writes that arrive during the
    // await are captured in dirtyIdsRef and re-integrated below, rather than
    // being overwritten by setItems(merged) using a stale snapshot.
    const preSnapshot = itemsRef.current;

    const fetchResult = await syncFetch<T & { _updated_at: string }>(table);
    if (!fetchResult.ok) { setSyncStatus("error"); return; }
    const remote = fetchResult.rows;
    const remoteMap = new Map(remote.map(r => [r.id, r]));

    const merged = doMerge(preSnapshot, remote);

    // Re-integrate writes that landed DURING the fetch (in itemsRef.current
    // now but not in preSnapshot). They're already in dirtyIdsRef so they'll
    // be upserted below; here we just make sure the UI doesn't lose them.
    const mergedMap = new Map(merged.map(t => [t.id, t] as [string, T]));
    for (const item of itemsRef.current) {
      if (pendingDeletesRef.current.has(item.id)) continue;
      const existing = mergedMap.get(item.id);
      if (!existing) {
        mergedMap.set(item.id, item);
      } else {
        const currUp  = item.updated_at ?? item.created_at;
        const existUp = existing.updated_at ?? existing.created_at;
        if (currUp > existUp) mergedMap.set(item.id, item);
      }
    }
    const finalMerged = Array.from(mergedMap.values());
    setItems(finalMerged);

    const toUpsert = finalMerged.filter(t => {
      if (dirtyIdsRef.current.has(t.id)) return true;
      const rem = remoteMap.get(t.id);
      const localUp  = t.updated_at ?? t.created_at;
      const remoteUp = rem ? (rem._updated_at ?? rem.updated_at ?? "") : "";
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
    setSyncStatus("synced");
    setLastSynced(new Date().toISOString());
  }, [doMerge]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Foreground sync ─────────────────────────────────────────────────────────
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

  return {
    items, setItems, loaded,
    syncStatus, setSyncStatus,
    lastSynced,
    itemsRef, loadedRef,
    pendingDeletesRef, dirtyIdsRef,
    markDirty, syncNow,
  };
}
