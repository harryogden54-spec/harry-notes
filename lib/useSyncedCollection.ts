import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { storage } from "./storage";
import { syncFetch, syncFetchByIds, syncUpsert, syncDelete, SYNC_ENABLED } from "./supabase";
import { getSyncKey } from "./syncKey";
import { registerSyncDomain } from "./syncScheduler";
import { mergeThreeWay } from "./textMerge";

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
  /**
   * Opt in to a three-way merge for one long-text field (notes.body).
   *
   * Without it the engine is last-write-wins per row in both directions. The
   * merge below already refuses to let remote clobber an unpushed local edit,
   * but the reverse was unguarded: a device holding a stale copy would push its
   * whole row and silently discard the other device's text. Declaring the field
   * here makes the push path fetch the server's current value first and merge
   * line-by-line instead of overwriting.
   */
  mergeTextField?: Extract<keyof T, string>;
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
    onLoad, normalizeRemote, mergeRow, mergeTextField,
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
  // Remote tombstones still owed to the server. Persisted (and retried) so a
  // killed app can't leave a delete local-only — an unsent tombstone means the
  // row resurrects from the server on the next full fetch.
  const pendingRemoteDeletesRef = useRef<Set<string>>(new Set());
  // undefined = not yet loaded from storage; null = no cursor stored.
  const cursorRef         = useRef<string | null | undefined>(undefined);
  // Value of mergeTextField as of the last time this device and the server
  // agreed on a row — the common ancestor a three-way merge needs. Updated after
  // a successful push and after accepting a remote row.
  const baseTextRef       = useRef<Record<string, string>>({});
  const cursorKey         = `sync:cursor:${table}`;
  const dirtyKey          = `sync:dirty:${table}`;
  const pendingDeleteKey  = `sync:pendingDelete:${table}`;
  const baseTextKey       = `sync:base:${table}`;

  useEffect(() => { itemsRef.current = items; }, [items]);

  // Both sets are tiny (ids of unsynced edits/deletes) — persist them whole,
  // fire-and-forget, every time they change. They are re-hydrated on launch so
  // an app killed mid-debounce retries instead of stranding the edit locally
  // until the next full reconciliation.
  const persistDirty = useCallback(() => {
    storage.set(dirtyKey, Array.from(dirtyIdsRef.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistPendingDeletes = useCallback(() => {
    storage.set(pendingDeleteKey, Array.from(pendingRemoteDeletesRef.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Record the agreed-with-server value of the merge field for a row. */
  const setBaseText = useCallback((id: string, value: unknown) => {
    if (!mergeTextField) return;
    baseTextRef.current[id] = typeof value === "string" ? value : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistBaseText = useCallback(() => {
    if (!mergeTextField) return;
    storage.set(baseTextKey, baseTextRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markDirty = useCallback((...ids: string[]) => {
    for (const id of ids) {
      dirtyIdsRef.current.add(id);
      localDirtyRef.current.add(id);
      // A row being written back (e.g. delete undo) is no longer deleted —
      // cancel the queued tombstone (or resurrect via the coming upsert if the
      // tombstone already went out).
      localDeletesRef.current.delete(id);
      pendingRemoteDeletesRef.current.delete(id);
      pendingDeletesRef.current.delete(id);
    }
    persistDirty();
    persistPendingDeletes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Record a local deletion: removes the DB row on next local flush AND
   *  queues the remote tombstone (sent on the next remote flush, retried until
   *  it succeeds — the contexts no longer call syncDelete themselves). */
  const markLocallyDeleted = useCallback((...ids: string[]) => {
    for (const id of ids) {
      // A non-id in this queue is poison: syncDelete can never land it, so
      // flushRemoteDeletes fails every pass and pins the domain at `error`
      // forever (a literal null did exactly that to courses).
      if (typeof id !== "string" || !id) continue;
      localDeletesRef.current.add(id);
      localDirtyRef.current.delete(id);
      dirtyIdsRef.current.delete(id);
      pendingDeletesRef.current.add(id);
      pendingRemoteDeletesRef.current.add(id);
    }
    persistDirty();
    persistPendingDeletes();
    // Schedule the tombstone upload on the standard remote debounce. Undo
    // within the window cancels it via markDirty; undo after it re-upserts
    // with deleted=false, which resurrects the row server-side.
    if (SYNC_ENABLED) {
      if (syncDebounce.current) clearTimeout(syncDebounce.current);
      syncDebounce.current = setTimeout(() => { flushRemoteNowRef.current(); }, REMOTE_SYNC_DEBOUNCE_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markLocallyDeleted is declared before flushRemoteNow — bridge via a ref.
  const flushRemoteNowRef = useRef<() => Promise<void>>(async () => {});

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

  // ─── Remote tombstones (persisted queue, retried until sent) ─────────────────
  const flushRemoteDeletes = useCallback(async (): Promise<boolean> => {
    if (pendingRemoteDeletesRef.current.size === 0) return true;
    let allOk = true;
    for (const id of Array.from(pendingRemoteDeletesRef.current)) {
      const ok = await syncDelete(table, id);
      if (ok) {
        pendingRemoteDeletesRef.current.delete(id);
        pendingDeletesRef.current.delete(id);
      } else {
        allOk = false; // stays queued — retried on the next flush/sync
      }
    }
    persistPendingDeletes();
    return allOk;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  /**
   * Three-way merge one row's text field against a known remote version.
   * Returns the row unchanged when there is nothing to reconcile, so callers can
   * use referential equality to detect "did anything merge".
   */
  const mergeRowText = useCallback((local: T, remote: T | undefined): T => {
    if (!mergeTextField || !remote) return local;
    const localText  = String((local as any)[mergeTextField] ?? "");
    const remoteText = String((remote as any)[mergeTextField] ?? "");
    if (localText === remoteText) return local;
    const base = baseTextRef.current[local.id] ?? "";
    const { text } = mergeThreeWay(base, localText, remoteText);
    if (text === localText) return local;
    return { ...local, [mergeTextField]: text, updated_at: new Date().toISOString() } as T;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply merged rows to local state so the device doesn't keep its pre-merge
   *  text and re-diverge on the next edit. */
  const applyMerged = useCallback((patched: T[]) => {
    if (patched.length === 0) return;
    const byId = new Map(patched.map(p => [p.id, p]));
    for (const p of patched) localDirtyRef.current.add(p.id);
    const next = itemsRef.current.map(t => byId.get(t.id) ?? t);
    itemsRef.current = next;
    setItems(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Merge dirty rows against the server before pushing, so a stale device can't
   * discard another device's edit. Costs one extra fetch, and only for tables
   * that declare mergeTextField and only when there is something to push.
   *
   * On a failed lookup it returns the input unchanged — degrading to the previous
   * last-write-wins behaviour beats blocking the push entirely.
   */
  const mergeBeforePush = useCallback(async (dirty: T[]): Promise<T[]> => {
    if (!mergeTextField || dirty.length === 0) return dirty;

    const res = await syncFetchByIds<T>(table, dirty.map(d => d.id));
    if (!res.ok) return dirty;

    const remoteById = new Map(res.rows.map(r => [r.id, r]));
    const out: T[] = [];
    const patched: T[] = [];
    for (const local of dirty) {
      const merged = mergeRowText(local, remoteById.get(local.id));
      out.push(merged);
      if (merged !== local) patched.push(merged);
    }
    applyMerged(patched);
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, mergeRowText, applyMerged]);

  // ─── Remote upload (debounced, dirty-only) ───────────────────────────────────
  const flushRemoteNow = useCallback(async () => {
    if (syncDebounce.current) { clearTimeout(syncDebounce.current); syncDebounce.current = null; }
    if (!SYNC_ENABLED) return;
    // No sync key configured — offline-only mode. Bail before touching
    // syncStatus so the UI doesn't report "synced" for a no-op.
    if (!(await getSyncKey())) return;
    const dirtyIds = dirtyIdsRef.current;
    const dirty = itemsRef.current.filter(t => dirtyIds.has(t.id));
    if (dirty.length === 0 && pendingRemoteDeletesRef.current.size === 0) {
      if (dirtyIds.size > 0) { dirtyIds.clear(); persistDirty(); }
      return;
    }
    const pushedIds = dirty.map(t => t.id);
    dirtyIds.clear();
    persistDirty();
    setSyncStatus("syncing");
    try {
      const toPush = await mergeBeforePush(dirty);
      const ok = toPush.length === 0 || await syncUpsert(table, toPush);
      if (!ok) {
        for (const id of pushedIds) dirtyIds.add(id);
        persistDirty();
      } else if (mergeTextField) {
        // Server now holds exactly what we pushed — that is the new common
        // ancestor for the next merge.
        for (const row of toPush) setBaseText(row.id, (row as any)[mergeTextField]);
        persistBaseText();
      }
      const deletesOk = await flushRemoteDeletes();
      if (!ok || !deletesOk) {
        setSyncStatus("error");
      } else {
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
      }
    } catch {
      // Network error — restore dirty IDs so next sync retries them
      for (const id of pushedIds) dirtyIds.add(id);
      persistDirty();
      setSyncStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, flushRemoteDeletes]);
  flushRemoteNowRef.current = flushRemoteNow;

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
        // Local now equals remote → new common ancestor for the text merge.
        if (mergeTextField) baseTextRef.current[rem.id] = String((rem as any)[mergeTextField] ?? "");
      } else {
        const localUp  = merged[idx].updated_at ?? merged[idx].created_at;
        const remoteUp = _updated_at ?? rem.updated_at ?? "";
        // A dirty row is an unpushed local edit — never let remote overwrite
        // it on timestamps alone (remote is server-clock, local is client-clock;
        // skew could wrongly favor remote and silently drop the edit). The edit
        // uploads next flush, after which timestamps agree again.
        if (remoteUp > localUp && !dirtyIdsRef.current.has(rem.id)) {
          merged[idx] = mergeRow ? mergeRow(merged[idx], rem) : rem;
          localDirtyRef.current.add(rem.id);
          if (mergeTextField) baseTextRef.current[rem.id] = String((rem as any)[mergeTextField] ?? "");
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
      // Don't let the merge-base map grow forever with dead ids.
      if (mergeTextField) delete baseTextRef.current[id];
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
  const performSync = useCallback(async (opts?: { full?: boolean }): Promise<boolean> => {
    if (!SYNC_ENABLED) return true;
    // No sync key configured — offline-only mode. Bail before touching
    // syncStatus so the UI doesn't report "synced" for a no-op.
    if (!(await getSyncKey())) return true;
    if (syncInFlightRef.current) return true;
    syncInFlightRef.current = true;
    try {
      if (syncDebounce.current) { clearTimeout(syncDebounce.current); syncDebounce.current = null; }
      setSyncStatus("syncing");

      // Send any owed tombstones first, so the fetch below reflects them and
      // a previously-failed delete can't resurrect through the merge.
      const deletesOk = await flushRemoteDeletes();

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
      if (!fetchResult.ok) { setSyncStatus("error"); return false; }
      const { rows: remote, deletedIds, serverMax } = fetchResult;

      // First sync of a device that already has data against an empty remote →
      // bootstrap-upload everything. Guarded to full fetches: an empty DELTA
      // means "nothing changed", never "remote is empty".
      if (isFullFetch && remote.length === 0 && deletedIds.length === 0 && preSnapshot.length > 0) {
        const ok = await syncUpsert(table, preSnapshot);
        if (!ok) { setSyncStatus("error"); return false; }
        for (const t of preSnapshot) dirtyIdsRef.current.delete(t.id);
        persistDirty();
        lastSyncAtRef.current = Date.now();
        if (!deletesOk) { setSyncStatus("error"); return false; }
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
        return true;
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

      let toUpsert = finalMerged.filter(t => {
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
      // This path uploads too, so it needs the same three-way merge as the
      // debounced push — otherwise a dirty row pushed from here still clobbers
      // the other device. No extra fetch needed: doMerge deliberately left dirty
      // rows alone, and the remote version of each is already in remoteMap.
      if (mergeTextField && toUpsert.length > 0) {
        const patched: T[] = [];
        const nextUpsert = toUpsert.map(row => {
          const merged = mergeRowText(row, remoteMap.get(row.id) as T | undefined);
          if (merged !== row) patched.push(merged);
          return merged;
        });
        if (patched.length > 0) {
          toUpsert = nextUpsert;
          applyMerged(patched);
        }
      }

      if (toUpsert.length > 0) {
        const ok = await syncUpsert(table, toUpsert);
        if (!ok) {
          for (const t of toUpsert) dirtyIdsRef.current.add(t.id);
          persistDirty();
          setSyncStatus("error");
          return false;
        }
        for (const t of toUpsert) dirtyIdsRef.current.delete(t.id);
        if (mergeTextField) {
          for (const t of toUpsert) setBaseText(t.id, (t as any)[mergeTextField]);
        }
        persistDirty();
      }

      advanceCursor(serverMax);
      // doMerge updated the merge bases in place for every row it accepted.
      persistBaseText();
      lastSyncAtRef.current = Date.now();
      if (!deletesOk) { setSyncStatus("error"); return false; }
      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
      return true;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [doMerge, loadCursor, advanceCursor, flushRemoteDeletes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Initial load ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadTimeout = setTimeout(() => {
      if (!loadedRef.current) { loadedRef.current = true; setLoaded(true); }
    }, 3000);

    loadLocal().then(async (raw) => {
      clearTimeout(loadTimeout);
      // Re-hydrate unsynced work from the previous session: edits whose upload
      // debounce never fired, and deletes whose tombstone never went out. Both
      // are retried by the performSync below.
      const [storedDirty, storedDeletes, storedBase] = await Promise.all([
        storage.get<string[]>(dirtyKey),
        storage.get<string[]>(pendingDeleteKey),
        mergeTextField ? storage.get<Record<string, string>>(baseTextKey) : Promise.resolve(null),
      ]);
      if (storedBase) baseTextRef.current = storedBase;
      // Filter both persisted queues to real ids on the way in. A null that
      // slipped into sync:pendingDelete:courses (origin unknown, pre-guard)
      // failed its tombstone upsert on every pass and held the domain at
      // `error` permanently — hydration is where every device heals itself.
      let droppedJunk = false;
      for (const id of storedDirty ?? []) {
        if (typeof id === "string" && id) dirtyIdsRef.current.add(id);
        else droppedJunk = true;
      }
      for (const id of storedDeletes ?? []) {
        if (typeof id !== "string" || !id) { droppedJunk = true; continue; }
        pendingRemoteDeletesRef.current.add(id);
        pendingDeletesRef.current.add(id); // guards doMerge from resurrecting it
      }
      // Rewrite the cleaned queues so the junk doesn't sit in storage forever
      // (flushRemoteDeletes early-returns on an empty set without persisting).
      if (droppedJunk) { persistDirty(); persistPendingDeletes(); }
      let local = raw;
      if (onLoad) {
        const result = onLoad(raw);
        local = result.items;
        for (const id of result.dirty) {
          dirtyIdsRef.current.add(id);
          localDirtyRef.current.add(id);
        }
      }
      if (dirtyIdsRef.current.size > 0) persistDirty();
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
  // Resolves false when anything failed, so callers can surface it honestly.
  const syncNow = useCallback(async (opts?: { full?: boolean }): Promise<boolean> => {
    return performSync(opts);
  }, [performSync]);

  // ─── Periodic pull while visible ─────────────────────────────────────────────
  // Push is event-driven (edits), but pull needs a clock: an always-visible
  // window otherwise never learns about other devices' changes until a
  // visibility flip or relaunch.
  //
  // Cadence, visibility gating, serialisation across domains and failure
  // backoff all live in lib/syncScheduler.ts — one heartbeat for the whole app
  // instead of one timer per collection. See that file for why the old
  // per-collection interval could strand a domain in `error` with nothing
  // scheduled to clear it.
  useEffect(() => {
    return registerSyncDomain(table, async () => {
      // Not loaded yet, or synced very recently by another trigger (foreground
      // transition, manual). Report success: neither is a failure, and counting
      // them as one would push a healthy domain into backoff.
      if (!loadedRef.current) return true;
      if (Date.now() - lastSyncAtRef.current < FOREGROUND_SYNC_MIN_INTERVAL_MS) return true;
      return performSync();
    });
  }, [table, performSync]);

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
