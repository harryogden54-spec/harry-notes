/**
 * IndexedDB key/value store for the web build.
 *
 * Why this exists: `@react-native-async-storage/async-storage` on web is a thin
 * synchronous wrapper over `window.localStorage` (see its
 * `lib/module/AsyncStorage.js` — it literally calls `window.localStorage.setItem`).
 * localStorage is capped at roughly 5MB per origin, shared across everything the
 * origin stores. Tasks and settings never come close; a daily journal does. Once
 * the cap is hit `setItem` throws `QuotaExceededError`, and because every
 * `saveLocal` in useSyncedCollection is deliberately fire-and-forget, the throw
 * lands in an unobserved promise and the write is simply lost. No error, no
 * toast, nothing in the UI — the exact "saves fail quietly" failure.
 *
 * IndexedDB on the same origin gets a share of a much larger pool (hundreds of
 * MB to a good fraction of free disk, depending on the browser), is async by
 * design, and reports quota failures as real rejections.
 *
 * Deliberately dependency-free and deliberately tiny: one database, one object
 * store, string keys, string values — the exact shape `lib/storage.ts` already
 * needs. `idb` would be nicer to read but this is ~100 lines and the app ships
 * to Cloudflare Pages, where every dependency is bundle weight.
 */

const DB_NAME = "harry-notes-kv";
const DB_VERSION = 1;
const STORE = "kv";

let _dbPromise: Promise<IDBDatabase> | null = null;

/** True when this environment can actually use IndexedDB. */
export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    // Accessing `indexedDB` throws outright in some locked-down contexts
    // (Firefox with cookies fully blocked, some private modes).
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      // A second tab running a newer version needs this one to let go, or that
      // tab's upgrade blocks forever.
      db.onversionchange = () => {
        db.close();
        _dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("indexedDB.open failed"));
    req.onblocked = () => reject(new Error("indexedDB.open blocked by another tab"));
  });
  // Don't cache a rejected promise — a transient failure would otherwise be
  // permanent for the life of the page.
  _dbPromise.catch(() => { _dbPromise = null; });
  return _dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const req = run(transaction.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    // The request error and the transaction error are distinct: a quota failure
    // surfaces on the transaction (onabort), not always on the request.
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("idb transaction aborted"));
  }));
}

export function kvGet(key: string): Promise<string | null> {
  return tx<string | undefined>("readonly", s => s.get(key)).then(v => v ?? null);
}

export function kvSet(key: string, value: string): Promise<void> {
  return tx<unknown>("readwrite", s => s.put(value, key)).then(() => undefined);
}

export function kvRemove(key: string): Promise<void> {
  return tx<unknown>("readwrite", s => s.delete(key)).then(() => undefined);
}

export function kvKeys(): Promise<string[]> {
  return tx<IDBValidKey[]>("readonly", s => s.getAllKeys()).then(
    keys => keys.map(String)
  );
}

/** Batched remove — one transaction rather than N. */
export function kvRemoveMany(keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve();
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    for (const k of keys) store.delete(k);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("idb transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("idb transaction failed"));
  }));
}

// ─── One-time migration off localStorage ─────────────────────────────────────

const MIGRATED_FLAG = "__idb_migrated_v1";

/**
 * Copy everything already in localStorage into IndexedDB, once.
 *
 * localStorage is left completely intact. That is deliberate and worth keeping
 * for at least one release: if IndexedDB turns out to be unavailable or broken
 * on a device, `storage` falls back to localStorage and finds the real data
 * still sitting there rather than an empty store. The cost is one duplicated
 * copy of a dataset that was, by definition, small enough to fit in 5MB.
 *
 * Existing IDB values always win — a key already in IDB is newer than the
 * localStorage copy by construction, so re-running this can never roll a write
 * backwards.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const done = await kvGet(MIGRATED_FLAG);
  if (done) return;

  const existing = new Set(await kvKeys());
  let copied = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || existing.has(key)) continue;
    const value = localStorage.getItem(key);
    if (value === null) continue;
    await kvSet(key, value);
    copied++;
  }
  await kvSet(MIGRATED_FLAG, new Date().toISOString());
  if (copied > 0) console.info(`[storage] migrated ${copied} key(s) from localStorage to IndexedDB`);
}
