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
  /** Optional transform applied to each remote row before merging — e.g. type coercion. */
  normalizeRemote?: (row: T & { _updated_at?: string }) => T;
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
      const ok = await syncUpsert(table, dirty);
      if (!ok) {
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
      const rem: T = normalizeRemote ? normalizeRemote(rawRem) : rest as T;
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
    return merged;
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
    }).catch(() => { clearTimeout(loadTimeout); setSyncStatus("error"); });

    return () => clearTimeout(loadTimeout);
  }, []); // run once on mount

  // ─── Manual sync ─────────────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    setSyncStatus("syncing");
    const fetchResult = await syncFetch<T & { _updated_at: string }>(table);
    if (!fetchResult.ok) { setSyncStatus("error"); return; }
    const remote = fetchResult.rows;
    const remoteMap = new Map(remote.map(r => [r.id, r]));

    const merged = doMerge(itemsRef.current, remote);
    setItems(merged);

    const toUpsert = merged.filter(t => {
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
