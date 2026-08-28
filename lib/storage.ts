import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  idbAvailable, kvGet, kvSet, kvRemove, kvKeys, kvRemoveMany, migrateFromLocalStorage,
} from "./webKV";

/**
 * The app's local key/value store. One chokepoint — every context, the sync
 * engine's cursors, dirty sets and tombstone queues, the theme, and the sync
 * key all go through here.
 *
 * Backend by platform:
 *   native → AsyncStorage (SQLite-backed; the durable store is lib/db.ts anyway)
 *   web    → IndexedDB, falling back to AsyncStorage (= localStorage)
 *
 * Web used to be localStorage only, via AsyncStorage. That capped the whole
 * origin at ~5MB and, once full, lost writes in silence — see lib/webKV.ts for
 * the full reasoning. IndexedDB is the same browser, a much bigger drawer.
 */

// Web only, and only once per page load. Every read and write awaits this, so
// no call can observe a half-migrated store.
const ready: Promise<boolean> = (async () => {
  if (Platform.OS !== "web" || !idbAvailable()) return false;
  try {
    await migrateFromLocalStorage();
    return true;
  } catch (e) {
    // Broken or blocked IndexedDB (private mode, blocked cookies, a stuck
    // upgrade) must not take the app down — localStorage still holds
    // everything, because the migration never deletes from it.
    console.warn("[storage] IndexedDB unavailable, falling back to localStorage", e);
    return false;
  }
})();

async function useIdb(): Promise<boolean> {
  try { return await ready; } catch { return false; }
}

export const storage = {
  /**
   * Returns null for a missing key AND for an unparseable one, dropping the bad
   * value on the way out.
   *
   * The parse used to be unguarded, which made any corrupt entry fatal rather
   * than merely lossy: `loadLocal` rejects, and the initial-load path in
   * useSyncedCollection treats that as a hard failure — it marks the domain
   * `error` and returns WITHOUT calling performSync, so the collection never
   * pulls again on that device and the bad value is never overwritten. One
   * truncated write (quota, a kill mid-write) would strand a whole domain
   * permanently. Same class as the null that sat in sync:pendingDelete:courses
   * pinning Courses at `error` — bad data at a storage mouth has to be filtered
   * where it is read, not assumed away.
   *
   * Dropping the key is deliberate: unparseable means unrecoverable, and
   * leaving it in place would re-log on every read. Sync then refills the
   * collection from the server on the very next pass.
   */
  async get<T>(key: string): Promise<T | null> {
    const raw = await (await useIdb() ? kvGet(key) : AsyncStorage.getItem(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[storage] discarding unparseable value for "${key}"`);
      await this.remove(key);
      return null;
    }
  },

  /**
   * Throws on failure rather than swallowing.
   *
   * Callers are mostly fire-and-forget (`saveLocal` in useSyncedCollection is
   * documented as such), so a rejection here surfaces as an unhandled rejection
   * in the console instead of vanishing — which is the point. A quota failure
   * that leaves no trace anywhere is what made the 5MB ceiling so hard to
   * diagnose: the app looked like it had saved.
   */
  async set(key: string, value: unknown): Promise<void> {
    const json = JSON.stringify(value);
    try {
      if (await useIdb()) await kvSet(key, json);
      else await AsyncStorage.setItem(key, json);
    } catch (e: any) {
      const quota = e?.name === "QuotaExceededError"
        || e?.name === "NS_ERROR_DOM_QUOTA_REACHED"
        || /quota/i.test(String(e?.message ?? ""));
      console.error(
        quota
          ? `[storage] OUT OF SPACE writing "${key}" (${json.length} bytes) — the write was LOST`
          : `[storage] failed to write "${key}"`,
        e
      );
      throw e;
    }
  },

  async remove(key: string): Promise<void> {
    if (await useIdb()) await kvRemove(key);
    else await AsyncStorage.removeItem(key);
  },

  /** All keys currently held. Used by the legacy Today importer. */
  async keys(): Promise<string[]> {
    if (await useIdb()) return kvKeys();
    return Array.from(await AsyncStorage.getAllKeys());
  },

  async removeMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (await useIdb()) await kvRemoveMany(keys);
    else await AsyncStorage.multiRemove(keys);
  },
};
