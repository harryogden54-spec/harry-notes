import AsyncStorage from "@react-native-async-storage/async-storage";

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
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[storage] discarding unparseable value for "${key}"`);
      await AsyncStorage.removeItem(key);
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
