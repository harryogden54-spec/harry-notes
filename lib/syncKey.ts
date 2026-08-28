/**
 * Sync key — namespaces each user's data in the shared Supabase tables.
 *
 * Instead of requiring a login, the user sets one secret key on every device
 * (Settings → Sync). All devices sharing the same key see the same data; a
 * device with no key set runs in offline-only mode and never touches Supabase.
 *
 * The key is loaded once from AsyncStorage and cached in memory so that every
 * syncFetch/syncUpsert call doesn't incur a storage round-trip.
 */

import { storage } from "./storage";
import { resetKeyCache } from "./crypto";

const STORAGE_KEY = "sync_key";

// undefined = not yet loaded; null = loaded, no key set; string = loaded + key present
let _cached: string | null | undefined = undefined;

/**
 * Returns the current sync key.  Lazy-loads from AsyncStorage on first call,
 * then returns from memory.  Returns null if no key is configured.
 */
export async function getSyncKey(): Promise<string | null> {
  if (_cached !== undefined) return _cached;
  _cached = await storage.get<string>(STORAGE_KEY);
  return _cached;
}

/**
 * Returns the sync key synchronously from the in-memory cache.
 * Returns null if the key hasn't been loaded yet or isn't configured.
 * Safe to call from non-async contexts; use getSyncKey() when correctness matters.
 */
export function getCachedSyncKey(): string | null {
  return typeof _cached === "string" ? _cached : null;
}

/**
 * Sets (or clears) the sync key.  Persists to AsyncStorage and updates cache.
 * Pass an empty string to clear the key (switch to offline mode).
 */
export async function setSyncKey(key: string): Promise<void> {
  const trimmed = key.trim();
  _cached = trimmed || null;
  // The at-rest encryption key is derived from the sync key, so a rotation must
  // drop the cached CryptoKey — otherwise the next upload encrypts the NEW
  // dataset under the OLD key and nothing can read it back.
  resetKeyCache();
  if (trimmed) {
    await storage.set(STORAGE_KEY, trimmed);
  } else {
    await storage.remove(STORAGE_KEY);
  }
  // The delta cursors belong to the previous key's dataset — drop them so the
  // next sync does a full fetch against the new key.
  // Cursors AND merge bases belong to the previous key's dataset — a stale base
  // would make the next three-way merge diff against someone else's text.
  const tables = ["tasks", "notes", "dumps", "courses", "task_categories", "today_items"];
  await Promise.all([
    ...tables.map(t => storage.remove(`sync:cursor:${t}`)),
    ...tables.map(t => storage.remove(`sync:base:${t}`)),
  ]);
}

/**
 * Generates a random human-typeable sync key in the form XXXX-XXXX-XXXX.
 * Uses an unambiguous character set (no 0/O, 1/I/L).
 */
export function generateSyncKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${segment()}-${segment()}-${segment()}`;
}
