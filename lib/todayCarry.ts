/**
 * Today carry-over (C1a — local rolling carry).
 *
 * Incomplete Today items must persist into the next day rather than being lost.
 * `carryForwardToday()` runs once at app start: it scans every past
 * `today_items_<date>` key (date < today), pulls forward the incomplete items
 * into today's list (deduped by text), and rewrites each past key to retain
 * ONLY its completed items — so carried items are never pulled forward twice.
 * This makes the function idempotent (a second run the same day is a no-op) and
 * handles multi-day gaps (e.g. the app wasn't opened for several days).
 *
 * Scope is intentionally local-only (no Supabase sync) per product decision.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "./storage";
import { getLocalDateStr } from "./utils";

const PREFIX = "today_items_";

export type TodayItem = {
  id: string;
  text: string;
  done: boolean;
  time_block?: string;
};

function newCarryId(): string {
  return `co_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Remove `today_items_*` keys older than 7 days. AsyncStorage on web
 * (localStorage) has a ~5 MB quota — old day-keys add up quietly.
 */
async function gcStaleKeys(allKeys: readonly string[], todayStr: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = getLocalDateStr(cutoff);
  const stale = allKeys.filter(k => k.startsWith(PREFIX) && k.slice(PREFIX.length) < cutoffStr);
  if (stale.length > 0) await AsyncStorage.multiRemove([...stale]);
}

export async function carryForwardToday(): Promise<void> {
  try {
    const todayStr = getLocalDateStr();
    const todayKey = `${PREFIX}${todayStr}`;

    const allKeys = await AsyncStorage.getAllKeys();
    // Past day-keys, oldest first, so carried items keep chronological order.
    const pastKeys = allKeys
      .filter(k => k.startsWith(PREFIX) && k.slice(PREFIX.length) < todayStr)
      .sort();

    const carried: TodayItem[] = [];
    for (const key of pastKeys) {
      const items = (await storage.get<TodayItem[]>(key)) ?? [];
      const incomplete = items.filter(i => !i.done);
      if (incomplete.length === 0) continue;
      carried.push(...incomplete);
      // Keep only completed items in the source day — its incomplete items have
      // moved forward, so they won't be re-carried on the next run.
      await storage.set(key, items.filter(i => i.done));
    }

    if (carried.length > 0) {
      const existing = (await storage.get<TodayItem[]>(todayKey)) ?? [];
      const seen = new Set(existing.map(i => i.text.trim().toLowerCase()));
      const merged = [...existing];
      for (const item of carried) {
        const norm = item.text.trim().toLowerCase();
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        merged.push({
          id: newCarryId(),
          text: item.text,
          done: false,
          ...(item.time_block ? { time_block: item.time_block } : {}),
        });
      }
      await storage.set(todayKey, merged);
    }

    await gcStaleKeys(allKeys, todayStr);
  } catch {
    // Non-critical — never block app start on a carry-over hiccup.
  }
}
